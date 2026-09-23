-- ====================================================
-- SMART KHATA ALL-IN-ONE PRODUCTION MIGRATION V19
-- CUSTOMER SCHEMA RECONCILIATION, GST INVOICING & ATOMIC NUMBERING
-- Target Database: Supabase PostgreSQL (public schema)
-- Date: 2026-09-23
-- Idempotent: Yes (Safe to run multiple times)
-- ====================================================

-- 1. RECONCILE CUSTOMERS TABLE (ADDRESS, STATE, CREDIT_LIMIT, GSTIN)
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gstin TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. RECONCILE SHOPS TABLE (LEGAL NAME, GST REGISTRATION TYPE, STATE CODE, INVOICE SERIES)
ALTER TABLE public.shops
    ADD COLUMN IF NOT EXISTS legal_name TEXT,
    ADD COLUMN IF NOT EXISTS state_code TEXT,
    ADD COLUMN IF NOT EXISTS gst_registration_type TEXT DEFAULT 'regular',
    ADD COLUMN IF NOT EXISTS default_tax_mode TEXT DEFAULT 'intra',
    ADD COLUMN IF NOT EXISTS invoice_series TEXT DEFAULT 'INV';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_shops_gst_reg_type'
    ) THEN
        ALTER TABLE public.shops 
            ADD CONSTRAINT chk_shops_gst_reg_type 
            CHECK (gst_registration_type IN ('regular', 'composition'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_shops_default_tax_mode'
    ) THEN
        ALTER TABLE public.shops 
            ADD CONSTRAINT chk_shops_default_tax_mode 
            CHECK (default_tax_mode IN ('intra', 'inter'));
    END IF;
END $$;

-- 3. SEQUENTIAL INVOICE NUMBER ALLOCATOR COUNTERS TABLE
CREATE TABLE IF NOT EXISTS public.invoice_counters (
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    series TEXT NOT NULL DEFAULT 'INV',
    next_number BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (shop_id, financial_year, series)
);

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoice_counters' AND policyname = 'invoice_counters_owner_all'
    ) THEN
        CREATE POLICY "invoice_counters_owner_all" ON public.invoice_counters
            FOR ALL TO authenticated
            USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
            WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
    END IF;
END $$;

-- 4. ATOMIC INVOICE NUMBER ALLOCATOR RPC
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(
    p_shop_id UUID,
    p_financial_year TEXT,
    p_series TEXT DEFAULT 'INV'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_allocated_num BIGINT;
    v_clean_series TEXT;
    v_clean_fy TEXT;
    v_formatted_no TEXT;
    v_short_fy TEXT;
BEGIN
    -- Security check: Caller must own the target shop
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.shops
        WHERE id = p_shop_id
          AND owner_id = auth.uid()
          AND deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Access Denied: Shop not found or not owned by caller' USING ERRCODE = '42501';
    END IF;

    v_clean_series := UPPER(TRIM(COALESCE(p_series, 'INV')));
    v_clean_fy := TRIM(COALESCE(p_financial_year, '2026-27'));

    IF LENGTH(v_clean_fy) = 7 AND v_clean_fy LIKE '20%' THEN
        v_short_fy := SUBSTRING(v_clean_fy FROM 3 FOR 2) || '-' || SUBSTRING(v_clean_fy FROM 6 FOR 2);
    ELSE
        v_short_fy := v_clean_fy;
    END IF;

    INSERT INTO public.invoice_counters (shop_id, financial_year, series, next_number, updated_at)
    VALUES (p_shop_id, v_clean_fy, v_clean_series, 2, NOW())
    ON CONFLICT (shop_id, financial_year, series)
    DO UPDATE SET 
        next_number = public.invoice_counters.next_number + 1,
        updated_at = NOW()
    RETURNING public.invoice_counters.next_number - 1 INTO v_allocated_num;

    v_formatted_no := v_clean_series || '/' || v_short_fy || '/' || LPAD(v_allocated_num::TEXT, 6, '0');

    RETURN jsonb_build_object(
        'success', true,
        'invoice_number', v_formatted_no,
        'sequence_number', v_allocated_num,
        'series', v_clean_series,
        'financial_year', v_clean_fy
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_invoice_number(UUID, TEXT, TEXT) TO authenticated;

-- 5. STRUCTURED INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    invoice_series TEXT NOT NULL DEFAULT 'INV',
    invoice_number TEXT NOT NULL,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supply_type TEXT NOT NULL DEFAULT 'intra',
    place_of_supply TEXT,
    reverse_charge BOOLEAN NOT NULL DEFAULT FALSE,
    supplier_legal_name TEXT NOT NULL,
    supplier_address TEXT,
    supplier_gstin TEXT,
    supplier_state TEXT,
    supplier_state_code TEXT,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT,
    recipient_gstin TEXT,
    recipient_state TEXT,
    recipient_state_code TEXT,
    taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    cgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    sgst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    igst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'issued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_shop_fy_invoice UNIQUE (shop_id, financial_year, invoice_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_doc_type'
    ) THEN
        ALTER TABLE public.invoices 
            ADD CONSTRAINT chk_invoices_doc_type 
            CHECK (document_type IN ('tax_invoice', 'payment_receipt', 'bill_of_supply', 'receipt'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_supply_type'
    ) THEN
        ALTER TABLE public.invoices 
            ADD CONSTRAINT chk_invoices_supply_type 
            CHECK (supply_type IN ('intra', 'inter'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_status'
    ) THEN
        ALTER TABLE public.invoices 
            ADD CONSTRAINT chk_invoices_status 
            CHECK (status IN ('issued', 'cancelled'));
    END IF;
END $$;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_owner_select'
    ) THEN
        CREATE POLICY "invoices_owner_select" ON public.invoices
            FOR SELECT TO authenticated
            USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_owner_insert'
    ) THEN
        CREATE POLICY "invoices_owner_insert" ON public.invoices
            FOR INSERT TO authenticated
            WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'invoices_owner_update'
    ) THEN
        CREATE POLICY "invoices_owner_update" ON public.invoices
            FOR UPDATE TO authenticated
            USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
