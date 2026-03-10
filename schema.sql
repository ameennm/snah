-- ============================================
-- SNAH Inventory Management - Database Schema
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT, -- Deprecated, for backward compatibility
  roles TEXT DEFAULT '[]', -- JSON array of roles e.g. ["employee_orders", "crm_employee"]
  role_label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT DEFAULT '',
  area TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  gst REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'not_paid' CHECK(payment_status IN ('paid', 'not_paid', 'partial')),
  tracking_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'shipped', 'delivered', 'returned')),
  created_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL DEFAULT 0,
  gst REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- CRM Leads table (Sales CRM module)
CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  location TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'hot',
  interested_products TEXT DEFAULT '[]',
  lead_products TEXT DEFAULT '[]',
  instagram TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  next_call_date TEXT DEFAULT '',
  next_action_message TEXT DEFAULT '',
  call_notes TEXT DEFAULT '',
  not_interested_reason TEXT DEFAULT '',
  is_starred INTEGER DEFAULT 0,
  sent_messages TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER,
  assigned_to INTEGER,
  is_passed INTEGER DEFAULT 0,
  passed_from INTEGER,
  converted INTEGER DEFAULT 0,
  closer_id INTEGER,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (passed_from) REFERENCES users(id),
  FOREIGN KEY (closer_id) REFERENCES users(id)
);

-- Ledger table
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  reference TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
