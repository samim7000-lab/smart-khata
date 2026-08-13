-- ============================================================
-- SMART KHATA — PHASE 2A FINAL: EMI TRACKING DATABASE SCHEMA
-- Multi-Tenant Merchant Isolation & Data Integrity Constraints
-- ============================================================

-- 1. EMI ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.emi_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    down_payment NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (down_payment >= 0),
    financed_amount NUMERIC(12,2) NOT NULL CHECK (financed_amount >= 0),
    installment_count INT NOT NULL CHECK (installment_count > 0),
    installment_amount NUMERIC(12,2) NOT NULL CHECK (installment_amount > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'overdue', 'cancelled')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Financial Integrity Constraints
    CONSTRAINT chk_emi_down_payment_max CHECK (down_payment <= total_amount),
    CONSTRAINT chk_emi_financed_math CHECK (financed_amount = (total_amount - down_payment)),

    -- Composite Unique Constraint for Parent Installment Enforcement
    CONSTRAINT uq_emi_account_parent UNIQUE (id, shop_id, customer_id)
);

-- 2. EMI INSTALLMENTS SCHEDULE TABLE
CREATE TABLE IF NOT EXISTS public.emi_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emi_account_id UUID NOT NULL,
    shop_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    installment_number INT NOT NULL CHECK (installment_number > 0),
    due_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'due_today', 'overdue', 'paid', 'partially_paid')),
    paid_at TIMESTAMPTZ,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Financial Integrity Constraints
    CONSTRAINT chk_emi_installment_paid_max CHECK (paid_amount <= amount),

    -- Unique Installment Sequence Per EMI Account
    CONSTRAINT uq_emi_installment_number UNIQUE (emi_account_id, installment_number),

    -- Composite Foreign Key to Guarantee Identical shop_id and customer_id with Parent EMI Account
    CONSTRAINT fk_emi_installment_parent FOREIGN KEY (emi_account_id, shop_id, customer_id)
        REFERENCES public.emi_accounts(id, shop_id, customer_id) ON DELETE CASCADE
);

-- INDEXES FOR FAST DASHBOARD METRICS AND LOOKUPS
CREATE INDEX IF NOT EXISTS idx_emi_accounts_shop_status ON public.emi_accounts(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_emi_accounts_customer_id ON public.emi_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_emi_installments_shop_due ON public.emi_installments(shop_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_emi_installments_account_num ON public.emi_installments(emi_account_id, installment_number);

-- ROW LEVEL SECURITY (RLS) POLICIES — AUTHENTICATED MERCHANT ISOLATION
ALTER TABLE public.emi_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EMI accounts shop owner access" ON public.emi_accounts;
CREATE POLICY "EMI accounts shop owner access"
ON public.emi_accounts
FOR ALL
TO authenticated
USING (
    shop_id IN (
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    shop_id IN (
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "EMI installments shop owner access" ON public.emi_installments;
CREATE POLICY "EMI installments shop owner access"
ON public.emi_installments
FOR ALL
TO authenticated
USING (
    shop_id IN (
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
)
WITH CHECK (
    shop_id IN (
        SELECT id FROM public.shops WHERE owner_id = auth.uid()
    )
);
