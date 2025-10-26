-- Migration 010: add coupon_id and discount_amount to orders
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS coupon_id bigint NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- Add FK to coupons if table exists (compatibly: check constraint existence first)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coupons') THEN
    -- Only add the constraint if it does not already exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'orders_coupon_id_fkey'
    ) THEN
      ALTER TABLE orders
        ADD CONSTRAINT orders_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;
    END IF;
  END IF;
END$$;
