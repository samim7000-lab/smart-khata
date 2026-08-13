-- ====================================================
-- SMART KHATA MIGRATION: CAMPAIGNS & COMMUNICATION SCHEMA
-- Timestamp: 20260809 (Must execute before 20260810_meta_whatsapp_schema.sql)
-- ====================================================

-- 1. SUBSCRIPTION ENTITLEMENTS TABLE
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

-- Seed Default Entitlements
INSERT INTO public.subscription_entitlements (tier, campaign_recipient_limit, weekly_ai_quota, can_use_ai_recovery, can_use_advanced_analytics, can_use_automatic_delivery, can_connect_meta_whatsapp)
VALUES
  ('free', 50, 0, FALSE, FALSE, FALSE, FALSE),
  ('pro', 500, 15, TRUE, TRUE, FALSE, FALSE),
  ('business', 10000, 100, TRUE, TRUE, TRUE, TRUE),
  ('enterprise', 10000, 100, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO NOTHING;

-- 2. WHATSAPP TEMPLATES TABLE
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

-- 3. WHATSAPP OPT-INS TABLE
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

-- 4. CAMPAIGNS TABLE
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

-- 5. CAMPAIGN RECIPIENTS TABLE
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

-- 6. DELIVERY ATTEMPTS TABLE
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

-- 7. MEDIA ASSETS TABLE
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

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_shop ON public.whatsapp_templates(shop_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_opt_ins_shop ON public.whatsapp_opt_ins(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_shop ON public.campaigns(shop_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_delivery_attempts_shop ON public.delivery_attempts(shop_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_shop ON public.media_assets(shop_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for subscription_entitlements" ON public.subscription_entitlements FOR SELECT USING (true);

CREATE POLICY "Shops can manage own whatsapp_templates" ON public.whatsapp_templates
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own whatsapp_opt_ins" ON public.whatsapp_opt_ins
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own campaigns" ON public.campaigns
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own campaign_recipients" ON public.campaign_recipients
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own delivery_attempts" ON public.delivery_attempts
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Shops can manage own media_assets" ON public.media_assets
  FOR ALL USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
