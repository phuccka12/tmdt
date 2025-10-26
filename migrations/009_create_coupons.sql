-- Migration 009: coupons and coupon_usages
CREATE TABLE IF NOT EXISTS coupons (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'fixed', -- 'fixed' or 'percent'
  amount numeric NOT NULL DEFAULT 0,
  usage_limit integer DEFAULT NULL,
  used_count integer DEFAULT 0,
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_usages (
  id bigserial PRIMARY KEY,
  coupon_id bigint REFERENCES coupons(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  order_id bigint REFERENCES orders(id) ON DELETE SET NULL,
  used_at timestamptz DEFAULT now()
);
