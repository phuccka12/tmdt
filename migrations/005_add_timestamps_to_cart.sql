-- Migration: add created_at and updated_at to cart table and trigger
-- Safe to run multiple times

BEGIN;

-- Add timestamp columns if missing
ALTER TABLE public.cart
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create or replace helper function to set updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists (drop if exists then create)
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'set_updated_at_on_cart' AND c.relname = 'cart'
  ) THEN
    DROP TRIGGER set_updated_at_on_cart ON public.cart;
  END IF;
END
$do$;

CREATE TRIGGER set_updated_at_on_cart
BEFORE UPDATE ON public.cart
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- Usage: paste into Supabase SQL editor and run. This will add timestamps and ensure updates set updated_at automatically.
