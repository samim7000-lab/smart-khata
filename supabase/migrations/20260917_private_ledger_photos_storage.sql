-- ============================================================
-- SMART KHATA — PRODUCTION PRIVATE STORAGE FOR LEDGER PROOFS
-- Provisions private 'ledger_photos' bucket with strict RLS
-- ============================================================

-- 1. Create or configure private storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ledger_photos',
    'ledger_photos',
    false, -- STRICTLY PRIVATE: No public unauthenticated access
    5242880, -- 5 MB max per photo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- 2. Drop existing ledger_photos storage policies if any
DROP POLICY IF EXISTS "Shop owners can read their own ledger photos" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can upload their own ledger photos" ON storage.objects;
DROP POLICY IF EXISTS "Shop owners can delete their own ledger photos" ON storage.objects;

-- 3. SELECT (Read / createSignedUrl): Shop owner only
CREATE POLICY "Shop owners can read their own ledger photos"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'ledger_photos'
    AND (
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.shops WHERE owner_id = auth.uid()
        )
    )
);

-- 4. INSERT (Upload): Shop owner only into their own shop folder
CREATE POLICY "Shop owners can upload their own ledger photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'ledger_photos'
    AND (
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.shops WHERE owner_id = auth.uid()
        )
    )
);

-- 5. DELETE: Shop owner only
CREATE POLICY "Shop owners can delete their own ledger photos"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'ledger_photos'
    AND (
        (storage.foldername(name))[1]::uuid IN (
            SELECT id FROM public.shops WHERE owner_id = auth.uid()
        )
    )
);

-- 6. Ensure ledger_photo_url column exists on public.transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ledger_photo_url TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
