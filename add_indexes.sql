-- D1 Indexes for Performance Optimization

-- Speed up phone/whatsapp searches for duplicates and lookups
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON crm_leads(whatsapp);

-- Speed up order creation and filtering by date
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Speed up order lookups by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

-- Speed up status filtering (e.g., pending vs delivered, active leads)
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_leads_status ON crm_leads(status);

-- Speed up ledger searches by date (essential for dashboard aggregates)
CREATE INDEX IF NOT EXISTS idx_ledger_date ON ledger(date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON ledger(type);
