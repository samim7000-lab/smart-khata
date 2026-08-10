-- ====================================================
-- SMART KHATA MIGRATION V11: PAYMENT ORDERS & WEBHOOK VERIFICATION ARCHITECTURE
-- ====================================================

-- 1. PAYMENT ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  order_id VARCHAR(128) NOT NULL,
  payment_id VARCHAR(128),
  signature VARCHAR(256),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  error_code VARCHAR(64),
  error_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WEBHOOK EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  event_id VARCHAR(128) NOT NULL UNIQUE,
  event_type VARCHAR(128) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_payment_orders_shop ON public.payment_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order ON public.payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON public.webhook_events(provider, event_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shops can view own payment_orders" ON public.payment_orders
  FOR SELECT USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Allow public insert for payment_orders" ON public.payment_orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read for webhook_events" ON public.webhook_events
  FOR SELECT USING (true);
