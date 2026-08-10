-- Smart Khata Supabase Migration File v3
-- Non-destructive additive update for Optional GST Support & Customer State
-- Run this in the Supabase SQL Editor for existing projects.

-- 1. ADD STATE COLUMN TO CUSTOMERS TABLE
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS state TEXT;

-- 2. ADD GST TAX COLUMNS TO TRANSACTIONS TABLE
ALTER TABLE public.transactions 
    ADD COLUMN IF NOT EXISTS base_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_type TEXT DEFAULT 'none';

-- 3. ADD DEFAULT GST RATE TO SHOPS TABLE
ALTER TABLE public.shops 
    ADD COLUMN IF NOT EXISTS default_gst_rate NUMERIC(5,2) DEFAULT 18;
