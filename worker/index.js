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
                    'SELECT id, username, name, email, role, role_label FROM users WHERE username = ? AND password = ?'
                ).bind(username, password).first();
                if (!user) return error('Invalid username or password', 401);

                await logActivity(env, user.id, 'login', 'user', user.id, 'User logged in');

                return json({
                    success: true,
                    user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, roleLabel: user.role_label },
                });
            }

            // ====== USERS ======
            if (path === '/api/users' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT id, username, name, email, role, role_label, created_at, status FROM users ORDER BY id DESC').all();
                return json(results);
            }
            if (path === '/api/users' && method === 'POST') {
                const { username, password, name, email, role, roleLabel, createdBy } = await request.json();
                const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
                if (existing) return error('Username already taken', 400);

                const result = await env.DB.prepare(
                    'INSERT INTO users (username, password, name, email, role, role_label) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(username, password, name, email || '', role, roleLabel).run();
                const newId = result.meta.last_row_id;
                await logActivity(env, createdBy, 'create', 'user', newId, `Created user ${username}`);
                return json({ id: newId, username, name, email, role, role_label: roleLabel }, 201);
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
                const { results } = await env.DB.prepare(`
                    SELECT a.*, u.name as user_name, u.role_label as user_role 
                    FROM activity_logs a 
                    LEFT JOIN users u ON a.user_id = u.id 
                    ORDER BY a.created_at DESC LIMIT 500
                `).all();
                return json(results);
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

            // ====== CUSTOMERS ======
            if (path === '/api/customers' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM customers ORDER BY id DESC').all();
                return json(results);
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
                // No tracking updatedBy here unless provided as query param or we assume it's super admin
                await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
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
                await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
                return json({ success: true });
            }

            // ====== ORDERS ======
            if (path === '/api/orders' && method === 'GET') {
                const { results: orders } = await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
                const { results: allItems } = await env.DB.prepare('SELECT * FROM order_items').all();
                const mapped = orders.map(o => ({
                    id: o.id, customerId: o.customer_id, subtotal: o.subtotal,
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
                    items: allItems.filter(i => i.order_id === o.id).map(i => ({
                        productId: i.product_id, quantity: i.quantity, price: i.price, gst: i.gst,
                    })),
                }));
                return json(mapped);
            }

            if (path === '/api/orders' && method === 'POST') {
                const { customerId, items, subtotal, discount, discountType, gstAmount, total, paymentStatus, paidAmount, createdBy, redispatchedFromId, trackingId, deliveryPartner, trackingLink } = await request.json();

                // Generate date-prefixed order ID in IST (DD-MM-YYYY-NNN, resets each day)
                const istOffset = 5.5 * 60 * 60000;
                const istDate = new Date(Date.now() + istOffset);
                const dd = String(istDate.getUTCDate()).padStart(2, '0');
                const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
                const yyyy = istDate.getUTCFullYear();
                const datePrefix = `${dd}-${mm}-${yyyy}`; // e.g. "07-03-2026"

                // Find the highest sequence number already used today
                // Date prefix is 10 chars, dash is char 11, sequence starts at char 12
                const maxResult = await env.DB.prepare(
                    "SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as mx FROM orders WHERE id LIKE ?"
                ).bind(`${datePrefix}-%`).first();
                const nextNum = (maxResult && maxResult.mx) ? maxResult.mx + 1 : 1;
                const orderId = `${datePrefix}-${String(nextNum).padStart(3, '0')}`; // e.g. "07-03-2026-001"

                const createdAt = new Date().toISOString();
                const finalPaidAmount = paymentStatus === 'paid' ? total : (paidAmount || 0);
                const initialTrackingId = trackingId ? trackingId.trim() : '';
                // If tracking ID provided at creation time, mark as shipped right away
                const initialStatus = initialTrackingId ? 'shipped' : 'pending';
                const shippedDate = initialTrackingId ? createdAt : null;

                await env.DB.prepare(
                    'INSERT INTO orders (id, customer_id, subtotal, discount, discount_type, gst_amount, total, paid_amount, payment_status, tracking_id, delivery_partner, tracking_link, status, shipped_date, created_at, created_by, is_redispatched, redispatched_from_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(orderId, customerId, subtotal, discount || 0, discountType || 'flat', gstAmount, total, finalPaidAmount, paymentStatus, initialTrackingId, deliveryPartner || '', trackingLink || '', initialStatus, shippedDate, createdAt, createdBy, redispatchedFromId ? 1 : 0, redispatchedFromId || null).run();

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

                if (body.returnReason !== undefined) { updates.push('return_reason = ?'); values.push(body.returnReason); }
                if (body.isRedispatched !== undefined) { updates.push('is_redispatched = ?'); values.push(body.isRedispatched ? 1 : 0); }

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

                    let logStr = `Updated order ${id}`;
                    if (body.status) logStr += `, status=${body.status}`;
                    if (body.trackingId) logStr += `, trackingId=${body.trackingId}`;
                    await logActivity(env, body.updatedBy, 'update', 'order', id, logStr);
                }
                return json({ success: true, autoShipped: setStatusToShipped });
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
                const { results } = await env.DB.prepare('SELECT * FROM ledger ORDER BY date DESC, id DESC').all();
                return json(results);
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
                await env.DB.prepare('DELETE FROM ledger WHERE id = ?').bind(id).run();
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

            // ====== CRM LEADS ======
            if (path === '/api/crm/leads' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM crm_leads ORDER BY created_at DESC').all();
                return json(results.map(l => ({
                    ...l,
                    interested_products: (() => { try { return JSON.parse(l.interested_products || '[]'); } catch { return []; } })(),
                    lead_products: (() => { try { return JSON.parse(l.lead_products || '[]'); } catch { return []; } })(),
                    sent_messages: (() => { try { return JSON.parse(l.sent_messages || '[]'); } catch { return []; } })(),
                    is_starred: l.is_starred === 1,
                })));
            }

            if (path === '/api/crm/leads' && method === 'POST') {
                const body = await request.json();
                const id = crypto.randomUUID();
                const now = new Date().toISOString();
                const productsJson = JSON.stringify(body.interested_products || []);
                const leadProductsJson = JSON.stringify(body.lead_products || []);
                const sentMessagesJson = JSON.stringify(body.sent_messages || []);
                await env.DB.prepare(
                    `INSERT INTO crm_leads (id, name, whatsapp, location, status, interested_products, lead_products, instagram, amount, paid_amount, payment_status, next_call_date, next_action_message, call_notes, not_interested_reason, is_starred, sent_messages, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    id, body.name, body.whatsapp, body.location || '', body.status || 'hot',
                    productsJson, leadProductsJson, body.instagram || '',
                    body.amount || 0, body.paid_amount || 0,
                    body.payment_status || 'pending', body.next_call_date || '',
                    body.next_action_message || '', body.call_notes || '',
                    body.not_interested_reason || '', body.is_starred ? 1 : 0,
                    sentMessagesJson, now, now
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
                    `UPDATE crm_leads SET name=?, whatsapp=?, location=?, status=?, interested_products=?, lead_products=?, instagram=?, amount=?, paid_amount=?, payment_status=?, next_call_date=?, next_action_message=?, call_notes=?, not_interested_reason=?, is_starred=?, sent_messages=?, updated_at=? WHERE id=?`
                ).bind(
                    body.name, body.whatsapp, body.location || '', body.status,
                    productsJson, leadProductsJson2, body.instagram || '',
                    body.amount || 0, body.paid_amount || 0,
                    body.payment_status, body.next_call_date || '',
                    body.next_action_message || '', body.call_notes || '',
                    body.not_interested_reason || '', body.is_starred ? 1 : 0,
                    sentMessagesJson, now, id
                ).run();
                await logActivity(env, body.updatedBy, 'update', 'crm_lead', id, `Updated CRM Lead ${body.name}`);
                return json({ success: true });
            }

            if (path.startsWith('/api/crm/leads/') && method === 'DELETE') {
                const id = path.split('/').pop();
                await env.DB.prepare('DELETE FROM crm_leads WHERE id = ?').bind(id).run();
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
