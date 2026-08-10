-- Smart Khata Supabase Migration File v2
-- Non-destructive update for expanding Shop Owner Profile & Storage Setup
-- Run this in the Supabase SQL Editor for existing projects.

-- 1. SAFE NON-DESTRUCTIVE COLUMNS ADDITION TO SHOPS TABLE
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

-- 2. CREATE STORAGE BUCKET FOR SHOP ASSETS (LOGOS, PHOTOS, SIGNATURES)
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 3. BUCKET STORAGE RLS POLICIES FOR SECURE ACCESS
CREATE POLICY "Public Read Access for Shop Assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'shop-assets');

CREATE POLICY "Owners Upload Shop Assets" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'shop-assets' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Owners Update Shop Assets" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'shop-assets' AND 
    auth.role() = 'authenticated'
);

CREATE POLICY "Owners Delete Shop Assets" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'shop-assets' AND 
    auth.role() = 'authenticated'
);
