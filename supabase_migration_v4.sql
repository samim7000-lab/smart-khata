-- Smart Khata Supabase Migration File v4
-- Additive update for AI Handwriting-to-Receipt Scanner & Ledger Photo Proof
-- Run this in the Supabase SQL Editor for existing projects.

-- 1. ADD LEDGER PHOTO URL COLUMN TO TRANSACTIONS TABLE
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS ledger_photo_url TEXT;

-- 2. CREATE LEDGER PHOTOS STORAGE BUCKET (IF NOT EXISTS)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ledger_photos', 'ledger_photos', true) 
ON CONFLICT (id) DO NOTHING;

-- 3. STORAGE POLICIES FOR LEDGER PHOTOS
CREATE POLICY "Public Read Access for Ledger Photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'ledger_photos');

CREATE POLICY "Authenticated Upload for Ledger Photos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'ledger_photos');
