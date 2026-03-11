// ============================================
// SNAH Inventory - Cloudflare Worker API
// ============================================

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

function error(message, status = 400) {
    return json({ error: message }, status);
}

async function logActivity(env, userId, action, entity, entityId, details = '') {
    if (!userId) return;
    try {
        await env.DB.prepare('INSERT INTO activity_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)')
            .bind(userId, action, entity, String(entityId), details).run();
    } catch (e) {
        console.error('Activity log error:', e);
    }
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        try {
            // ====== AUTH ======
            if (path === '/api/login' && method === 'POST') {
                const { username, password } = await request.json();
                const user = await env.DB.prepare(
                    'SELECT id, username, name, email, role, roles, role_label, status FROM users WHERE username = ? AND password = ?'
                ).bind(username, password).first();
                if (!user) return error('Invalid username or password', 401);
                if (user.status === 'suspended') return error('Account is suspended', 403);

                await logActivity(env, user.id, 'login', 'user', user.id, 'User logged in');

                return json({
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        roles: (() => {
                            try {
                                if (user.roles && user.roles !== '[]') return JSON.parse(user.roles);
                                return user.role ? [user.role] : [];
                            } catch (e) {
                                return user.role ? [user.role] : [];
                            }
                        })(),
                        roleLabel: user.role_label
                    },
                });
            }

            // ====== USERS ======
            if (path === '/api/users' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT id, username, name, email, role, roles, role_label, created_at, status FROM users ORDER BY id DESC').all();
                return json(results.map(u => {
                    let parsedRoles = [];
                    try {
                        if (u.roles && u.roles !== '[]') {
                            parsedRoles = JSON.parse(u.roles);
                        } else if (u.role) {
                            parsedRoles = [u.role]; // Fallback to legacy role
                        }
                    } catch (e) {
                        console.error('Error parsing roles for user', u.id, e);
                        if (u.role) parsedRoles = [u.role];
                    }
                    return { ...u, roles: parsedRoles };
                }));
            }
            if (path === '/api/users' && method === 'POST') {
                const { username, password, name, email, role, roles, roleLabel, createdBy } = await request.json();
                const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
                if (existing) return error('Username already taken', 400);

                const rolesJson = JSON.stringify(roles || []);
                const result = await env.DB.prepare(
                    'INSERT INTO users (username, password, name, email, role, roles, role_label) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(username, password, name, email || '', role || '', rolesJson, roleLabel || '').run();
                const newId = result.meta.last_row_id;
                await logActivity(env, createdBy, 'create', 'user', newId, `Created user ${username}`);
                return json({ id: newId, username, name, email, role, roles, role_label: roleLabel }, 201);
            }
            if (path.startsWith('/api/users/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const body = await request.json();
                const updates = [];
                const values = [];

                if (body.name) { updates.push('name = ?'); values.push(body.name); }
                if (body.username) { updates.push('username = ?'); values.push(body.username); }
                if (body.email !== undefined) { updates.push('email = ?'); values.push(body.email); }
                if (body.role) { updates.push('role = ?'); values.push(body.role); }
                if (body.roles) {
                    const rolesArray = Array.isArray(body.roles) ? body.roles : [];
                    updates.push('roles = ?');
                    values.push(JSON.stringify(rolesArray));

                    // Sync legacy role field with the first role in the array if not explicitly provided
                    if (!body.role && rolesArray.length > 0) {
                        updates.push('role = ?');
                        values.push(rolesArray[0]);
                    }
                }
                if (body.roleLabel) { updates.push('role_label = ?'); values.push(body.roleLabel); }
                if (body.password) { updates.push('password = ?'); values.push(body.password); }
                if (body.status) { updates.push('status = ?'); values.push(body.status); }

                if (updates.length > 0) {
                    values.push(id);
                    await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
                    await logActivity(env, body.updatedBy, 'update', 'user', id, `Updated user ${id}`);
                }
                return json({ success: true });
            }

            // ====== ACTIVITY LOGS ======
            if (path === '/api/activity_logs' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const limit = parseInt(urlParams.get('limit')) || 20;
                const offset = parseInt(urlParams.get('offset')) || 0;
                
                const countQuery = 'SELECT COUNT(*) as total FROM activity_logs';
                const { results: countResult } = await env.DB.prepare(countQuery).all();
                const total = countResult[0].total;
                
                const query = `
                    SELECT a.*, u.name as user_name, u.role_label as user_role 
                    FROM activity_logs a 
                    LEFT JOIN users u ON a.user_id = u.id 
                    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
                `;
                const { results } = await env.DB.prepare(query).bind(limit, offset).all();
                
                return json({ results, total });
            }

            // ====== DELIVERY PARTNERS ======
            if (path === '/api/delivery_partners' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM delivery_partners ORDER BY name').all();
                return json(results);
            }
            if (path === '/api/delivery_partners' && method === 'POST') {
                const { name, trackingUrlTemplate } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO delivery_partners (name, tracking_url_template) VALUES (?, ?)'
                ).bind(name, trackingUrlTemplate).run();
                return json({ id: result.meta.last_row_id, name, tracking_url_template: trackingUrlTemplate }, 201);
            }

            if (path.startsWith('/api/delivery_partners/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                await env.DB.prepare('DELETE FROM delivery_partners WHERE id = ?').bind(id).run();
                return json({ success: true });
            }

            // ====== DASHBOARD AGGREGATES ======
            if (path === '/api/dashboard-stats' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const period = urlParams.get('period') || 'all'; // 'today', 'week', 'month', 'custom', 'all'
                const customFrom = urlParams.get('from');
                const customTo = urlParams.get('to');
                
                // Build date logic
                let whereClause = '';
                let whereParams = [];
                
                if (period !== 'all') {
                    // Dates from frontend come in as ISO or YYYY-MM-DD
                    whereClause = ' WHERE created_at >= ? AND created_at < ?';
                    whereParams = [customFrom, customTo];
                }

                // Get Total Orders (excluding returned)
                const ordersQuery = period === 'all' 
                    ? "SELECT COUNT(id) as totalOrders, SUM(paid_amount) as totalSales FROM orders WHERE status != 'returned'"
                    : "SELECT COUNT(id) as totalOrders, SUM(paid_amount) as totalSales FROM orders WHERE status != 'returned' AND created_at >= ? AND created_at < ?";
                
                const ordersResult = await env.DB.prepare(ordersQuery).bind(...whereParams).first() || { totalOrders: 0, totalSales: 0 };
                
                // Get Total Expenses (Ledger)
                const expenseQuery = period === 'all'
                    ? "SELECT SUM(amount) as totalExpenses FROM ledger WHERE type = 'expense'"
                    : "SELECT SUM(amount) as totalExpenses FROM ledger WHERE type = 'expense' AND date >= ? AND date < ?";
                
                // Ledger uses YYYY-MM-DD for date, so we need to slice the ISO strings if we pass ISO
                const ledgerParams = whereParams.map(p => p.split('T')[0]);
                const expenseResult = await env.DB.prepare(expenseQuery).bind(...ledgerParams).first() || { totalExpenses: 0 };

                // Get product counts
                const productsResult = await env.DB.prepare('SELECT COUNT(id) as total FROM products').first();
                const lowStockResult = await env.DB.prepare('SELECT COUNT(id) as lowStock FROM products WHERE stock <= 10').first();

                // Compute product performance
                // For performance over large datasets, doing GROUP BY on order_items joined with orders
                const perfQuery = period === 'all'
                    ? `SELECT oi.product_id as productId, SUM(oi.quantity) as soldQuantity, SUM(oi.quantity * oi.price) as revenue 
                       FROM order_items oi 
                       JOIN orders o ON oi.order_id = o.id 
                       WHERE o.status != 'returned' 
                       GROUP BY oi.product_id`
                    : `SELECT oi.product_id as productId, SUM(oi.quantity) as soldQuantity, SUM(oi.quantity * oi.price) as revenue 
                       FROM order_items oi 
                       JOIN orders o ON oi.order_id = o.id 
                       WHERE o.status != 'returned' AND o.created_at >= ? AND o.created_at < ?
                       GROUP BY oi.product_id`;
                       
                const { results: perfResults } = await env.DB.prepare(perfQuery).bind(...whereParams).all();

                return json({
                    totalOrders: ordersResult.totalOrders || 0,
                    totalSales: ordersResult.totalSales || 0,
                    totalExpenses: expenseResult.totalExpenses || 0,
                    totalProducts: productsResult.total || 0,
                    lowStockCount: lowStockResult.lowStock || 0,
                    productPerformance: perfResults || []
                });
            }

            // ====== CUSTOMERS ======
            if (path === '/api/customers' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const limit = parseInt(urlParams.get('limit')) || 20;
                const offset = parseInt(urlParams.get('offset')) || 0;
                const search = urlParams.get('search');
                
                let query = 'SELECT * FROM customers';
                let countQuery = 'SELECT COUNT(*) as total FROM customers';
                const values = [];
                
                if (search) {
                    const searchClause = ' WHERE name LIKE ? OR phone LIKE ? OR address LIKE ? OR area LIKE ?';
                    query += searchClause;
                    countQuery += searchClause;
                    const sp = `%${search}%`;
                    values.push(sp, sp, sp, sp);
                }
                
                const { results: countResult } = await env.DB.prepare(countQuery).bind(...values).all();
                const total = countResult[0].total;
                
                query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
                const { results } = await env.DB.prepare(query).bind(...values, limit, offset).all();
                
                return json({ results, total });
            }

            if (path === '/api/customers' && method === 'POST') {
                const { name, phone, address, area, createdBy } = await request.json();
                const existing = await env.DB.prepare('SELECT id FROM customers WHERE phone = ?').bind(phone).first();
                if (existing) return error('A customer with this mobile number already exists.', 400);

                const result = await env.DB.prepare(
                    'INSERT INTO customers (name, phone, address, area) VALUES (?, ?, ?, ?)'
                ).bind(name, phone, address || '', area || '').run();
                const newId = result.meta.last_row_id;
                await logActivity(env, createdBy, 'create', 'customer', newId, `Created customer ${name} (${phone})`);
                return json({ id: newId, name, phone, address: address || '', area: area || '' }, 201);
            }

            if (path.startsWith('/api/customers/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const { name, phone, address, area, updatedBy } = await request.json();
                const existing = await env.DB.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').bind(phone, id).first();
                if (existing) return error('A customer with this mobile number already exists.', 400);

                await env.DB.prepare(
                    'UPDATE customers SET name = ?, phone = ?, address = ?, area = ? WHERE id = ?'
                ).bind(name, phone, address || '', area || '', id).run();
                await logActivity(env, updatedBy, 'update', 'customer', id, `Updated customer ${name}`);
                return json({ id, name, phone, address: address || '', area: area || '' });
            }

            if (path.startsWith('/api/customers/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                const urlParams = new URL(request.url).searchParams;
                const deletedBy = urlParams.get('userId');
                await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
                await logActivity(env, deletedBy, 'delete', 'customer', id, `Deleted customer ${id}`);
                return json({ success: true });
            }

            // ====== PRODUCTS ======
            if (path === '/api/products' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
                return json(results.map(p => ({
                    id: p.id, name: p.name,
                    sellingPrice: p.selling_price, gst: p.gst, stock: p.stock,
                })));
            }

            if (path === '/api/products' && method === 'POST') {
                const { name, sellingPrice, gst, stock } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO products (name, selling_price, gst, stock) VALUES (?, ?, ?, ?)'
                ).bind(name, sellingPrice, gst, stock || 0).run();
                return json({ id: result.meta.last_row_id, name, sellingPrice, gst, stock: stock || 0 }, 201);
            }

            if (path.startsWith('/api/products/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const { name, sellingPrice, gst, stock } = await request.json();
                await env.DB.prepare(
                    'UPDATE products SET name = ?, selling_price = ?, gst = ?, stock = ? WHERE id = ?'
                ).bind(name, sellingPrice, gst, stock, id).run();
                return json({ id, name, sellingPrice, gst, stock });
            }

            if (path.startsWith('/api/products/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                const urlParams = new URL(request.url).searchParams;
                const deletedBy = urlParams.get('userId');
                await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
                await logActivity(env, deletedBy, 'delete', 'product', id, `Deleted product ${id}`);
                return json({ success: true });
            }

            // ====== ORDERS ======
            if (path === '/api/orders' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const limit = parseInt(urlParams.get('limit')) || 1000;
                const offset = parseInt(urlParams.get('offset')) || 0;
                const search = urlParams.get('search');
                const role = urlParams.get('role');
                const status = urlParams.get('status');
                const paymentStatus = urlParams.get('paymentStatus'); // 'all', 'paid', 'not_paid', 'partial'

                let query = 'SELECT o.* FROM orders o';
                let values = [];
                let whereClauses = [];

                if (search) {
                    query += ' LEFT JOIN customers c ON o.customer_id = c.id';
                    whereClauses.push('(o.id LIKE ? OR o.tracking_id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
                    const searchPattern = `%${search}%`;
                    values.push(searchPattern, searchPattern, searchPattern, searchPattern);
                }

                if (status && status !== 'all') {
                    if (status === 'completed_deliveries') {
                        whereClauses.push("(o.status = 'shipped' OR o.status = 'delivered')");
                    } else {
                        whereClauses.push("o.status = ?");
                        values.push(status);
                    }
                }

                if (paymentStatus && paymentStatus !== 'all') {
                    whereClauses.push("o.payment_status = ?");
                    values.push(paymentStatus);
                }

                // If non-admin employee, default to a smaller limit if not specified
                // The user requested 30 for employees
                let finalLimit = limit;
                if (role && role !== 'super_admin' && !urlParams.has('limit')) {
                    finalLimit = 30;
                }

                let finalQuery = query;
                if (whereClauses.length > 0) {
                    finalQuery += ' WHERE ' + whereClauses.join(' AND ');
                }
                
                // Get Total Count for pagination
                let countQuery = 'SELECT COUNT(*) as total FROM orders o';
                if (search) countQuery += ' LEFT JOIN customers c ON o.customer_id = c.id';
                if (whereClauses.length > 0) countQuery += ' WHERE ' + whereClauses.join(' AND ');
                const { results: countResult } = await env.DB.prepare(countQuery).bind(...values).all();
                const total = countResult[0].total;

                finalQuery += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
                const finalValues = [...values, finalLimit, offset];

                const { results: orders } = await env.DB.prepare(finalQuery).bind(...finalValues).all();

                if (orders.length === 0) return json({ results: [], total });

                // Fetch items only for these specific orders to save reads
                const orderIds = orders.map(o => o.id);
                const placeholders = orderIds.map(() => '?').join(',');
                const { results: items } = await env.DB.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).bind(...orderIds).all();

                const mapped = orders.map(o => ({
                    id: o.id, customerId: o.customer_id, crmLeadId: o.crm_lead_id || null, subtotal: o.subtotal,
                    discount: o.discount || 0, discountType: o.discount_type || 'flat',
                    gstAmount: o.gst_amount, total: o.total, paidAmount: o.paid_amount || 0,
                    paymentStatus: o.payment_status, trackingId: o.tracking_id,
                    deliveryPartner: o.delivery_partner || '', trackingLink: o.tracking_link || '',
                    status: o.status, returnReason: o.return_reason || '',
                    isRedispatched: o.is_redispatched === 1,
                    redispatchedFromId: o.redispatched_from_id || null,
                    shippedDate: o.shipped_date || null,
                    deliveredDate: o.delivered_date || null,
                    createdAt: o.created_at, createdBy: o.created_by,
                    items: items.filter(i => i.order_id === o.id).map(i => ({
                        productId: i.product_id, quantity: i.quantity, price: i.price, gst: i.gst,
                    })),
                }));
                return json({ results: mapped, total });
            }

            if (path === '/api/orders' && method === 'POST') {
                const { customerId, crmLeadId, items, subtotal, discount, discountType, gstAmount, total, paymentStatus, paidAmount, createdBy, redispatchedFromId, trackingId, deliveryPartner, trackingLink, createdAt: bodyCreatedAt } = await request.json();

                let orderDateStr;
                let createdAt;
                if (bodyCreatedAt) {
                    orderDateStr = new Date(bodyCreatedAt);
                    createdAt = bodyCreatedAt;
                } else {
                    const istOffset = 5.5 * 60 * 60000;
                    orderDateStr = new Date(Date.now() + istOffset);
                    createdAt = new Date().toISOString();
                }

                // Make sure to use UTC getters since ISO strings from frontend for dates like "2026-03-01" are in UTC midnight
                // For Date.now() + istOffset, the "UTC" getters represent the IST time if we don't adjust it back.
                const dd = String(bodyCreatedAt ? orderDateStr.getUTCDate() : orderDateStr.getUTCDate()).padStart(2, '0');
                const mm = String(bodyCreatedAt ? orderDateStr.getUTCMonth() + 1 : orderDateStr.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = bodyCreatedAt ? orderDateStr.getUTCFullYear() : orderDateStr.getUTCFullYear();
                const datePrefix = `${dd}-${mm}-${yyyy}`; // e.g. "07-03-2026"

                // Duplicate check moved to frontend as a soft warning. Backend no longer blocks.

                // Find the highest sequence number already used today
                // Date prefix is 10 chars, dash is char 11, sequence starts at char 12
                const maxResult = await env.DB.prepare(
                    "SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as mx FROM orders WHERE id LIKE ?"
                ).bind(`${datePrefix}-%`).first();
                const nextNum = (maxResult && maxResult.mx) ? maxResult.mx + 1 : 1;
                const orderId = `${datePrefix}-${String(nextNum).padStart(3, '0')}`; // e.g. "07-03-2026-001"

                const finalPaidAmount = paymentStatus === 'paid' ? total : (paidAmount || 0);
                const initialTrackingId = trackingId ? trackingId.trim() : '';
                // If tracking ID provided at creation time, mark as shipped right away
                const initialStatus = initialTrackingId ? 'shipped' : 'pending';
                const shippedDate = initialTrackingId ? createdAt : null;

                await env.DB.prepare(
                    'INSERT INTO orders (id, customer_id, crm_lead_id, subtotal, discount, discount_type, gst_amount, total, paid_amount, payment_status, tracking_id, delivery_partner, tracking_link, status, shipped_date, created_at, created_by, is_redispatched, redispatched_from_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(orderId, customerId, crmLeadId || null, subtotal, discount || 0, discountType || 'flat', gstAmount, total, finalPaidAmount, paymentStatus, initialTrackingId, deliveryPartner || '', trackingLink || '', initialStatus, shippedDate, createdAt, createdBy, redispatchedFromId ? 1 : 0, redispatchedFromId || null).run();

                for (const item of items) {
                    await env.DB.prepare(
                        'INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES (?, ?, ?, ?, ?)'
                    ).bind(orderId, item.productId, item.quantity, item.price, item.gst).run();

                    // Do not reduce stock for services (e.g. products like "Shipping Charge" without stock might have 0, but ideally stock is not tracked for services. We leave it as is for physical products)
                    await env.DB.prepare(
                        'UPDATE products SET stock = stock - ? WHERE id = ?'
                    ).bind(item.quantity, item.productId).run();
                }

                await logActivity(env, createdBy, 'create', 'order', orderId, `Created order ${orderId} for ₹${total}`);

                // If it's a redispatch, mark the old order as redispatched (optional, but handled on client)
                return json({ id: orderId, customerId, items, subtotal, discount: discount || 0, discountType: discountType || 'flat', gstAmount, total, paidAmount: finalPaidAmount, paymentStatus, status: initialStatus, createdAt, trackingId: initialTrackingId, deliveryPartner: deliveryPartner || '', trackingLink: trackingLink || '', shippedDate, isRedispatched: !!redispatchedFromId, redispatchedFromId: redispatchedFromId || null }, 201);
            }

            if (path.startsWith('/api/orders/') && method === 'PUT') {
                const id = path.split('/').pop();
                const body = await request.json();
                const updates = [];
                const values = [];

                let setStatusToShipped = false;

                if (body.status !== undefined) {
                    updates.push('status = ?'); values.push(body.status);
                    if (body.status === 'shipped') {
                        updates.push('shipped_date = ?'); values.push(new Date().toISOString());
                    } else if (body.status === 'delivered') {
                        updates.push('delivered_date = ?'); values.push(new Date().toISOString());
                    }
                }
                if (body.paymentStatus !== undefined) { updates.push('payment_status = ?'); values.push(body.paymentStatus); }
                if (body.paidAmount !== undefined) { updates.push('paid_amount = ?'); values.push(body.paidAmount); }

                if (body.trackingId !== undefined) {
                    updates.push('tracking_id = ?'); values.push(body.trackingId);
                    if (body.trackingId && !body.status && body.currentStatus !== 'shipped' && body.currentStatus !== 'delivered') {
                        setStatusToShipped = true;
                    }
                }
                if (setStatusToShipped) {
                    updates.push('status = ?'); values.push('shipped');
                    updates.push('shipped_date = ?'); values.push(new Date().toISOString());
                    body.status = 'shipped'; // For activity log
                }

                if (body.deliveryPartner !== undefined) { updates.push('delivery_partner = ?'); values.push(body.deliveryPartner); }
                if (body.trackingLink !== undefined) { updates.push('tracking_link = ?'); values.push(body.trackingLink); }
                if (body.crmLeadId !== undefined) { updates.push('crm_lead_id = ?'); values.push(body.crmLeadId); }

                let newId = id;
                if (body.createdAt !== undefined) {
                    updates.push('created_at = ?'); values.push(body.createdAt);

                    // Check if order ID needs to be updated to match the new date format
                    const orderDateStr = new Date(body.createdAt);
                    const dd = String(orderDateStr.getUTCDate()).padStart(2, '0');
                    const mm = String(orderDateStr.getUTCMonth() + 1).padStart(2, '0');
                    const yyyy = orderDateStr.getUTCFullYear();
                    const newDatePrefix = `${dd}-${mm}-${yyyy}`;

                    if (!id.startsWith(newDatePrefix)) {
                        // Find the highest sequence number for the new date prefix
                        const maxResult = await env.DB.prepare(
                            "SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as mx FROM orders WHERE id LIKE ?"
                        ).bind(`${newDatePrefix}-%`).first();
                        const nextNum = (maxResult && maxResult.mx) ? maxResult.mx + 1 : 1;
                        newId = `${newDatePrefix}-${String(nextNum).padStart(3, '0')}`;

                        updates.push('id = ?'); values.push(newId);
                    }
                }

                if (body.returnReason !== undefined) { updates.push('return_reason = ?'); values.push(body.returnReason); }
                if (body.isRedispatched !== undefined) { updates.push('is_redispatched = ?'); values.push(body.isRedispatched ? 1 : 0); }

                if (body.customerId !== undefined) { updates.push('customer_id = ?'); values.push(body.customerId); }
                if (body.subtotal !== undefined) { updates.push('subtotal = ?'); values.push(body.subtotal); }
                if (body.discount !== undefined) { updates.push('discount = ?'); values.push(body.discount); }
                if (body.discountType !== undefined) { updates.push('discount_type = ?'); values.push(body.discountType); }
                if (body.gstAmount !== undefined) { updates.push('gst_amount = ?'); values.push(body.gstAmount); }
                if (body.total !== undefined) { updates.push('total = ?'); values.push(body.total); }

                // If items are provided, replace them
                if (body.items !== undefined) {
                    // Restore old stock
                    const { results: oldItems } = await env.DB.prepare(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
                    ).bind(id).all();
                    for (const item of oldItems) {
                        await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.product_id).run();
                    }
                    // Delete old items
                    await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id).run();
                    // Insert new items and reduce stock
                    for (const item of body.items) {
                        await env.DB.prepare(
                            'INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES (?, ?, ?, ?, ?)'
                        ).bind(id, item.productId, item.quantity, item.price, item.gst).run();

                        await env.DB.prepare(
                            'UPDATE products SET stock = stock - ? WHERE id = ?'
                        ).bind(item.quantity, item.productId).run();
                    }
                }

                // If status is "returned", restore stock
                if (body.status === 'returned' && body.restoreStock) {
                    const { results: orderItems } = await env.DB.prepare(
                        'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
                    ).bind(id).all();
                    for (const item of orderItems) {
                        await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.product_id).run();
                    }
                }

                if (updates.length > 0) {
                    values.push(id);
                    await env.DB.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

                    // If ID changed, update related order_items and activity logs
                    if (newId !== id) {
                        try {
                            await env.DB.prepare('UPDATE order_items SET order_id = ? WHERE order_id = ?').bind(newId, id).run();
                            await env.DB.prepare('UPDATE activity_logs SET entity_id = ? WHERE entity = ? AND entity_id = ?').bind(newId, 'order', id).run();
                        } catch (e) {
                            console.error('Failed to update related records for new order ID:', e);
                        }
                    }

                    let logStr = `Updated order ${id}`;
                    if (newId !== id) logStr += ` to ${newId}`;
                    if (body.status) logStr += `, status=${body.status}`;
                    if (body.trackingId) logStr += `, trackingId=${body.trackingId}`;
                    await logActivity(env, body.updatedBy, 'update', 'order', newId, logStr);
                }
                return json({ success: true, autoShipped: setStatusToShipped, newId: newId });
            }

            if (path.startsWith('/api/orders/') && method === 'DELETE') {
                const id = path.split('/').pop();

                // Get URL parameter for updatedBy if needed
                const urlParams = new URL(request.url).searchParams;
                const deletedBy = urlParams.get('userId');

                const { results: orderItems } = await env.DB.prepare(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
                ).bind(id).all();
                for (const item of orderItems) {
                    await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.product_id).run();
                }
                await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id).run();
                await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();

                await logActivity(env, deletedBy, 'delete', 'order', id, `Deleted order ${id}`);

                return json({ success: true });
            }
            // ====== LEDGER ======
            if (path === '/api/ledger' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const limit = parseInt(urlParams.get('limit')) || 20;
                const offset = parseInt(urlParams.get('offset')) || 0;
                const search = urlParams.get('search');
                const type = urlParams.get('type');
                
                let query = 'SELECT * FROM ledger';
                let countQuery = 'SELECT COUNT(*) as total FROM ledger';
                let values = [];
                let whereClauses = [];
                
                if (search) {
                    whereClauses.push('(party LIKE ? OR category LIKE ? OR description LIKE ?)');
                    const sp = `%${search}%`;
                    values.push(sp, sp, sp);
                }
                if (type && type !== 'all') {
                    whereClauses.push('type = ?');
                    values.push(type);
                }
                
                if (whereClauses.length > 0) {
                    const whereStr = ' WHERE ' + whereClauses.join(' AND ');
                    query += whereStr;
                    countQuery += whereStr;
                }
                
                const { results: countResult } = await env.DB.prepare(countQuery).bind(...values).all();
                const total = countResult[0].total;
                
                query += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
                const { results } = await env.DB.prepare(query).bind(...values, limit, offset).all();
                
                const mappedResults = results.map(l => ({
                    id: l.id, type: l.type, category: l.category,
                    amount: l.amount, date: l.date, description: l.description,
                    party: l.party, createdBy: l.created_by
                }));
                
                return json({ results: mappedResults, total });
            }

            if (path === '/api/ledger' && method === 'POST') {
                const { type, category, description, amount, date, reference, createdBy } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO ledger (type, category, description, amount, date, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(type, category, description || '', amount, date, reference || '', createdBy || null).run();

                await logActivity(env, createdBy, 'create', 'ledger', result.meta.last_row_id, `Added ${type} logic of ₹${amount} for ${category}`);

                return json({ id: result.meta.last_row_id, type, category, description: description || '', amount, date, reference: reference || '', created_by: createdBy || null }, 201);
            }

            if (path.startsWith('/api/ledger/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                const urlParams = new URL(request.url).searchParams;
                const deletedBy = urlParams.get('userId');
                await env.DB.prepare('DELETE FROM ledger WHERE id = ?').bind(id).run();
                await logActivity(env, deletedBy, 'delete', 'ledger', id, `Deleted ledger entry ${id}`);
                return json({ success: true });
            }

            if (path.startsWith('/api/ledger/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const { type, category, description, amount, date, reference, updatedBy } = await request.json();
                await env.DB.prepare(
                    'UPDATE ledger SET type=?, category=?, description=?, amount=?, date=?, reference=? WHERE id=?'
                ).bind(type, category, description || '', amount, date, reference || '', id).run();
                await logActivity(env, updatedBy, 'update', 'ledger', id, `Updated ledger entry ₹${amount}`);
                return json({ success: true });
            }
            // ====== CRM DASHBOARD AGGREGATES ======
            if (path === '/api/crm/dashboard-stats' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const empFilter = urlParams.get('empFilter'); // Specific employee ID if provided
                
                let baseWhere = '1=1';
                let params = [];
                
                if (empFilter) {
                    baseWhere = '(created_by = ? OR closer_id = ? OR assigned_to = ?)';
                    params = [empFilter, empFilter, empFilter];
                }
                
                // Get core lead states for the whole funnel
                const query = `
                    SELECT 
                        COUNT(id) as totalLeads,
                        SUM(CASE WHEN converted = 1 THEN 1 ELSE 0 END) as totalClosed,
                        SUM(CASE WHEN status = 'hot' THEN 1 ELSE 0 END) as hot,
                        SUM(CASE WHEN status = 'warm' THEN 1 ELSE 0 END) as warm,
                        SUM(CASE WHEN status = 'cold' THEN 1 ELSE 0 END) as cold,
                        SUM(CASE WHEN status = 'not-interested' THEN 1 ELSE 0 END) as notInterested,
                        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid,
                        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending
                    FROM crm_leads
                    WHERE ${baseWhere}
                `;
                
                const stats = await env.DB.prepare(query).bind(...params).first() || {};
                
                // Get employee performance stats if we're looking at overall picture
                let employeeStats = [];
                if (!empFilter) {
                    const empQuery = `
                        SELECT 
                            u.id, 
                            u.name, 
                            u.role,
                            COUNT(DISTINCT l_created.id) as leadsEntered,
                            COUNT(DISTINCT l_closed.id) as leadsClosed
                        FROM users u
                        LEFT JOIN crm_leads l_created ON l_created.created_by = u.id
                        LEFT JOIN crm_leads l_closed ON l_closed.closer_id = u.id AND l_closed.converted = 1
                        WHERE u.role != 'super_admin' AND u.status = 'active'
                        GROUP BY u.id, u.name, u.role
                        ORDER BY leadsClosed DESC
                    `;
                    const { results } = await env.DB.prepare(empQuery).all();
                    
                    employeeStats = results.map(emp => {
                        const entered = emp.leadsEntered || 0;
                        const closed = emp.leadsClosed || 0;
                        return {
                            id: emp.id,
                            name: emp.name,
                            role: emp.role,
                            leadsEntered: entered,
                            leadsClosed: closed,
                            conversionRate: entered > 0 ? ((closed / entered) * 100).toFixed(1) : 0
                        };
                    });
                }
                
                return json({
                    totalLeads: stats.totalLeads || 0,
                    totalClosed: stats.totalClosed || 0,
                    breakdown: {
                        hot: stats.hot || 0,
                        warm: stats.warm || 0,
                        cold: stats.cold || 0,
                        notInterested: stats.notInterested || 0,
                        paid: stats.paid || 0,
                        pending: stats.pending || 0
                    },
                    employeeStats
                });
            }

            // ====== CRM LEADS ======
            if (path === '/api/crm/leads' && method === 'GET') {
                const urlParams = new URL(request.url).searchParams;
                const userId = urlParams.get('userId');
                const userRole = urlParams.get('role');
                const search = urlParams.get('search');
                const tab = urlParams.get('tab'); // 'my-leads', 'passing-in', 'passing-out'
                const status = urlParams.get('status'); // 'active', 'all', 'hot', 'warm', 'cold', 'not-interested'
                const payStatus = urlParams.get('payStatus'); // 'all', 'pending', 'paid'
                const starredOnly = urlParams.get('starredOnly') === 'true';
                const empFilter = urlParams.get('empFilter'); // userId for admins
                const limit = parseInt(urlParams.get('limit')) || 20;
                const offset = parseInt(urlParams.get('offset')) || 0;
                const isAdmin = userRole === 'super_admin';

                // For non-admin employees, cap at 30 if no explicit limit given
                let finalLimit = limit;
                if (!isAdmin && !urlParams.has('limit')) {
                    finalLimit = 30;
                }

                let query = 'SELECT * FROM crm_leads';
                let values = [];
                let whereClauses = [];

                if (!isAdmin && userId) {
                    // Logic from frontend CrmLeadsPage.jsx
                    if (tab === 'passing-in') {
                        whereClauses.push('is_passed = 1 AND assigned_to = ?');
                        values.push(userId);
                    } else if (tab === 'passing-out') {
                        whereClauses.push('is_passed = 1 AND passed_from = ?');
                        values.push(userId);
                    } else {
                        // 'my-leads'
                        whereClauses.push('((assigned_to = ? AND (is_passed = 1 OR is_passed = 0 OR is_passed IS NULL)) OR (created_by = ? AND (is_passed = 0 OR is_passed IS NULL)))');
                        values.push(userId, userId);
                    }
                }

                if (isAdmin && empFilter && empFilter !== 'all') {
                    const empId = parseInt(empFilter);
                    whereClauses.push('(created_by = ? OR assigned_to = ?)');
                    values.push(empId, empId);
                }

                if (status === 'active') {
                    whereClauses.push("status != 'not-interested'");
                } else if (status && status !== 'all') {
                    whereClauses.push("status = ?");
                    values.push(status);
                }

                if (payStatus && payStatus !== 'all') {
                    whereClauses.push("payment_status = ?");
                    values.push(payStatus);
                }

                if (starredOnly) {
                    whereClauses.push("is_starred = 1");
                }

                if (search) {
                    whereClauses.push('(name LIKE ? OR whatsapp LIKE ? OR location LIKE ?)');
                    const searchPattern = `%${search}%`;
                    values.push(searchPattern, searchPattern, searchPattern);
                }

                if (whereClauses.length > 0) {
                    query += ' WHERE ' + whereClauses.join(' AND ');
                }

                // Get Total Count
                let countQuery = 'SELECT COUNT(*) as total FROM crm_leads';
                if (whereClauses.length > 0) countQuery += ' WHERE ' + whereClauses.join(' AND ');
                const { results: countResult } = await env.DB.prepare(countQuery).bind(...values).all();
                const total = countResult[0].total;

                query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
                const finalValues = [...values, finalLimit, offset];

                const { results } = await env.DB.prepare(query).bind(...finalValues).all();
                return json({
                    results: results.map(l => ({
                        ...l,
                        interested_products: (() => { try { return JSON.parse(l.interested_products || '[]'); } catch { return []; } })(),
                        lead_products: (() => { try { return JSON.parse(l.lead_products || '[]'); } catch { return []; } })(),
                        sent_messages: (() => { try { return JSON.parse(l.sent_messages || '[]'); } catch { return []; } })(),
                        is_starred: l.is_starred === 1,
                        is_passed: l.is_passed === 1,
                        converted: l.converted === 1,
                    })),
                    total
                });
            }

            if (path === '/api/crm/leads' && method === 'POST') {
                const body = await request.json();
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                const productsJson = JSON.stringify(body.interested_products || []);
                const leadProductsJson = JSON.stringify(body.lead_products || []);
                const sentMessagesJson = JSON.stringify(body.sent_messages || []);
                await env.DB.prepare(
                    `INSERT INTO crm_leads (id, name, whatsapp, location, status, interested_products, lead_products, instagram, amount, paid_amount, payment_status, next_call_date, next_action_message, call_notes, not_interested_reason, is_starred, sent_messages, created_at, updated_at, created_by, assigned_to)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, body.name, body.whatsapp, body.location || '', body.status || 'hot',
                    productsJson, leadProductsJson, body.instagram || '',
                    body.amount || 0, body.paid_amount || 0,
                    body.payment_status || 'pending', body.next_call_date || '',
                    body.next_action_message || '', body.call_notes || '',
                    body.not_interested_reason || '', body.is_starred ? 1 : 0,
                    sentMessagesJson, now, now, body.createdBy, body.createdBy
                ).run();
                await logActivity(env, body.createdBy, 'create', 'crm_lead', id, `Added CRM Lead ${body.name}`);
                return json({ ...body, id, interested_products: body.interested_products || [], lead_products: body.lead_products || [], sent_messages: body.sent_messages || [], is_starred: !!body.is_starred, created_at: now, updated_at: now }, 201);
            }

            if (path.startsWith('/api/crm/leads/') && method === 'PUT') {
                const id = path.split('/').pop();
                const body = await request.json();
                const now = new Date().toISOString();
                const productsJson = JSON.stringify(body.interested_products || []);
                const leadProductsJson2 = JSON.stringify(body.lead_products || []);
                const sentMessagesJson = JSON.stringify(body.sent_messages || []);
                await env.DB.prepare(
                    `UPDATE crm_leads SET name=?, whatsapp=?, location=?, status=?, interested_products=?, lead_products=?, instagram=?, amount=?, paid_amount=?, payment_status=?, next_call_date=?, next_action_message=?, call_notes=?, not_interested_reason=?, is_starred=?, sent_messages=?, updated_at=?, assigned_to=?, is_passed=?, passed_from=?, converted=?, closer_id=? WHERE id=?`
                ).bind(
                    body.name, body.whatsapp, body.location || '', body.status,
                    productsJson, leadProductsJson2, body.instagram || '',
                    body.amount || 0, body.paid_amount || 0,
                    body.payment_status, body.next_call_date || '',
                    body.next_action_message || '', body.call_notes || '',
                    body.not_interested_reason || '', body.is_starred ? 1 : 0,
                    sentMessagesJson, now,
                    body.assigned_to !== undefined ? body.assigned_to : null,
                    body.is_passed ? 1 : 0,
                    body.passed_from !== undefined ? body.passed_from : null,
                    body.converted ? 1 : 0,
                    body.closer_id !== undefined ? body.closer_id : null,
                    id
                ).run();
                await logActivity(env, body.updatedBy, body.is_passed ? 'pass_lead' : 'update', 'crm_lead', id, body.is_passed ? `Passed CRM Lead ${body.name} to user ${body.assigned_to}` : `Updated CRM Lead ${body.name}`);
                return json({ success: true });
            }

            if (path.startsWith('/api/crm/leads/') && method === 'DELETE') {
                const id = path.split('/').pop();
                const urlParams = new URL(request.url).searchParams;
                const deletedBy = urlParams.get('userId');
                await env.DB.prepare('DELETE FROM crm_leads WHERE id = ?').bind(id).run();
                await logActivity(env, deletedBy, 'delete', 'crm_lead', id, `Deleted lead ${id}`);
                return json({ success: true });
            }

            // ====== CRM MESSAGE TEMPLATES ======
            if (path === '/api/crm/messages' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM crm_message_templates ORDER BY category, id').all();
                return json(results);
            }

            if (path === '/api/crm/messages' && method === 'POST') {
                const body = await request.json();
                const now = new Date().toISOString();
                const result = await env.DB.prepare(
                    'INSERT INTO crm_message_templates (category, title, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
                ).bind(body.category, body.title, body.message, now, now).run();
                return json({ id: result.meta.last_row_id, ...body, created_at: now, updated_at: now }, 201);
            }

            if (path.startsWith('/api/crm/messages/') && method === 'PUT') {
                const id = path.split('/').pop();
                const body = await request.json();
                const now = new Date().toISOString();
                await env.DB.prepare(
                    'UPDATE crm_message_templates SET category=?, title=?, message=?, updated_at=? WHERE id=?'
                ).bind(body.category, body.title, body.message, now, id).run();
                return json({ ...body, id: parseInt(id), updated_at: now });
            }

            if (path.startsWith('/api/crm/messages/') && method === 'DELETE') {
                const id = path.split('/').pop();
                await env.DB.prepare('DELETE FROM crm_message_templates WHERE id=?').bind(id).run();
                return json({ success: true });
            }

            return error('Not found', 404);
        } catch (err) {
            return error(err.message || 'Internal server error', 500);
        }
    },
};
