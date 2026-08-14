-- ====================================================
-- SMART KHATA MIGRATION: RECOVERABLE SHOP DELETION & TENANT ARCHIVE
-- Timestamp: 20260816
-- ====================================================

-- 1. Add Lifecycle & Deletion Archive Columns to public.shops
ALTER TABLE public.shops 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deletion_status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS restore_available BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Partial Index for Active Shop Queries
CREATE INDEX IF NOT EXISTS idx_shops_owner_active ON public.shops(owner_id) WHERE deleted_at IS NULL;

-- 3. RLS Security Policies for Merchant Isolation
DROP POLICY IF EXISTS "Shops owner access" ON public.shops;
DROP POLICY IF EXISTS "Shops active owner access" ON public.shops;

CREATE POLICY "Shops active owner access" ON public.shops
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- 4. Admin-Only Recoverable Support Restore Function
CREATE OR REPLACE FUNCTION public.admin_restore_shop(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.shops
  SET 
    deleted_at = NULL,
    deletion_status = 'ACTIVE',
    deletion_requested_at = NULL,
    updated_at = NOW()
  WHERE id = target_shop_id;

  RETURN FOUND;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
