-- ====================================================================
-- SMART KHATA — OFFICIAL META WHATSAPP CLOUD API DATABASE SCHEMA
-- Multi-Tenant Merchant Isolation & RLS Security
-- ====================================================================

-- 1. WHATSAPP CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta_cloud_api',
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  display_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shop_whatsapp_connection UNIQUE (shop_id)
);

-- Enable RLS on whatsapp_connections
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own shop WhatsApp connection"
  ON public.whatsapp_connections
  FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
  );

-- 2. WHATSAPP TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en_US',
  category TEXT NOT NULL DEFAULT 'UTILITY',
  status TEXT NOT NULL DEFAULT 'APPROVED',
  meta_template_id TEXT,
  components JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shop_template_name UNIQUE (shop_id, name, language)
);

-- Enable RLS on whatsapp_templates
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage their own shop WhatsApp templates"
  ON public.whatsapp_templates
  FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
  );

-- 3. WHATSAPP MESSAGES LOG TABLE
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  template_name TEXT,
  meta_message_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on whatsapp_messages
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own shop WhatsApp messages"
  ON public.whatsapp_messages
  FOR ALL
  USING (
    shop_id IN (
      SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
  );

-- 4. WHATSAPP WEBHOOK EVENTS (IDEMPOTENCY & AUDIT LOG)
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_message_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  recipient_phone TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_webhook_event_idempotent UNIQUE (meta_message_id, event_type)
);

-- Index for instant status queries
CREATE INDEX IF NOT EXISTS idx_wa_messages_shop_id ON public.whatsapp_messages(shop_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_meta_id ON public.whatsapp_messages(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_meta_id ON public.whatsapp_webhook_events(meta_message_id);
