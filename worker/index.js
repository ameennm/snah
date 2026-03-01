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
                return json({
                    success: true,
                    user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, roleLabel: user.role_label },
                });
            }

            // ====== CUSTOMERS ======
            if (path === '/api/customers' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM customers ORDER BY id DESC').all();
                return json(results);
            }

            if (path === '/api/customers' && method === 'POST') {
                const { name, phone, address, area } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO customers (name, phone, address, area) VALUES (?, ?, ?, ?)'
                ).bind(name, phone, address || '', area || '').run();
                return json({ id: result.meta.last_row_id, name, phone, address: address || '', area: area || '' }, 201);
            }

            if (path.startsWith('/api/customers/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const { name, phone, address, area } = await request.json();
                await env.DB.prepare(
                    'UPDATE customers SET name = ?, phone = ?, address = ?, area = ? WHERE id = ?'
                ).bind(name, phone, address || '', area || '', id).run();
                return json({ id, name, phone, address: address || '', area: area || '' });
            }

            if (path.startsWith('/api/customers/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                await env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
                return json({ success: true });
            }

            // ====== PRODUCTS ======
            if (path === '/api/products' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY id DESC').all();
                return json(results.map(p => ({
                    id: p.id, name: p.name, purchasePrice: p.purchase_price,
                    sellingPrice: p.selling_price, gst: p.gst, stock: p.stock,
                })));
            }

            if (path === '/api/products' && method === 'POST') {
                const { name, purchasePrice, sellingPrice, gst, stock } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO products (name, purchase_price, selling_price, gst, stock) VALUES (?, ?, ?, ?, ?)'
                ).bind(name, purchasePrice, sellingPrice, gst, stock || 0).run();
                return json({ id: result.meta.last_row_id, name, purchasePrice, sellingPrice, gst, stock: stock || 0 }, 201);
            }

            if (path.startsWith('/api/products/') && method === 'PUT') {
                const id = parseInt(path.split('/').pop());
                const { name, purchasePrice, sellingPrice, gst, stock } = await request.json();
                await env.DB.prepare(
                    'UPDATE products SET name = ?, purchase_price = ?, selling_price = ?, gst = ?, stock = ? WHERE id = ?'
                ).bind(name, purchasePrice, sellingPrice, gst, stock, id).run();
                return json({ id, name, purchasePrice, sellingPrice, gst, stock });
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
                    gstAmount: o.gst_amount, total: o.total, paymentStatus: o.payment_status,
                    trackingId: o.tracking_id, status: o.status, createdAt: o.created_at, createdBy: o.created_by,
                    items: allItems.filter(i => i.order_id === o.id).map(i => ({
                        productId: i.product_id, quantity: i.quantity, price: i.price, gst: i.gst,
                    })),
                }));
                return json(mapped);
            }

            if (path === '/api/orders' && method === 'POST') {
                const { customerId, items, subtotal, gstAmount, total, paymentStatus, createdBy } = await request.json();

                // Generate unique order ID
                const maxResult = await env.DB.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1").first();
                let nextNum = 1;
                if (maxResult && maxResult.id) {
                    const num = parseInt(maxResult.id.replace('ORD-', ''));
                    if (!isNaN(num)) nextNum = num + 1;
                }
                const orderId = `ORD-${String(nextNum).padStart(3, '0')}`;
                const createdAt = new Date().toISOString();

                await env.DB.prepare(
                    'INSERT INTO orders (id, customer_id, subtotal, gst_amount, total, payment_status, tracking_id, status, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(orderId, customerId, subtotal, gstAmount, total, paymentStatus, '', 'pending', createdAt, createdBy).run();

                for (const item of items) {
                    await env.DB.prepare(
                        'INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES (?, ?, ?, ?, ?)'
                    ).bind(orderId, item.productId, item.quantity, item.price, item.gst).run();
                    await env.DB.prepare(
                        'UPDATE products SET stock = stock - ? WHERE id = ?'
                    ).bind(item.quantity, item.productId).run();
                }

                return json({ id: orderId, customerId, items, subtotal, gstAmount, total, paymentStatus, status: 'pending', createdAt, trackingId: '' }, 201);
            }

            if (path.startsWith('/api/orders/') && method === 'PUT') {
                const id = path.split('/').pop();
                const body = await request.json();
                const updates = [];
                const values = [];
                if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
                if (body.paymentStatus !== undefined) { updates.push('payment_status = ?'); values.push(body.paymentStatus); }
                if (body.trackingId !== undefined) { updates.push('tracking_id = ?'); values.push(body.trackingId); }
                if (updates.length > 0) {
                    values.push(id);
                    await env.DB.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
                }
                return json({ success: true });
            }

            if (path.startsWith('/api/orders/') && method === 'DELETE') {
                const id = path.split('/').pop();
                const { results: orderItems } = await env.DB.prepare(
                    'SELECT product_id, quantity FROM order_items WHERE order_id = ?'
                ).bind(id).all();
                for (const item of orderItems) {
                    await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(item.quantity, item.product_id).run();
                }
                await env.DB.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id).run();
                await env.DB.prepare('DELETE FROM orders WHERE id = ?').bind(id).run();
                return json({ success: true });
            }

            // ====== LEDGER ======
            if (path === '/api/ledger' && method === 'GET') {
                const { results } = await env.DB.prepare('SELECT * FROM ledger ORDER BY date DESC, id DESC').all();
                return json(results);
            }

            if (path === '/api/ledger' && method === 'POST') {
                const { type, category, description, amount, date, reference } = await request.json();
                const result = await env.DB.prepare(
                    'INSERT INTO ledger (type, category, description, amount, date, reference) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(type, category, description || '', amount, date, reference || '').run();
                return json({ id: result.meta.last_row_id, type, category, description, amount, date, reference }, 201);
            }

            if (path.startsWith('/api/ledger/') && method === 'DELETE') {
                const id = parseInt(path.split('/').pop());
                await env.DB.prepare('DELETE FROM ledger WHERE id = ?').bind(id).run();
                return json({ success: true });
            }

            return error('Not found', 404);
        } catch (err) {
            return error(err.message || 'Internal server error', 500);
        }
    },
};
