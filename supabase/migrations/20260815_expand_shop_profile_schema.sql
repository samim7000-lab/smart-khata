-- Smart Khata Supabase Migration: Expand Shop Profile Schema
-- Non-destructive addition of profile fields to public.shops

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

-- Notify PostgREST to refresh schema cache immediately
NOTIFY pgrst, 'reload schema';
