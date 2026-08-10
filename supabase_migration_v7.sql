-- ====================================================
-- SMART KHATA MIGRATION V7: AI RECOVERY ENGINE & COUNTRY PRICING
-- ====================================================

-- 1. Recovery Scores Table
CREATE TABLE IF NOT EXISTS recovery_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 50,
  priority_tier TEXT NOT NULL CHECK (priority_tier IN ('high', 'medium', 'low')),
  explanation TEXT NOT NULL,
  suggested_message TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for shop & customer lookup
CREATE INDEX IF NOT EXISTS idx_recovery_scores_shop ON recovery_scores(shop_id, score DESC);

-- 2. Recovery Campaigns Table
CREATE TABLE IF NOT EXISTS recovery_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'prepared', 'dispatched', 'completed', 'canceled')),
  target_audience TEXT NOT NULL,
  recipient_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Country Pricing Configuration Table
CREATE TABLE IF NOT EXISTS country_pricing (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  free_price TEXT NOT NULL DEFAULT '0',
  pro_price TEXT NOT NULL,
  business_price TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Country Pricing
INSERT INTO country_pricing (country_code, country_name, currency_code, currency_symbol, free_price, pro_price, business_price)
VALUES
  ('IN', 'India', 'INR', '₹', '₹0', '₹49/mo', '₹149/mo'),
  ('BD', 'Bangladesh', 'BDT', '৳', '৳0', '৳69/mo', '৳199/mo')
ON CONFLICT (country_code) DO NOTHING;

-- 4. Enable RLS Isolation Policies
ALTER TABLE recovery_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops can manage own recovery scores" ON recovery_scores
  FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own recovery campaigns" ON recovery_campaigns
  FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));
