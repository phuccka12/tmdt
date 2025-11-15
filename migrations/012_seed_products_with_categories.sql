-- Tạo categories nếu chưa có
INSERT INTO categories (name, slug, description) VALUES
('Nữ', 'nu', 'Thời trang nữ'),
('Nam', 'nam', 'Thời trang nam'),
('Phụ kiện', 'phu-kien', 'Phụ kiện thời trang'),
('Bộ sưu tập', 'bo-suu-tap', 'Bộ sưu tập đặc biệt')
ON CONFLICT (slug) DO NOTHING;

-- Seed sample products
INSERT INTO products (name, price, image, label, rating, category_id, description) VALUES
('Áo thun nữ basic', '299000', 'https://via.placeholder.com/400x500?text=Ao+thun+nu', 'NEW', 4.5, (SELECT id FROM categories WHERE slug = 'nu'), 'Áo thun cotton 100% cao cấp'),
('Quần jean nữ skinny', '599000', 'https://via.placeholder.com/400x500?text=Quan+jean+nu', 'HOT', 4.8, (SELECT id FROM categories WHERE slug = 'nu'), 'Quần jean co giãn thoải mái'),
('Váy midi hoa', '799000', 'https://via.placeholder.com/400x500?text=Vay+midi', 'SALE', 4.2, (SELECT id FROM categories WHERE slug = 'nu'), 'Váy hoa nhí dịu dàng'),
('Áo sơ mi nam trắng', '399000', 'https://via.placeholder.com/400x500?text=Ao+so+mi+nam', NULL, 4.6, (SELECT id FROM categories WHERE slug = 'nam'), 'Áo sơ mi công sở lịch sự'),
('Quần kaki nam', '499000', 'https://via.placeholder.com/400x500?text=Quan+kaki', 'NEW', 4.4, (SELECT id FROM categories WHERE slug = 'nam'), 'Quần kaki form slim fit'),
('Túi xách nữ', '899000', 'https://via.placeholder.com/400x500?text=Tui+xach', 'HOT', 4.9, (SELECT id FROM categories WHERE slug = 'phu-kien'), 'Túi xách da cao cấp'),
('Mũ lưỡi trai', '199000', 'https://via.placeholder.com/400x500?text=Mu+luoi+trai', NULL, 4.0, (SELECT id FROM categories WHERE slug = 'phu-kien'), 'Mũ baseball unisex'),
('Set đồ bộ mùa hè', '1299000', 'https://via.placeholder.com/400x500?text=Set+bo', 'SALE', 5.0, (SELECT id FROM categories WHERE slug = 'bo-suu-tap'), 'Set đồ bộ mùa hè thời trang')
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT 
  p.id, 
  p.name, 
  p.price, 
  p.label,
  c.name as category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.id DESC
LIMIT 10;
