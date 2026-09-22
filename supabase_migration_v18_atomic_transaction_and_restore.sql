-- ====================================================
-- SMART KHATA ALL-IN-ONE PRODUCTION MIGRATION V18
-- ATOMIC TRANSACTION & SECURE SELF-RESTORE RPCs
-- Date: 2026-09-22
-- Target URL: https://potkfdjaxgebefqwkmju.supabase.co
-- ====================================================

-- 1. SECURE MERCHANT SELF-RESTORE FUNCTION
-- Allows an authenticated merchant to safely restore their own soft-deleted shop
-- without requiring administrative SQL intervention, while strictly enforcing
-- single active shop tenant isolation.

CREATE OR REPLACE FUNCTION public.user_restore_own_shop(target_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_shop_id UUID;
BEGIN
  -- Security check: Caller must be authenticated and must own the target shop
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = target_shop_id
      AND owner_id = auth.uid()
      AND deleted_at IS NOT NULL
      AND restore_available = TRUE
  ) THEN
    RAISE EXCEPTION 'Access Denied: Soft-deleted shop not found or restore not available for this account.' USING ERRCODE = '42501';
  END IF;

  -- Concurrency check: Ensure user does not ALREADY have another active shop
  SELECT id INTO v_active_shop_id
  FROM public.shops
  WHERE owner_id = auth.uid()
    AND deleted_at IS NULL
    AND deletion_status = 'ACTIVE'
  LIMIT 1;

  IF v_active_shop_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot restore shop: An active shop (%) already exists for this owner. Only one active shop is permitted.', v_active_shop_id USING ERRCODE = '23505';
  END IF;

  -- Atomic restore: Clear deletion timestamp and re-activate
  UPDATE public.shops
  SET
    deleted_at = NULL,
    deletion_status = 'ACTIVE',
    deletion_requested_at = NULL,
    restore_available = FALSE,
    updated_at = NOW()
  WHERE id = target_shop_id
    AND owner_id = auth.uid();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_restore_own_shop(UUID) TO authenticated;

-- 2. ATOMIC TRANSACTION RECORDING FUNCTION
-- Guarantees atomic transaction entry, validates owner tenancy and customer ownership,
-- ensuring ledger data integrity.

CREATE OR REPLACE FUNCTION public.record_transaction_atomic(
  p_shop_id UUID,
  p_customer_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_ledger_photo_url TEXT DEFAULT NULL,
  p_base_amount NUMERIC DEFAULT NULL,
  p_tax_amount NUMERIC DEFAULT NULL,
  p_total_amount NUMERIC DEFAULT NULL,
  p_gst_rate NUMERIC DEFAULT 0,
  p_cgst_amount NUMERIC DEFAULT 0,
  p_sgst_amount NUMERIC DEFAULT 0,
  p_igst_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_tx_id UUID;
  v_result JSONB;
BEGIN
  -- Security check: Caller must own the target active shop
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = p_shop_id
      AND owner_id = auth.uid()
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access Denied: Active shop not found or not owned by caller' USING ERRCODE = '42501';
  END IF;

  -- Invariant check: Customer must belong to the active shop
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id
      AND shop_id = p_shop_id
  ) THEN
    RAISE EXCEPTION 'Invalid Customer: Customer % does not belong to shop %', p_customer_id, p_shop_id USING ERRCODE = 'P0002';
  END IF;

  -- Validation: Transaction type and positive amount
  IF p_type NOT IN ('credit_given', 'payment_received') THEN
    RAISE EXCEPTION 'Invalid transaction type: % (must be credit_given or payment_received)', p_type USING ERRCODE = '22023';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be strictly positive: %', p_amount USING ERRCODE = '22003';
  END IF;

  -- Atomic Insert into transactions
  INSERT INTO public.transactions (
    shop_id,
    customer_id,
    type,
    amount,
    note,
    ledger_photo_url,
    base_amount,
    tax_amount,
    total_amount,
    gst_rate,
    cgst_amount,
    sgst_amount,
    igst_amount,
    created_at
  ) VALUES (
    p_shop_id,
    p_customer_id,
    p_type,
    p_amount,
    COALESCE(p_note, ''),
    p_ledger_photo_url,
    p_base_amount,
    p_tax_amount,
    p_total_amount,
    p_gst_rate,
    p_cgst_amount,
    p_sgst_amount,
    p_igst_amount,
    NOW()
  ) RETURNING id INTO v_new_tx_id;

  SELECT to_jsonb(t) INTO v_result
  FROM public.transactions t
  WHERE t.id = v_new_tx_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_transaction_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
