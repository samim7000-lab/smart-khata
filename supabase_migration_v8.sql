-- ====================================================
-- SMART KHATA MIGRATION V8: SAFE CUSTOMER STATE COLUMN SCHEMA UPDATE
-- ====================================================

-- Safe additive migration for customer state column
ALTER TABLE public.customers 
    ADD COLUMN IF NOT EXISTS state TEXT;
