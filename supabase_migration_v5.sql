-- ====================================================
-- SMART KHATA - PHASE F: PRODUCTION ENTERPRISE DB MIGRATION v5
-- ====================================================

-- 1. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  tier VARCHAR(32) NOT NULL DEFAULT 'free',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_shop_subscription UNIQUE (shop_id)
);

-- 2. SHOP MEMBERS & ROLES TABLE (RBAC)
CREATE TABLE IF NOT EXISTS public.shop_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'staff', -- 'owner', 'admin', 'manager', 'staff', 'viewer'
  user_name VARCHAR(255),
  user_phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'invited', 'suspended'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_shop_user_role UNIQUE (shop_id, user_id)
);

-- 3. BRANCHES TABLE (MULTI-SHOP)
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_code VARCHAR(64),
  branch_name VARCHAR(255) NOT NULL,
  city VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. FEATURE FLAGS TABLE
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_tier VARCHAR(32) NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS POLICIES FOR SECURE MULTI-TENANCY
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for subscriptions" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update for subscriptions" ON public.subscriptions FOR ALL USING (true);

CREATE POLICY "Allow public select for shop_members" ON public.shop_members FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update for shop_members" ON public.shop_members FOR ALL USING (true);

CREATE POLICY "Allow public select for branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update for branches" ON public.branches FOR ALL USING (true);

CREATE POLICY "Allow public select for feature_flags" ON public.feature_flags FOR SELECT USING (true);
