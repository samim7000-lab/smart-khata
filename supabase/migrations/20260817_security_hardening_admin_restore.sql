-- ====================================================
-- SMART KHATA MIGRATION: SECURITY HARDENING FOR ADMIN RESTORE & RLS ENFORCEMENT
-- Timestamp: 20260817
-- ====================================================

-- 1. Secure Admin Restore Function with Search Path and Service Role Authorization
CREATE OR REPLACE FUNCTION public.admin_restore_shop(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_owner_id UUID;
BEGIN
  -- Strict Authorization Guard: Only service_role administrative calls permitted
  IF (auth.jwt() ->> 'role') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access Denied: Only authorized administrative service accounts can invoke shop restoration.' USING ERRCODE = '42501';
  END IF;

  -- Locate target shop owner
  SELECT owner_id INTO target_owner_id FROM public.shops WHERE id = target_shop_id;
  IF target_owner_id IS NULL THEN
    RAISE EXCEPTION 'Shop with ID % not found.', target_shop_id;
  END IF;

  -- Conflict Protection: Prevent restoring a shop if owner already has another active shop
  IF EXISTS (
    SELECT 1 FROM public.shops
    WHERE owner_id = target_owner_id
      AND id <> target_shop_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Conflict: Owner already has an active shop. Archive active shop before restoring historical tenant.' USING ERRCODE = '23505';
  END IF;

  -- Restore Shop
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

-- 2. Revoke RPC Execution Privileges from Client Roles
REVOKE ALL ON FUNCTION public.admin_restore_shop(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_restore_shop(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.admin_restore_shop(UUID) FROM authenticated;

-- Grant Execution Privileges ONLY to Backend Service Role
GRANT EXECUTE ON FUNCTION public.admin_restore_shop(UUID) TO service_role;

-- 3. Enforce Strict Active-Only RLS Policies for Merchants
DROP POLICY IF EXISTS "Shops active owner access" ON public.shops;
DROP POLICY IF EXISTS "Shops owner access" ON public.shops;

-- Merchant can ONLY select/query ACTIVE non-deleted shops
CREATE POLICY "Shops active owner select" ON public.shops
    FOR SELECT
    USING (auth.uid() = owner_id AND deleted_at IS NULL AND deletion_status = 'ACTIVE');

CREATE POLICY "Shops active owner update" ON public.shops
    FOR UPDATE
    USING (auth.uid() = owner_id AND deleted_at IS NULL AND deletion_status = 'ACTIVE')
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Shops owner insert" ON public.shops
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Reload schema
NOTIFY pgrst, 'reload schema';
