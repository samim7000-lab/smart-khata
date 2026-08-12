-- ============================================================
-- SMART KHATA — CURRENT PRODUCTION RLS SECURITY
-- Applies ONLY to tables that currently exist:
-- shops, customers, transactions
-- Non-destructive: does NOT delete tables or data
-- ============================================================

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shops owner access"
ON public.shops;

DROP POLICY IF EXISTS "Customers shop owner access"
ON public.customers;

DROP POLICY IF EXISTS "Customers owner access"
ON public.customers;

DROP POLICY IF EXISTS "Transactions shop owner access"
ON public.transactions;

DROP POLICY IF EXISTS "Transactions owner access"
ON public.transactions;

CREATE POLICY "Shops owner access"
ON public.shops
FOR ALL
TO authenticated
USING (
  auth.uid() = owner_id
)
WITH CHECK (
  auth.uid() = owner_id
);

CREATE POLICY "Customers shop owner access"
ON public.customers
FOR ALL
TO authenticated
USING (
  shop_id IN (
    SELECT id
    FROM public.shops
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT id
    FROM public.shops
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Transactions shop owner access"
ON public.transactions
FOR ALL
TO authenticated
USING (
  shop_id IN (
    SELECT id
    FROM public.shops
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  shop_id IN (
    SELECT id
    FROM public.shops
    WHERE owner_id = auth.uid()
  )
);

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('shops', 'customers', 'transactions')
ORDER BY tablename, policyname;