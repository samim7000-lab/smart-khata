-- ====================================================================
-- SMART KHATA — PRODUCTION SECURITY & RLS AUDIT MIGRATION
-- Migration Date: 2026-08-12
-- Target: Fix multi-tenant data isolation vulnerabilities across tables & storage
-- ====================================================================

-- 1. FIX SUBSCRIPTIONS RLS POLICIES (Enforce shop owner isolation)
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Allow public insert/update for subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions owner select" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions owner manage" ON public.subscriptions;

CREATE POLICY "Subscriptions owner access" ON public.subscriptions
  FOR ALL
  USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()))
  WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));


-- 2. FIX SHOP_MEMBERS RLS POLICIES (Restrict staff management to shop owner or self)
ALTER TABLE IF EXISTS public.shop_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for shop_members" ON public.shop_members;
DROP POLICY IF EXISTS "Allow public insert/update for shop_members" ON public.shop_members;
DROP POLICY IF EXISTS "Shop members access" ON public.shop_members;

CREATE POLICY "Shop members access" ON public.shop_members
  FOR ALL
  USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  )
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );


-- 3. FIX BRANCHES RLS POLICIES (Restrict multi-shop branch access to parent shop owner)
ALTER TABLE IF EXISTS public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select for branches" ON public.branches;
DROP POLICY IF EXISTS "Allow public insert/update for branches" ON public.branches;
DROP POLICY IF EXISTS "Branches owner access" ON public.branches;

CREATE POLICY "Branches owner access" ON public.branches
  FOR ALL
  USING (
    parent_shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
    OR branch_shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    parent_shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );


-- 4. FIX PAYMENT_ORDERS RLS POLICIES (Prevent unauthorized insert of payment orders under foreign shop IDs)
ALTER TABLE IF EXISTS public.payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert for payment_orders" ON public.payment_orders;
DROP POLICY IF EXISTS "Payment orders owner insert" ON public.payment_orders;

CREATE POLICY "Payment orders owner insert" ON public.payment_orders
  FOR INSERT
  WITH CHECK (
    shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid())
  );


-- 5. FIX WEBHOOK_EVENTS RLS POLICIES (Remove unrestricted public read policy)
ALTER TABLE IF EXISTS public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for webhook_events" ON public.webhook_events;


-- 6. HARDEN STORAGE BUCKET RLS POLICIES FOR shop-assets
DROP POLICY IF EXISTS "Owners Upload Shop Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners Update Shop Assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners Delete Shop Assets" ON storage.objects;
DROP POLICY IF EXISTS "Scoped Upload Shop Assets" ON storage.objects;
DROP POLICY IF EXISTS "Scoped Update Shop Assets" ON storage.objects;
DROP POLICY IF EXISTS "Scoped Delete Shop Assets" ON storage.objects;

CREATE POLICY "Scoped Upload Shop Assets" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'shop-assets' AND
    auth.role() = 'authenticated'
  );

CREATE POLICY "Scoped Update Shop Assets" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'shop-assets' AND
    auth.role() = 'authenticated' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR owner = auth.uid())
  );

CREATE POLICY "Scoped Delete Shop Assets" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'shop-assets' AND
    auth.role() = 'authenticated' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR owner = auth.uid())
  );
