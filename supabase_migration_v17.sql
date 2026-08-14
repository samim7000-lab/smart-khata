-- ====================================================
-- SMART KHATA MIGRATION V17: DEDUPLICATE ACTIVE SHOPS & ENFORCE UNIQUE ACTIVE SHOP CONSTRAINT
-- Project Ref: potkfdjaxgebefqwkmju
-- Target URL: https://potkfdjaxgebefqwkmju.supabase.co
-- ====================================================

UPDATE public.shops
SET 
  deleted_at = NOW(),
  deletion_status = 'DELETED',
  deletion_requested_at = NOW(),
  restore_available = TRUE
WHERE owner_id = '3376c315-6f57-4214-8c6b-d582cd4b2995'
  AND id <> '0a24e69f-ee5b-4f3f-a19a-d0ff8d44f8b5'
  AND deleted_at IS NULL;

WITH duplicate_shops AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at DESC) as rn
  FROM public.shops
  WHERE deleted_at IS NULL AND deletion_status = 'ACTIVE'
)
UPDATE public.shops
SET 
  deleted_at = NOW(),
  deletion_status = 'DELETED',
  deletion_requested_at = NOW(),
  restore_available = TRUE
WHERE id IN (
  SELECT id FROM duplicate_shops WHERE rn > 1
);

DROP INDEX IF EXISTS idx_shops_one_active_per_owner;

CREATE UNIQUE INDEX idx_shops_one_active_per_owner 
ON public.shops (owner_id) 
WHERE (deleted_at IS NULL AND deletion_status = 'ACTIVE');

NOTIFY pgrst, 'reload schema';
