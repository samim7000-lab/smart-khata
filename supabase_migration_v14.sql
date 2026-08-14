-- ====================================================
-- SMART KHATA MIGRATION V14: RECOVERABLE SHOP DELETION & TENANT ARCHIVE
-- Project Ref: potkfdjaxgebefqwkmju
-- Target URL: https://potkfdjaxgebefqwkmju.supabase.co
-- ====================================================

ALTER TABLE public.shops 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deletion_status TEXT NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS restore_available BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_shops_owner_active ON public.shops(owner_id) WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "Shops owner access" ON public.shops;
DROP POLICY IF EXISTS "Shops active owner access" ON public.shops;

CREATE POLICY "Shops active owner access" ON public.shops
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

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

NOTIFY pgrst, 'reload schema';
