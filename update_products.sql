-- ============================================
-- SNAH Products Update - Full Product Catalog
-- Run this to replace existing products with the new catalog
-- ============================================

-- Clear existing products (only do this if no orders exist, otherwise just update/insert)
-- DELETE FROM products;

-- Update existing products or insert new ones
-- COD Prices (base prices)
INSERT OR REPLACE INTO products (id, name, purchase_price, selling_price, gst, stock) VALUES
  (1, 'Baby Oil 200ML (COD)', 0, 819, 0, 50),
  (2, 'Baby Cream (COD)', 0, 569, 0, 50),
  (3, 'Adult Skincare Oil 200ML (COD)', 0, 749, 0, 50),
  (4, 'Hair Oil 200ML (COD)', 0, 748, 0, 65);

-- Prepaid - Baby Oil combos
INSERT OR IGNORE INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Baby Oil 200ML x1 (Prepaid)', 0, 849, 0, 100),
  ('Baby Oil 200ML x2 (Prepaid)', 0, 1598, 0, 100),
  ('Baby Oil 200ML x3 - Special Offer (Prepaid)', 0, 2299, 0, 100),
  ('Baby Oil 200ML x4 (Prepaid)', 0, 3199, 0, 100);

-- Prepaid - Baby Cream
INSERT OR IGNORE INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Baby Cream x1 (Prepaid)', 0, 599, 0, 100);

-- Prepaid - Adult Skincare Oil combos
INSERT OR IGNORE INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Adult Skincare Oil 200ML x1 (Prepaid)', 0, 749, 0, 100),
  ('Adult Skincare Oil 200ML x2 (Prepaid)', 0, 1349, 0, 100),
  ('Adult Skincare Oil 200ML x3 (Prepaid)', 0, 1849, 0, 100),
  ('Adult Skincare Oil 200ML x4 (Prepaid)', 0, 2549, 0, 100);

-- Prepaid - Hair Oil combos
INSERT OR IGNORE INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Hair Oil 200ML x1 (Prepaid)', 0, 728, 0, 100),
  ('Hair Oil 200ML x2 (Prepaid)', 0, 1349, 0, 100),
  ('Hair Oil 200ML x3 (Prepaid)', 0, 1649, 0, 100),
  ('Hair Oil 200ML x4 (Prepaid)', 0, 2249, 0, 100);

-- Family Combo
INSERT OR IGNORE INTO products (name, purchase_price, selling_price, gst, stock) VALUES
  ('Family Combo - Baby + Adult + Hair Oil (Special Offer)', 0, 2299, 0, 100);
