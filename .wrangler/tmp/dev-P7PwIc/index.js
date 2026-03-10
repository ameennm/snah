var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}
__name(json, "json");
function error(message, status = 400) {
  return json({ error: message }, status);
}
__name(error, "error");
async function logActivity(env, userId, action, entity, entityId, details = "") {
  if (!userId) return;
  try {
    await env.DB.prepare("INSERT INTO activity_logs (user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)").bind(userId, action, entity, String(entityId), details).run();
  } catch (e) {
    console.error("Activity log error:", e);
  }
}
__name(logActivity, "logActivity");
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/api/login" && method === "POST") {
        const { username, password } = await request.json();
        const user = await env.DB.prepare(
          "SELECT id, username, name, email, role, roles, role_label, status FROM users WHERE username = ? AND password = ?"
        ).bind(username, password).first();
        if (!user) return error("Invalid username or password", 401);
        if (user.status === "suspended") return error("Account is suspended", 403);
        await logActivity(env, user.id, "login", "user", user.id, "User logged in");
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
                if (user.roles && user.roles !== "[]") return JSON.parse(user.roles);
                return user.role ? [user.role] : [];
              } catch (e) {
                return user.role ? [user.role] : [];
              }
            })(),
            roleLabel: user.role_label
          }
        });
      }
      if (path === "/api/users" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT id, username, name, email, role, roles, role_label, created_at, status FROM users ORDER BY id DESC").all();
        return json(results.map((u) => {
          let parsedRoles = [];
          try {
            if (u.roles && u.roles !== "[]") {
              parsedRoles = JSON.parse(u.roles);
            } else if (u.role) {
              parsedRoles = [u.role];
            }
          } catch (e) {
            console.error("Error parsing roles for user", u.id, e);
            if (u.role) parsedRoles = [u.role];
          }
          return { ...u, roles: parsedRoles };
        }));
      }
      if (path === "/api/users" && method === "POST") {
        const { username, password, name, email, role, roles, roleLabel, createdBy } = await request.json();
        const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (existing) return error("Username already taken", 400);
        const rolesJson = JSON.stringify(roles || []);
        const result = await env.DB.prepare(
          "INSERT INTO users (username, password, name, email, role, roles, role_label) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(username, password, name, email || "", role || "", rolesJson, roleLabel || "").run();
        const newId = result.meta.last_row_id;
        await logActivity(env, createdBy, "create", "user", newId, `Created user ${username}`);
        return json({ id: newId, username, name, email, role, roles, role_label: roleLabel }, 201);
      }
      if (path.startsWith("/api/users/") && method === "PUT") {
        const id = parseInt(path.split("/").pop());
        const body = await request.json();
        const updates = [];
        const values = [];
        if (body.name) {
          updates.push("name = ?");
          values.push(body.name);
        }
        if (body.username) {
          updates.push("username = ?");
          values.push(body.username);
        }
        if (body.email !== void 0) {
          updates.push("email = ?");
          values.push(body.email);
        }
        if (body.role) {
          updates.push("role = ?");
          values.push(body.role);
        }
        if (body.roles) {
          const rolesArray = Array.isArray(body.roles) ? body.roles : [];
          updates.push("roles = ?");
          values.push(JSON.stringify(rolesArray));
          if (!body.role && rolesArray.length > 0) {
            updates.push("role = ?");
            values.push(rolesArray[0]);
          }
        }
        if (body.roleLabel) {
          updates.push("role_label = ?");
          values.push(body.roleLabel);
        }
        if (body.password) {
          updates.push("password = ?");
          values.push(body.password);
        }
        if (body.status) {
          updates.push("status = ?");
          values.push(body.status);
        }
        if (updates.length > 0) {
          values.push(id);
          await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
          await logActivity(env, body.updatedBy, "update", "user", id, `Updated user ${id}`);
        }
        return json({ success: true });
      }
      if (path === "/api/activity_logs" && method === "GET") {
        const { results } = await env.DB.prepare(`
                    SELECT a.*, u.name as user_name, u.role_label as user_role 
                    FROM activity_logs a 
                    LEFT JOIN users u ON a.user_id = u.id 
                    ORDER BY a.created_at DESC LIMIT 500
                `).all();
        return json(results);
      }
      if (path === "/api/delivery_partners" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM delivery_partners ORDER BY name").all();
        return json(results);
      }
      if (path === "/api/delivery_partners" && method === "POST") {
        const { name, trackingUrlTemplate } = await request.json();
        const result = await env.DB.prepare(
          "INSERT INTO delivery_partners (name, tracking_url_template) VALUES (?, ?)"
        ).bind(name, trackingUrlTemplate).run();
        return json({ id: result.meta.last_row_id, name, tracking_url_template: trackingUrlTemplate }, 201);
      }
      if (path.startsWith("/api/delivery_partners/") && method === "DELETE") {
        const id = parseInt(path.split("/").pop());
        await env.DB.prepare("DELETE FROM delivery_partners WHERE id = ?").bind(id).run();
        return json({ success: true });
      }
      if (path === "/api/customers" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM customers ORDER BY id DESC").all();
        return json(results);
      }
      if (path === "/api/customers" && method === "POST") {
        const { name, phone, address, area, createdBy } = await request.json();
        const existing = await env.DB.prepare("SELECT id FROM customers WHERE phone = ?").bind(phone).first();
        if (existing) return error("A customer with this mobile number already exists.", 400);
        const result = await env.DB.prepare(
          "INSERT INTO customers (name, phone, address, area) VALUES (?, ?, ?, ?)"
        ).bind(name, phone, address || "", area || "").run();
        const newId = result.meta.last_row_id;
        await logActivity(env, createdBy, "create", "customer", newId, `Created customer ${name} (${phone})`);
        return json({ id: newId, name, phone, address: address || "", area: area || "" }, 201);
      }
      if (path.startsWith("/api/customers/") && method === "PUT") {
        const id = parseInt(path.split("/").pop());
        const { name, phone, address, area, updatedBy } = await request.json();
        const existing = await env.DB.prepare("SELECT id FROM customers WHERE phone = ? AND id != ?").bind(phone, id).first();
        if (existing) return error("A customer with this mobile number already exists.", 400);
        await env.DB.prepare(
          "UPDATE customers SET name = ?, phone = ?, address = ?, area = ? WHERE id = ?"
        ).bind(name, phone, address || "", area || "", id).run();
        await logActivity(env, updatedBy, "update", "customer", id, `Updated customer ${name}`);
        return json({ id, name, phone, address: address || "", area: area || "" });
      }
      if (path.startsWith("/api/customers/") && method === "DELETE") {
        const id = parseInt(path.split("/").pop());
        const urlParams = new URL(request.url).searchParams;
        const deletedBy = urlParams.get("userId");
        await env.DB.prepare("DELETE FROM customers WHERE id = ?").bind(id).run();
        await logActivity(env, deletedBy, "delete", "customer", id, `Deleted customer ${id}`);
        return json({ success: true });
      }
      if (path === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM products ORDER BY id DESC").all();
        return json(results.map((p) => ({
          id: p.id,
          name: p.name,
          sellingPrice: p.selling_price,
          gst: p.gst,
          stock: p.stock
        })));
      }
      if (path === "/api/products" && method === "POST") {
        const { name, sellingPrice, gst, stock } = await request.json();
        const result = await env.DB.prepare(
          "INSERT INTO products (name, selling_price, gst, stock) VALUES (?, ?, ?, ?)"
        ).bind(name, sellingPrice, gst, stock || 0).run();
        return json({ id: result.meta.last_row_id, name, sellingPrice, gst, stock: stock || 0 }, 201);
      }
      if (path.startsWith("/api/products/") && method === "PUT") {
        const id = parseInt(path.split("/").pop());
        const { name, sellingPrice, gst, stock } = await request.json();
        await env.DB.prepare(
          "UPDATE products SET name = ?, selling_price = ?, gst = ?, stock = ? WHERE id = ?"
        ).bind(name, sellingPrice, gst, stock, id).run();
        return json({ id, name, sellingPrice, gst, stock });
      }
      if (path.startsWith("/api/products/") && method === "DELETE") {
        const id = parseInt(path.split("/").pop());
        const urlParams = new URL(request.url).searchParams;
        const deletedBy = urlParams.get("userId");
        await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
        await logActivity(env, deletedBy, "delete", "product", id, `Deleted product ${id}`);
        return json({ success: true });
      }
      if (path === "/api/orders" && method === "GET") {
        const { results: orders } = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
        const { results: allItems } = await env.DB.prepare("SELECT * FROM order_items").all();
        const mapped = orders.map((o) => ({
          id: o.id,
          customerId: o.customer_id,
          subtotal: o.subtotal,
          discount: o.discount || 0,
          discountType: o.discount_type || "flat",
          gstAmount: o.gst_amount,
          total: o.total,
          paidAmount: o.paid_amount || 0,
          paymentStatus: o.payment_status,
          trackingId: o.tracking_id,
          deliveryPartner: o.delivery_partner || "",
          trackingLink: o.tracking_link || "",
          status: o.status,
          returnReason: o.return_reason || "",
          isRedispatched: o.is_redispatched === 1,
          redispatchedFromId: o.redispatched_from_id || null,
          shippedDate: o.shipped_date || null,
          deliveredDate: o.delivered_date || null,
          createdAt: o.created_at,
          createdBy: o.created_by,
          items: allItems.filter((i) => i.order_id === o.id).map((i) => ({
            productId: i.product_id,
            quantity: i.quantity,
            price: i.price,
            gst: i.gst
          }))
        }));
        return json(mapped);
      }
      if (path === "/api/orders" && method === "POST") {
        const { customerId, items, subtotal, discount, discountType, gstAmount, total, paymentStatus, paidAmount, createdBy, redispatchedFromId, trackingId, deliveryPartner, trackingLink, createdAt: bodyCreatedAt } = await request.json();
        let orderDateStr;
        let createdAt;
        if (bodyCreatedAt) {
          orderDateStr = new Date(bodyCreatedAt);
          createdAt = bodyCreatedAt;
        } else {
          const istOffset = 5.5 * 60 * 6e4;
          orderDateStr = new Date(Date.now() + istOffset);
          createdAt = (/* @__PURE__ */ new Date()).toISOString();
        }
        const dd = String(bodyCreatedAt ? orderDateStr.getUTCDate() : orderDateStr.getUTCDate()).padStart(2, "0");
        const mm = String(bodyCreatedAt ? orderDateStr.getUTCMonth() + 1 : orderDateStr.getUTCMonth() + 1).padStart(2, "0");
        const yyyy = bodyCreatedAt ? orderDateStr.getUTCFullYear() : orderDateStr.getUTCFullYear();
        const datePrefix = `${dd}-${mm}-${yyyy}`;
        const maxResult = await env.DB.prepare(
          "SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as mx FROM orders WHERE id LIKE ?"
        ).bind(`${datePrefix}-%`).first();
        const nextNum = maxResult && maxResult.mx ? maxResult.mx + 1 : 1;
        const orderId = `${datePrefix}-${String(nextNum).padStart(3, "0")}`;
        const finalPaidAmount = paymentStatus === "paid" ? total : paidAmount || 0;
        const initialTrackingId = trackingId ? trackingId.trim() : "";
        const initialStatus = initialTrackingId ? "shipped" : "pending";
        const shippedDate = initialTrackingId ? createdAt : null;
        await env.DB.prepare(
          "INSERT INTO orders (id, customer_id, subtotal, discount, discount_type, gst_amount, total, paid_amount, payment_status, tracking_id, delivery_partner, tracking_link, status, shipped_date, created_at, created_by, is_redispatched, redispatched_from_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(orderId, customerId, subtotal, discount || 0, discountType || "flat", gstAmount, total, finalPaidAmount, paymentStatus, initialTrackingId, deliveryPartner || "", trackingLink || "", initialStatus, shippedDate, createdAt, createdBy, redispatchedFromId ? 1 : 0, redispatchedFromId || null).run();
        for (const item of items) {
          await env.DB.prepare(
            "INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES (?, ?, ?, ?, ?)"
          ).bind(orderId, item.productId, item.quantity, item.price, item.gst).run();
          await env.DB.prepare(
            "UPDATE products SET stock = stock - ? WHERE id = ?"
          ).bind(item.quantity, item.productId).run();
        }
        await logActivity(env, createdBy, "create", "order", orderId, `Created order ${orderId} for \u20B9${total}`);
        return json({ id: orderId, customerId, items, subtotal, discount: discount || 0, discountType: discountType || "flat", gstAmount, total, paidAmount: finalPaidAmount, paymentStatus, status: initialStatus, createdAt, trackingId: initialTrackingId, deliveryPartner: deliveryPartner || "", trackingLink: trackingLink || "", shippedDate, isRedispatched: !!redispatchedFromId, redispatchedFromId: redispatchedFromId || null }, 201);
      }
      if (path.startsWith("/api/orders/") && method === "PUT") {
        const id = path.split("/").pop();
        const body = await request.json();
        const updates = [];
        const values = [];
        let setStatusToShipped = false;
        if (body.status !== void 0) {
          updates.push("status = ?");
          values.push(body.status);
          if (body.status === "shipped") {
            updates.push("shipped_date = ?");
            values.push((/* @__PURE__ */ new Date()).toISOString());
          } else if (body.status === "delivered") {
            updates.push("delivered_date = ?");
            values.push((/* @__PURE__ */ new Date()).toISOString());
          }
        }
        if (body.paymentStatus !== void 0) {
          updates.push("payment_status = ?");
          values.push(body.paymentStatus);
        }
        if (body.paidAmount !== void 0) {
          updates.push("paid_amount = ?");
          values.push(body.paidAmount);
        }
        if (body.trackingId !== void 0) {
          updates.push("tracking_id = ?");
          values.push(body.trackingId);
          if (body.trackingId && !body.status && body.currentStatus !== "shipped" && body.currentStatus !== "delivered") {
            setStatusToShipped = true;
          }
        }
        if (setStatusToShipped) {
          updates.push("status = ?");
          values.push("shipped");
          updates.push("shipped_date = ?");
          values.push((/* @__PURE__ */ new Date()).toISOString());
          body.status = "shipped";
        }
        if (body.deliveryPartner !== void 0) {
          updates.push("delivery_partner = ?");
          values.push(body.deliveryPartner);
        }
        if (body.trackingLink !== void 0) {
          updates.push("tracking_link = ?");
          values.push(body.trackingLink);
        }
        let newId = id;
        if (body.createdAt !== void 0) {
          updates.push("created_at = ?");
          values.push(body.createdAt);
          const orderDateStr = new Date(body.createdAt);
          const dd = String(orderDateStr.getUTCDate()).padStart(2, "0");
          const mm = String(orderDateStr.getUTCMonth() + 1).padStart(2, "0");
          const yyyy = orderDateStr.getUTCFullYear();
          const newDatePrefix = `${dd}-${mm}-${yyyy}`;
          if (!id.startsWith(newDatePrefix)) {
            const maxResult = await env.DB.prepare(
              "SELECT MAX(CAST(SUBSTR(id, 12) AS INTEGER)) as mx FROM orders WHERE id LIKE ?"
            ).bind(`${newDatePrefix}-%`).first();
            const nextNum = maxResult && maxResult.mx ? maxResult.mx + 1 : 1;
            newId = `${newDatePrefix}-${String(nextNum).padStart(3, "0")}`;
            updates.push("id = ?");
            values.push(newId);
          }
        }
        if (body.returnReason !== void 0) {
          updates.push("return_reason = ?");
          values.push(body.returnReason);
        }
        if (body.isRedispatched !== void 0) {
          updates.push("is_redispatched = ?");
          values.push(body.isRedispatched ? 1 : 0);
        }
        if (body.customerId !== void 0) {
          updates.push("customer_id = ?");
          values.push(body.customerId);
        }
        if (body.subtotal !== void 0) {
          updates.push("subtotal = ?");
          values.push(body.subtotal);
        }
        if (body.discount !== void 0) {
          updates.push("discount = ?");
          values.push(body.discount);
        }
        if (body.discountType !== void 0) {
          updates.push("discount_type = ?");
          values.push(body.discountType);
        }
        if (body.gstAmount !== void 0) {
          updates.push("gst_amount = ?");
          values.push(body.gstAmount);
        }
        if (body.total !== void 0) {
          updates.push("total = ?");
          values.push(body.total);
        }
        if (body.items !== void 0) {
          const { results: oldItems } = await env.DB.prepare(
            "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
          ).bind(id).all();
          for (const item of oldItems) {
            await env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(item.quantity, item.product_id).run();
          }
          await env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
          for (const item of body.items) {
            await env.DB.prepare(
              "INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES (?, ?, ?, ?, ?)"
            ).bind(id, item.productId, item.quantity, item.price, item.gst).run();
            await env.DB.prepare(
              "UPDATE products SET stock = stock - ? WHERE id = ?"
            ).bind(item.quantity, item.productId).run();
          }
        }
        if (body.status === "returned" && body.restoreStock) {
          const { results: orderItems } = await env.DB.prepare(
            "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
          ).bind(id).all();
          for (const item of orderItems) {
            await env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(item.quantity, item.product_id).run();
          }
        }
        if (updates.length > 0) {
          values.push(id);
          await env.DB.prepare(`UPDATE orders SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
          if (newId !== id) {
            try {
              await env.DB.prepare("UPDATE order_items SET order_id = ? WHERE order_id = ?").bind(newId, id).run();
              await env.DB.prepare("UPDATE activity_logs SET entity_id = ? WHERE entity = ? AND entity_id = ?").bind(newId, "order", id).run();
            } catch (e) {
              console.error("Failed to update related records for new order ID:", e);
            }
          }
          let logStr = `Updated order ${id}`;
          if (newId !== id) logStr += ` to ${newId}`;
          if (body.status) logStr += `, status=${body.status}`;
          if (body.trackingId) logStr += `, trackingId=${body.trackingId}`;
          await logActivity(env, body.updatedBy, "update", "order", newId, logStr);
        }
        return json({ success: true, autoShipped: setStatusToShipped, newId });
      }
      if (path.startsWith("/api/orders/") && method === "DELETE") {
        const id = path.split("/").pop();
        const urlParams = new URL(request.url).searchParams;
        const deletedBy = urlParams.get("userId");
        const { results: orderItems } = await env.DB.prepare(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
        ).bind(id).all();
        for (const item of orderItems) {
          await env.DB.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").bind(item.quantity, item.product_id).run();
        }
        await env.DB.prepare("DELETE FROM order_items WHERE order_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM orders WHERE id = ?").bind(id).run();
        await logActivity(env, deletedBy, "delete", "order", id, `Deleted order ${id}`);
        return json({ success: true });
      }
      if (path === "/api/ledger" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM ledger ORDER BY date DESC, id DESC").all();
        return json(results.map((l) => ({
          id: l.id,
          type: l.type,
          category: l.category,
          description: l.description,
          amount: l.amount,
          date: l.date,
          reference: l.reference,
          created_by: l.created_by
        })));
      }
      if (path === "/api/ledger" && method === "POST") {
        const { type, category, description, amount, date, reference, createdBy } = await request.json();
        const result = await env.DB.prepare(
          "INSERT INTO ledger (type, category, description, amount, date, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(type, category, description || "", amount, date, reference || "", createdBy || null).run();
        await logActivity(env, createdBy, "create", "ledger", result.meta.last_row_id, `Added ${type} logic of \u20B9${amount} for ${category}`);
        return json({ id: result.meta.last_row_id, type, category, description: description || "", amount, date, reference: reference || "", created_by: createdBy || null }, 201);
      }
      if (path.startsWith("/api/ledger/") && method === "DELETE") {
        const id = parseInt(path.split("/").pop());
        const urlParams = new URL(request.url).searchParams;
        const deletedBy = urlParams.get("userId");
        await env.DB.prepare("DELETE FROM ledger WHERE id = ?").bind(id).run();
        await logActivity(env, deletedBy, "delete", "ledger", id, `Deleted ledger entry ${id}`);
        return json({ success: true });
      }
      if (path.startsWith("/api/ledger/") && method === "PUT") {
        const id = parseInt(path.split("/").pop());
        const { type, category, description, amount, date, reference, updatedBy } = await request.json();
        await env.DB.prepare(
          "UPDATE ledger SET type=?, category=?, description=?, amount=?, date=?, reference=? WHERE id=?"
        ).bind(type, category, description || "", amount, date, reference || "", id).run();
        await logActivity(env, updatedBy, "update", "ledger", id, `Updated ledger entry \u20B9${amount}`);
        return json({ success: true });
      }
      if (path === "/api/crm/leads" && method === "GET") {
        const urlParams = new URL(request.url).searchParams;
        const userId = urlParams.get("userId");
        const userRole = urlParams.get("role");
        const isAdmin = userRole === "super_admin";
        let query = "SELECT * FROM crm_leads";
        let values = [];
        if (!isAdmin && userId) {
          query += " WHERE created_by = ? OR assigned_to = ?";
          values.push(userId, userId);
        }
        query += " ORDER BY created_at DESC";
        const { results } = await env.DB.prepare(query).bind(...values).all();
        return json(results.map((l) => ({
          ...l,
          interested_products: (() => {
            try {
              return JSON.parse(l.interested_products || "[]");
            } catch {
              return [];
            }
          })(),
          lead_products: (() => {
            try {
              return JSON.parse(l.lead_products || "[]");
            } catch {
              return [];
            }
          })(),
          sent_messages: (() => {
            try {
              return JSON.parse(l.sent_messages || "[]");
            } catch {
              return [];
            }
          })(),
          is_starred: l.is_starred === 1,
          is_passed: l.is_passed === 1,
          converted: l.converted === 1
        })));
      }
      if (path === "/api/crm/leads" && method === "POST") {
        const body = await request.json();
        const id = crypto.randomUUID();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const productsJson = JSON.stringify(body.interested_products || []);
        const leadProductsJson = JSON.stringify(body.lead_products || []);
        const sentMessagesJson = JSON.stringify(body.sent_messages || []);
        await env.DB.prepare(
          `INSERT INTO crm_leads (id, name, whatsapp, location, status, interested_products, lead_products, instagram, amount, paid_amount, payment_status, next_call_date, next_action_message, call_notes, not_interested_reason, is_starred, sent_messages, created_at, updated_at, created_by, assigned_to)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          body.name,
          body.whatsapp,
          body.location || "",
          body.status || "hot",
          productsJson,
          leadProductsJson,
          body.instagram || "",
          body.amount || 0,
          body.paid_amount || 0,
          body.payment_status || "pending",
          body.next_call_date || "",
          body.next_action_message || "",
          body.call_notes || "",
          body.not_interested_reason || "",
          body.is_starred ? 1 : 0,
          sentMessagesJson,
          now,
          now,
          body.createdBy,
          body.createdBy
        ).run();
        await logActivity(env, body.createdBy, "create", "crm_lead", id, `Added CRM Lead ${body.name}`);
        return json({ ...body, id, interested_products: body.interested_products || [], lead_products: body.lead_products || [], sent_messages: body.sent_messages || [], is_starred: !!body.is_starred, created_at: now, updated_at: now }, 201);
      }
      if (path.startsWith("/api/crm/leads/") && method === "PUT") {
        const id = path.split("/").pop();
        const body = await request.json();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const productsJson = JSON.stringify(body.interested_products || []);
        const leadProductsJson2 = JSON.stringify(body.lead_products || []);
        const sentMessagesJson = JSON.stringify(body.sent_messages || []);
        await env.DB.prepare(
          `UPDATE crm_leads SET name=?, whatsapp=?, location=?, status=?, interested_products=?, lead_products=?, instagram=?, amount=?, paid_amount=?, payment_status=?, next_call_date=?, next_action_message=?, call_notes=?, not_interested_reason=?, is_starred=?, sent_messages=?, updated_at=?, assigned_to=?, is_passed=?, passed_from=?, converted=?, closer_id=? WHERE id=?`
        ).bind(
          body.name,
          body.whatsapp,
          body.location || "",
          body.status,
          productsJson,
          leadProductsJson2,
          body.instagram || "",
          body.amount || 0,
          body.paid_amount || 0,
          body.payment_status,
          body.next_call_date || "",
          body.next_action_message || "",
          body.call_notes || "",
          body.not_interested_reason || "",
          body.is_starred ? 1 : 0,
          sentMessagesJson,
          now,
          body.assigned_to !== void 0 ? body.assigned_to : null,
          body.is_passed ? 1 : 0,
          body.passed_from !== void 0 ? body.passed_from : null,
          body.converted ? 1 : 0,
          body.closer_id !== void 0 ? body.closer_id : null,
          id
        ).run();
        await logActivity(env, body.updatedBy, body.is_passed ? "pass_lead" : "update", "crm_lead", id, body.is_passed ? `Passed CRM Lead ${body.name} to user ${body.assigned_to}` : `Updated CRM Lead ${body.name}`);
        return json({ success: true });
      }
      if (path.startsWith("/api/crm/leads/") && method === "DELETE") {
        const id = path.split("/").pop();
        const urlParams = new URL(request.url).searchParams;
        const deletedBy = urlParams.get("userId");
        await env.DB.prepare("DELETE FROM crm_leads WHERE id = ?").bind(id).run();
        await logActivity(env, deletedBy, "delete", "crm_lead", id, `Deleted lead ${id}`);
        return json({ success: true });
      }
      if (path === "/api/crm/messages" && method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM crm_message_templates ORDER BY category, id").all();
        return json(results);
      }
      if (path === "/api/crm/messages" && method === "POST") {
        const body = await request.json();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const result = await env.DB.prepare(
          "INSERT INTO crm_message_templates (category, title, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(body.category, body.title, body.message, now, now).run();
        return json({ id: result.meta.last_row_id, ...body, created_at: now, updated_at: now }, 201);
      }
      if (path.startsWith("/api/crm/messages/") && method === "PUT") {
        const id = path.split("/").pop();
        const body = await request.json();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          "UPDATE crm_message_templates SET category=?, title=?, message=?, updated_at=? WHERE id=?"
        ).bind(body.category, body.title, body.message, now, id).run();
        return json({ ...body, id: parseInt(id), updated_at: now });
      }
      if (path.startsWith("/api/crm/messages/") && method === "DELETE") {
        const id = path.split("/").pop();
        await env.DB.prepare("DELETE FROM crm_message_templates WHERE id=?").bind(id).run();
        return json({ success: true });
      }
      return error("Not found", 404);
    } catch (err) {
      return error(err.message || "Internal server error", 500);
    }
  }
};

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error2 = reduceError(e);
    return Response.json(error2, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-uyhw3i/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-uyhw3i/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
