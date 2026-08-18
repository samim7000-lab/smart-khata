-- Migration: 20260820_add_base_amount_and_gst_columns.sql
-- Add base_amount, tax_amount, total_amount, and GST calculation columns to public.transactions

ALTER TABLE public.transactions
  ADD COLUMN IF EXISTS base_amount NUMERIC(12,2),
  ADD COLUMN IF EXISTS tax_amount NUMERIC(12,2),
  ADD COLUMN IF EXISTS total_amount NUMERIC(12,2),
  ADD COLUMN IF EXISTS gst_rate NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF EXISTS cgst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF EXISTS sgst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF EXISTS igst_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF EXISTS tax_type TEXT DEFAULT 'none';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
