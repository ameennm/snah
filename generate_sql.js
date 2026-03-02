const fs = require('fs');

const data = `Ligna Kasim – Kerala – 1 Baby Cream
Sufiya – Kerala – 1 Baby Cream (COD)
Aysha Jumana – Kerala – 1 Skin Oil
Rinsha – Kerala – 1 Baby Oil
Abrar Hussain – Telangana – 1 Baby Oil (COD)
Srnuthi – Tamil Nadu – 1 Baby Oil
Sinehana – Karnataka – 1 Baby Oil
P. Tanuja – Andhra Pradesh – 1 Baby Oil
Nayana Malayil – Maharashtra – 1 Baby Oil
Shafna Riyas – Kerala – 1 Baby Oil
Stella Mary – Tamil Nadu – 1 Baby Oil
Nilashni – Tamil Nadu – 1 Baby Oil
Mohamed Machinde – Karnataka – 1 Baby Oil
Josly Johnson – Kerala – 1 Baby Oil
Profferser Khan – Karnataka – 1 Baby Oil
Dhanya Ashok – Kerala – 1 Baby Oil
Tamanna Surayya – Kerala – 1 Baby Oil
Ammu Manu – Kerala – 1 Baby Oil

Laxmi Kumari – Jharkhand – 1 Baby Oil
Hajara Anas – Kerala – 2 Baby Oil
Ajmi Shamnad – Kerala – 1 Baby Oil
Sharvana Sharma – Kerala – 1 Baby Oil, 1 Skin Oil, 1 Hair Oil
Azhar – Kerala – 2 Baby Oil, 1 Skin Oil
Jinu Abraham – Kerala – 3 Baby Oil
Ishrath – Kerala – 2 Baby Oil
Munna Fasalu – Kerala – 1 Baby Oil
Prasanna – Telangana – 1 Baby Oil
Manesha Kumari – Bihar – 1 Baby Oil
Icher Mobile – Kerala – 1 Baby Oil
Muhammed Kutty – Kerala – 1 Baby Oil
Mubarak – Kerala – 1 Baby Oil
Farhen Sultana – West Bengal – 1 Baby Oil
Noufiya – Kerala – 1 Baby Oil
Shahanas – Kerala – 1 Baby Oil
Gayathri Shekhar – Karnataka – 1 Baby Oil (COD)
Gowthami – Tamil Nadu – 1 Baby Oil (COD)
Abisha – Tamil Nadu – 1 Baby Oil
Nuhana – Kerala – 1 Baby Oil
Ayishajaleel – Kerala – 1 Baby Oil
Ifana – Kerala – 3 Baby Oil, 1 Baby Cream
Abdulla Muhmmt – Kerala – 1 Baby Oil
Anu Mary – Kerala – 4 Hair Oil
Rahmath – Kerala – 2 Baby Oil
Mutala – Kerala – 1 Baby Oil
Hasna – Kerala – 1 Baby Oil
Athra Fathima – Kerala – 1 Baby Oil
Valluri Sunatha – Telangana – 1 Baby Oil
Revathi – Karnataka – 1 Baby Oil

Ajma Saji – Kerala – 1 Baby Oil
Meenu – Karnataka – 1 Baby Oil
Thanseela – Kerala – 1 Baby Oil
Jusana Nargees – Kerala – 1 Baby Oil
Dibyaranjan Sahoo – Odisha – 3 Baby Oil
Nikhat Sabreen – Chhattisgarh – 1 Baby Oil
Farhana Hamza – Kerala – 1 Baby Oil
Vidya Shree – Karnataka – 1 Baby Oil
Sunil Kumar – Karnataka – 1 Baby Oil
Bhavya AB – Kerala – 1 Baby Oil
Harshma Ranjul – Kerala – 1 Baby Oil
Muhsina Siraj – Kerala – 1 Baby Oil
Poorthibha Khade – Maharashtra – 1 Baby Oil
Shuha Shirin – Kerala – 1 Baby Oil
Preethi – Karnataka – 2 Baby Oil
Asiya Haseen – Kerala – 1 Baby Oil
Muskan Taj – Karnataka – 1 Skin Oil
Salim Shaikh – Maharashtra – 2 Skin Oil
Muskan Banu – Gujarat – 1 Baby Oil
Gopisetti Sridhar – Telangana – 1 Baby Oil
Arya Nair – Karnataka – 3 Baby Oil, 1 Baby Cream
Noel Duyog Dsouze – Goa – 1 Baby Oil, 1 Skin Oil
Krishnapriya – Kerala – 1 Baby Oil
Divya Bharathi – Uttar Pradesh – 1 Baby Oil
Catheren Britto – Tamil Nadu – 1 Baby Oil
Mohan Kumar – Karnataka – 1 Baby Oil, 1 Skin Oil
Devika – Kerala – 1 Baby Oil
Hashim – Kerala – 2 Baby Oil`;

const productsMap = {
    'baby oil': { id: 1, name: 'Baby Oil', price: 850, gst: 12 },
    'hair oil': { id: 2, name: 'Hair Oil', price: 850, gst: 12 },
    'skin oil': { id: 3, name: 'Skin  Oil', price: 850, gst: 5 },
    'baby cream': { id: 4, name: 'baby cream', price: 600, gst: 5 },
};

let sql = '';
let customerId = 1;

let basePhone = 9800000000;
let orderNum = 1;

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
    const paymentStatus = 'paid';
    const orderDate = '2026-01-01 10:00:00';

    sql += "INSERT INTO orders (id, customer_id, subtotal, gst_amount, total, paid_amount, payment_status, status, created_at, created_by) VALUES ('" + orderId + "', " + customerId + ", " + subtotal + ", " + totalGst + ", " + total + ", " + total + ", '" + paymentStatus + "', 'delivered', '" + orderDate + "', 1);\n";

    orderItemsSql.forEach(q => { sql += q + '\n'; });

    customerId++;
    orderNum++;
});

fs.writeFileSync('insert_data.sql', sql);
console.log('SQL generated!');
