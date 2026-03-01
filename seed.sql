-- ============================================
-- SNAH Inventory Management - Seed Data
-- ============================================

-- Users
INSERT INTO users (username, password, name, email, role, role_label) VALUES
  ('admin', 'admin123', 'Ameena', 'admin@snah.com', 'super_admin', 'Super Admin'),
  ('employee1', 'emp123', 'Rahul', 'rahul@snah.com', 'employee_orders', 'Order Creator'),
  ('employee2', 'emp456', 'Priya', 'priya@snah.com', 'employee_tracking', 'Tracking Manager');

-- Customers
INSERT INTO customers (name, phone, address, area) VALUES
  ('Ayesha Begum', '919876543210', '23, MG Road, Bandra West', 'Mumbai'),
  ('Zainab Fatima', '919812345678', '45, Park Street, Salt Lake', 'Kolkata'),
  ('Noor Jahan', '919900112233', '78, Anna Nagar, T Nagar', 'Chennai'),
  ('Sana Mirza', '919988776655', '12, Jubilee Hills, Road No 5', 'Hyderabad'),
  ('Rukhsar Khan', '919876501234', '56, SG Highway, Bodakdev', 'Ahmedabad'),
  ('Meher Patel', '919845671234', '89, Koramangala 4th Block', 'Bangalore');

-- Products
INSERT INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Baby Oil', 450, 850, 12, 50),
  ('Hair Oil', 400, 850, 12, 65),
  ('Face Oil', 420, 850, 12, 40);

-- Orders
INSERT INTO orders (id, customer_id, subtotal, gst_amount, total, payment_status, tracking_id, status, created_at, created_by) VALUES
  ('ORD-001', 1, 2550, 306, 2856, 'paid', 'TRK9876543210', 'delivered', '2026-02-20T10:00:00', 2),
  ('ORD-002', 2, 2550, 306, 2856, 'paid', 'TRK1234567890', 'shipped', '2026-02-22T14:30:00', 2),
  ('ORD-003', 3, 2550, 306, 2856, 'partial', '', 'pending', '2026-02-25T09:15:00', 2),
  ('ORD-004', 4, 1700, 204, 1904, 'paid', 'TRK4455667788', 'delivered', '2026-02-26T11:00:00', 2),
  ('ORD-005', 5, 2550, 306, 2856, 'paid', 'TRK5557778899', 'shipped', '2026-02-27T16:45:00', 2),
  ('ORD-006', 6, 4250, 510, 4760, 'not_paid', '', 'pending', '2026-02-28T10:30:00', 2),
  ('ORD-007', 1, 1700, 204, 1904, 'paid', '', 'pending', '2026-03-01T09:00:00', 2),
  ('ORD-008', 3, 3400, 408, 3808, 'partial', '', 'pending', '2026-03-01T14:20:00', 2);

-- Order Items
INSERT INTO order_items (order_id, product_id, quantity, price, gst) VALUES
  ('ORD-001', 1, 2, 850, 12),
  ('ORD-001', 3, 1, 850, 12),
  ('ORD-002', 2, 3, 850, 12),
  ('ORD-003', 1, 1, 850, 12),
  ('ORD-003', 2, 1, 850, 12),
  ('ORD-003', 3, 1, 850, 12),
  ('ORD-004', 3, 2, 850, 12),
  ('ORD-005', 2, 2, 850, 12),
  ('ORD-005', 1, 1, 850, 12),
  ('ORD-006', 1, 3, 850, 12),
  ('ORD-006', 3, 2, 850, 12),
  ('ORD-007', 2, 2, 850, 12),
  ('ORD-008', 3, 4, 850, 12);

-- Ledger
INSERT INTO ledger (type, category, description, amount, date, reference) VALUES
  ('income', 'Sales', 'Order ORD-001 - Ayesha Begum (Baby Oil x2, Face Oil x1)', 2856, '2026-02-20', 'ORD-001'),
  ('income', 'Sales', 'Order ORD-002 - Zainab Fatima (Hair Oil x3)', 2856, '2026-02-22', 'ORD-002'),
  ('expense', 'Shipping', 'Courier charges for ORD-001 & ORD-002', 240, '2026-02-22', 'SHIP-001'),
  ('expense', 'Rent', 'Warehouse rent - February', 8000, '2026-02-01', 'RENT-FEB'),
  ('expense', 'Salary', 'Employee salaries - February', 15000, '2026-02-01', 'SAL-FEB'),
  ('income', 'Sales', 'Order ORD-004 - Sana Mirza (Face Oil x2)', 1904, '2026-02-26', 'ORD-004'),
  ('income', 'Sales', 'Order ORD-005 - Rukhsar Khan (Hair Oil x2, Baby Oil x1)', 2856, '2026-02-27', 'ORD-005'),
  ('expense', 'Packaging', 'Bottles & packaging material', 2500, '2026-02-15', 'PKG-001'),
  ('expense', 'Marketing', 'Instagram & Facebook Ads - February', 3000, '2026-02-10', 'ADS-FEB'),
  ('income', 'Sales', 'Order ORD-007 - Ayesha Begum (Hair Oil x2)', 1904, '2026-03-01', 'ORD-007'),
  ('expense', 'Shipping', 'Courier charges for ORD-004 & ORD-005', 200, '2026-02-27', 'SHIP-002');
