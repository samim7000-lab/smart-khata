-- ====================================================
-- SMART KHATA ALL-IN-ONE PRODUCTION MIGRATION V13
-- Project Ref: potkfdjaxgebefqwkmju
-- Target URL: https://potkfdjaxgebefqwkmju.supabase.co
-- Executes all migrations in strict dependency order:
-- 1. Subscription & Campaigns Schema
-- 2. Meta WhatsApp Integration Schema
-- 3. Production Security & RLS Policies
-- 4. EMI Tracking & Installments Schema
-- 5. Expand Shop Profile Schema & PostgREST Cache Reload
-- ====================================================

-- ----------------------------------------------------
-- PART 1: SUBSCRIPTION & CAMPAIGNS SCHEMA
-- ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
  tier VARCHAR(32) PRIMARY KEY,
  campaign_recipient_limit INT NOT NULL DEFAULT 50,
  weekly_ai_quota INT NOT NULL DEFAULT 0,
  can_use_ai_recovery BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_advanced_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  can_use_automatic_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  can_connect_meta_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_entitlements (tier, campaign_recipient_limit, weekly_ai_quota, can_use_ai_recovery, can_use_advanced_analytics, can_use_automatic_delivery, can_connect_meta_whatsapp)
VALUES
  ('free', 50, 0, FALSE, FALSE, FALSE, FALSE),
  ('pro', 500, 15, TRUE, TRUE, FALSE, FALSE),
  ('business', 10000, 100, TRUE, TRUE, TRUE, TRUE),
  ('enterprise', 10000, 100, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'manual_share',
  template_name VARCHAR(128) NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  category VARCHAR(32) NOT NULL DEFAULT 'MARKETING',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  meta_template_id VARCHAR(128),
  variables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  opt_in_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  opt_in_source VARCHAR(64) DEFAULT 'manual',
  opt_in_at TIMESTAMPTZ,
  opt_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_shop_customer_opt_in UNIQUE (shop_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  target_audience VARCHAR(64) NOT NULL DEFAULT 'all',
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  raw_message TEXT NOT NULL,
  media_url TEXT,
  media_type VARCHAR(32),
  recipient_count INT NOT NULL DEFAULT 0,
  dispatched_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'prepared',
  dispatched_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL DEFAULT 'whatsapp_direct',
  status VARCHAR(32) NOT NULL DEFAULT 'prepared',
  formatted_text TEXT NOT NULL,
  media_url TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'poster',
  media_url TEXT NOT NULL,
  file_type VARCHAR(32) NOT NULL DEFAULT 'image',
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------
-- PART 2: META WHATSAPP INTEGRATION SCHEMA
-- ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  waba_id VARCHAR(128) NOT NULL,
  phone_number_id VARCHAR(128) NOT NULL,
  display_phone_number VARCHAR(32),
  verified_name VARCHAR(255),
  access_token TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_shop_whatsapp_connection UNIQUE (shop_id)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  waba_message_id VARCHAR(128),
  recipient_phone VARCHAR(32) NOT NULL,
  direction VARCHAR(8) NOT NULL DEFAULT 'outbound',
  message_type VARCHAR(32) NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  error_code VARCHAR(64),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(128) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------
-- PART 3: EMI TRACKING SCHEMA
-- ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.emi_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  down_payment NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  financed_amount NUMERIC(12, 2) NOT NULL,
  installment_count INT NOT NULL,
  monthly_amount NUMERIC(12, 2) NOT NULL,
  interest_rate_annual NUMERIC(5, 2) DEFAULT 0.00,
  start_date DATE NOT NULL,
  frequency VARCHAR(32) NOT NULL DEFAULT 'monthly',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emi_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emi_account_id UUID NOT NULL REFERENCES public.emi_accounts(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------
-- PART 4: EXPAND SHOP PROFILE SCHEMA (PRIMARY BUG FIX)
-- ----------------------------------------------------

ALTER TABLE public.shops 
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'BD',
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS full_address TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS business_type TEXT,
    ADD COLUMN IF NOT EXISTS currency_code TEXT DEFAULT 'BDT',
    ADD COLUMN IF NOT EXISTS gst_number TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS shop_photo_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_url TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------------------------------------
-- PART 5: INDEXES & RLS SECURITY POLICIES
-- ----------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_shop ON public.whatsapp_templates(shop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_shop ON public.whatsapp_opt_ins(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_shop ON public.campaigns(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_shop ON public.delivery_attempts(shop_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_shop ON public.media_assets(shop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_shop ON public.whatsapp_connections(shop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_shop ON public.whatsapp_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer ON public.whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_accounts_shop ON public.emi_accounts(shop_id);
CREATE INDEX IF NOT EXISTS idx_emi_accounts_customer ON public.emi_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_installments_account ON public.emi_installments(emi_account_id);
CREATE INDEX IF NOT EXISTS idx_emi_installments_due ON public.emi_installments(due_date);

ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_installments ENABLE ROW LEVEL SECURITY;

-- Clean re-creation of policies
DROP POLICY IF EXISTS "Allow public read for subscription_entitlements" ON public.subscription_entitlements;
CREATE POLICY "Allow public read for subscription_entitlements" ON public.subscription_entitlements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shops can manage own whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "Shops can manage own whatsapp_templates" ON public.whatsapp_templates
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own whatsapp_opt_ins" ON public.whatsapp_opt_ins;
CREATE POLICY "Shops can manage own whatsapp_opt_ins" ON public.whatsapp_opt_ins
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own campaigns" ON public.campaigns;
CREATE POLICY "Shops can manage own campaigns" ON public.campaigns
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Shops can manage own campaign_recipients" ON public.campaign_recipients
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own delivery_attempts" ON public.delivery_attempts;
CREATE POLICY "Shops can manage own delivery_attempts" ON public.delivery_attempts
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own media_assets" ON public.media_assets;
CREATE POLICY "Shops can manage own media_assets" ON public.media_assets
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Shops can manage own whatsapp_connections" ON public.whatsapp_connections
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Shops can manage own whatsapp_messages" ON public.whatsapp_messages
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Allow public read for whatsapp_webhook_events" ON public.whatsapp_webhook_events;
CREATE POLICY "Allow public read for whatsapp_webhook_events" ON public.whatsapp_webhook_events
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shops can manage own emi_accounts" ON public.emi_accounts;
CREATE POLICY "Shops can manage own emi_accounts" ON public.emi_accounts
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Shops can manage own emi_installments" ON public.emi_installments;
CREATE POLICY "Shops can manage own emi_installments" ON public.emi_installments
  FOR ALL USING (emi_account_id IN (SELECT id FROM public.emi_accounts WHERE shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())));

-- ----------------------------------------------------
-- PART 6: RELOAD POSTGREST SCHEMA CACHE
-- ----------------------------------------------------
NOTIFY pgrst, 'reload schema';
