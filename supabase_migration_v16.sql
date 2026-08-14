-- ====================================================
-- SMART KHATA MIGRATION V16: SECURE SOFT-DELETE RPC & RLS UPDATE FIX
-- Project Ref: potkfdjaxgebefqwkmju
-- Target URL: https://potkfdjaxgebefqwkmju.supabase.co
-- ====================================================

DROP POLICY IF EXISTS "Shops active owner update" ON public.shops;
DROP POLICY IF EXISTS "Shops owner update" ON public.shops;

CREATE POLICY "Shops owner update" ON public.shops
    FOR UPDATE
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.soft_delete_shop(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shops 
    WHERE id = target_shop_id 
      AND owner_id = auth.uid() 
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access Denied: Shop not found or already deleted.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.shops
  SET 
    deleted_at = NOW(),
    deletion_status = 'DELETED',
    deletion_requested_at = NOW(),
    restore_available = TRUE
  WHERE id = target_shop_id AND owner_id = auth.uid();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_shop(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
