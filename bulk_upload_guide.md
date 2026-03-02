# How to bulk upload data

If you have bulk data to upload in the future in a format like this:
```
Name – Location – Products (Full name with quantity)

Ligna Kasim – Kerala – 1 Baby Cream
Sufiya – Kerala – 1 Baby Cream (COD)
```

You can use a script to convert this into SQL insert statements that you then run against the Cloudflare D1 database.
Here is an example script `generate_sql.cjs` that you can modify and run using `node generate_sql.cjs`:

```javascript
const fs = require('fs');

// 1. Paste your data here
const data = `Ligna Kasim – Kerala – 1 Baby Cream
Sufiya – Kerala – 1 Baby Cream (COD)
Aysha Jumana – Kerala – 1 Skin Oil
Rinsha – Kerala – 1 Baby Oil`;

// 2. Define your existing product mappings
const productsMap = {
    'baby oil': { id: 1, name: 'Baby Oil', price: 850, gst: 12 },
    'hair oil': { id: 2, name: 'Hair Oil', price: 850, gst: 12 },
    'skin oil': { id: 3, name: 'Skin  Oil', price: 850, gst: 5 },
    'baby cream': { id: 4, name: 'baby cream', price: 600, gst: 5 },
};

let sql = '';

// Determine your starting IDs by checking the DB first!
let customerId = 100;
let basePhone = 9800000000;
let orderNum = 100;

const lines = data.split('\n').filter(line => line.trim() !== '');

lines.forEach((line) => {
    const parts = line.split(' – ');
    if (parts.length < 3) return;

    const name = parts[0].trim();
    const location = parts[1].trim();
    let productStr = parts[2].trim();
    
    let isCOD = false;
    if (productStr.includes('(COD)')) {
        isCOD = true;
        productStr = productStr.replace('(COD)', '').trim();
    }

    const phone = String(basePhone++);
    const cleanName = name.replace(/'/g, "''");
    const cleanLocation = location.replace(/'/g, "''");

    sql += "INSERT INTO customers (id, name, phone, area) VALUES (" + customerId + ", '" + cleanName + "', '" + phone + "', '" + cleanLocation + "');\n";
    const orderId = "ORD-2026-03-" + String(orderNum).padStart(3, '0');
    
    const items = productStr.split(',').map(s => s.trim());
    
    let subtotal = 0;
    let totalGst = 0;
    
    const orderItemsSql = [];

    items.forEach(item => {
        const match = item.match(/^(\d+)\s+(.+)$/);
        if (match) {
            const qty = parseInt(match[1], 10);
            const pName = match[2].trim().toLowerCase();
            
            const product = productsMap[pName];
            if (product) {
                const itemSubtotal = product.price * qty;
                const gstMultiplier = product.gst / 100;
                
                const itemGst = itemSubtotal * gstMultiplier;
                
                subtotal += itemSubtotal;
                totalGst += itemGst;
                
                orderItemsSql.push("INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES ('" + orderId + "', " + product.id + ", " + qty + ", " + product.price + ", " + product.gst + ");");
            } else {
                console.log("Product not found: " + pName);
            }
        }
    });

    const total = subtotal + totalGst;
    // Define payment status rules here
    const paymentStatus = 'paid';
    
    // Set fixed creation date if needed
    const orderDate = '2026-01-01 10:00:00';
    
    // Add the order statement
    sql += "INSERT INTO orders (id, customer_id, subtotal, gst_amount, total, paid_amount, payment_status, status, created_at, created_by) VALUES ('" + orderId + "', " + customerId + ", " + subtotal + ", " + totalGst + ", " + total + ", " + total + ", '" + paymentStatus + "', 'delivered', '" + orderDate + "', 1);\n";
    
    // Add the order items statements
    orderItemsSql.forEach(q => { sql += q + '\n'; });
    
    customerId++;
    orderNum++;
});

// Write to insert_data.sql
fs.writeFileSync('insert_data.sql', sql);
console.log('SQL generated!');
```

After generating `insert_data.sql`, run it against your remote database using the D1 execute command:

```bash
npx wrangler d1 execute snah-db --remote --file=insert_data.sql
```

*(Note: It is useful to run `--local` first to verify the SQL runs without errors)*
