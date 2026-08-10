-- Smart Khata Supabase Migration File
-- Run this in the Supabase SQL Editor to set up your tables & security policies.

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SHOPS TABLE
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone TEXT,
    whatsapp_number TEXT,
    email TEXT,
    country TEXT DEFAULT 'BD',
    state TEXT,
    city TEXT,
    full_address TEXT,
    postal_code TEXT,
    business_type TEXT,
    currency_code TEXT DEFAULT 'BDT',
    gst_number TEXT,
    default_gst_rate NUMERIC(5,2) DEFAULT 18,
    logo_url TEXT,
    shop_photo_url TEXT,
    signature_url TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'bn',
    gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    display_label TEXT NOT NULL,
    state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit_given', 'payment_received')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    note TEXT NOT NULL DEFAULT '',
    ledger_photo_url TEXT,
    base_amount NUMERIC(12,2),
    tax_amount NUMERIC(12,2),
    total_amount NUMERIC(12,2),
    gst_rate NUMERIC(5,2) DEFAULT 0,
    cgst_amount NUMERIC(12,2) DEFAULT 0,
    sgst_amount NUMERIC(12,2) DEFAULT 0,
    igst_amount NUMERIC(12,2) DEFAULT 0,
    tax_type TEXT DEFAULT 'none',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR FAST SEARCH AND QUERIES
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shop_id ON public.transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Shops RLS: Owners can read, insert, update their own shop
CREATE POLICY "Shops owner access" ON public.shops
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- Customers RLS: Owners can manage customers belonging to their shop
CREATE POLICY "Customers shop owner access" ON public.customers
    FOR ALL
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

-- Transactions RLS: Owners can manage transactions belonging to their shop
CREATE POLICY "Transactions shop owner access" ON public.transactions
    FOR ALL
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
