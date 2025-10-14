-- Seed sample categories, products and variants for testing
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)

BEGIN;

-- Categories
INSERT INTO categories (id, name, slug)
VALUES
  (100, 'Nữ', 'nu')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, slug)
VALUES
  (101, 'Nam', 'nam')
  ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, slug)
VALUES
  (102, 'Phụ kiện', 'phu-kien')
  ON CONFLICT (id) DO NOTHING;

-- Products for Nữ
INSERT INTO products (id, name, price, image, label, rating, category_id)
VALUES
  (200, 'Áo thể thao nữ - AeroFlex', 549000, 'https://images.unsplash.com/photo-1520975913059-4a4e7b6b1b9f?w=800', 'NEW', 4.5, 100),
  (201, 'Quần legging nữ - PowerFit', 399000, 'https://images.unsplash.com/photo-1534438327274-8e9b1b4f4e0b?w=800', NULL, 4.2, 100),
  (202, 'Áo khoác nhẹ nữ - WindRun', 799000, 'https://images.unsplash.com/photo-1542293787938-c9e299b88035?w=800', 'HOT', 4.7, 100)
ON CONFLICT (id) DO NOTHING;

-- Products for Nam
INSERT INTO products (id, name, price, image, label, rating, category_id)
VALUES
  (210, 'Áo thun nam - SportMax', 399000, 'https://images.unsplash.com/photo-1519744792095-2f2205e87b6f?w=800', NULL, 4.3, 101),
  (211, 'Quần short nam - FlexShort', 299000, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 'SALE', 4.1, 101),
  (212, 'Áo khoác nam - TrailPro', 1099000, 'https://images.unsplash.com/photo-1503342452485-86f7a1ff1f7e?w=800', 'NEW', 4.6, 101)
ON CONFLICT (id) DO NOTHING;

-- Products for Phụ kiện
INSERT INTO products (id, name, price, image, label, rating, category_id)
VALUES
  (220, 'Balo thể thao - CarryAll', 499000, 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800', NULL, 4.4, 102),
  (221, 'Mũ lưỡi trai thể thao', 199000, 'https://images.unsplash.com/photo-1545987798-8e0b6a4b3b8a?w=800', NULL, 4.0, 102),
  (222, 'Bịt tai chống ồn - SportEar', 129000, 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=800', 'SALE', 3.9, 102)
ON CONFLICT (id) DO NOTHING;

-- Simple variants for each product (sizes/colors)
INSERT INTO product_variants (id, product_id, size, stock, price_vnd)
VALUES
  (300, 200, 'S', 20, 549000),
  (301, 200, 'M', 15, 549000),
  (302, 201, 'S', 25, 399000),
  (303, 201, 'M', 18, 399000),
  (304, 202, 'M', 10, 799000),

  (310, 210, 'M', 30, 399000),
  (311, 211, 'L', 12, 299000),
  (312, 212, 'XL', 8, 1099000),

  (320, 220, 'OneSize', 40, 499000),
  (321, 221, 'OneSize', 50, 199000),
  (322, 222, 'OneSize', 60, 129000)
ON CONFLICT (id) DO NOTHING;

COMMIT;

/*
Usage: copy-paste into Supabase SQL editor and run, or run with psql against your DB.
If your schema uses different column names (camelCase vs snake_case), adjust column names accordingly.
*/
