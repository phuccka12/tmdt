-- Migration 008: orders, order_items, payments
-- Run this against the Supabase/Postgres database
-- NOTE: your existing project appears to use integer (bigint) primary keys for orders/order_items.
-- The original migration used UUIDs; that causes a type mismatch when adding foreign keys.
-- To match the existing schema (bigint ids), this migration uses BIGSERIAL / BIGINT for ids.
CREATE TABLE IF NOT EXISTS orders (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  total numeric DEFAULT 0,
  status text DEFAULT 'pending', -- pending, paid, confirmed, shipped, cancelled
  address text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id bigserial PRIMARY KEY,
  order_id bigint REFERENCES orders(id) ON DELETE CASCADE,
  product_id integer REFERENCES products(id) ON DELETE SET NULL,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id bigserial PRIMARY KEY,
  order_id bigint REFERENCES orders(id) ON DELETE SET NULL,
  provider text,
  provider_payment_id text,
  amount numeric DEFAULT 0,
  currency text DEFAULT 'VND',
  status text DEFAULT 'initiated', -- initiated, success, failed
  raw jsonb,
  created_at timestamptz DEFAULT now()
);

-- update timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_ts BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
