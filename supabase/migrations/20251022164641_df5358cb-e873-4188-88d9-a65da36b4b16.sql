-- Create demo store
INSERT INTO stores (id, user_id, name, slug, description, logo_url, hero_banner_url, whatsapp_number, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Demo Store',
  'demo',
  'Explore our amazing collection of products across multiple categories',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
  '+1234567890',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  logo_url = EXCLUDED.logo_url,
  hero_banner_url = EXCLUDED.hero_banner_url,
  whatsapp_number = EXCLUDED.whatsapp_number;

-- Create categories for demo store
INSERT INTO categories (id, store_id, name, image_url) VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Electronics', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400'),
  ('10000000-0000-0000-0000-000000000002'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Fashion', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400'),
  ('10000000-0000-0000-0000-000000000003'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Home & Kitchen', 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400'),
  ('10000000-0000-0000-0000-000000000004'::uuid, '00000000-0000-0000-0000-000000000001'::uuid, 'Sports', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url;

-- Create products for demo store
INSERT INTO products (id, store_id, name, description, category, base_price, price_range, stock, images, status) VALUES
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Wireless Headphones',
    'Premium wireless headphones with noise cancellation and crystal clear sound quality',
    'Electronics',
    2999,
    '₹2,999',
    50,
    '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Smart Watch',
    'Fitness tracker with heart rate monitor, GPS, and waterproof design',
    'Electronics',
    4999,
    '₹4,999',
    30,
    '["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Classic T-Shirt',
    'Comfortable cotton t-shirt available in multiple colors',
    'Fashion',
    599,
    '₹599 - ₹799',
    100,
    '["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000004'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Denim Jeans',
    'Stylish slim-fit denim jeans for casual wear',
    'Fashion',
    1299,
    '₹1,299',
    75,
    '["https://images.unsplash.com/photo-1542272604-787c3835535d?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Coffee Maker',
    'Automatic coffee maker with programmable timer and brew strength selector',
    'Home & Kitchen',
    3499,
    '₹3,499',
    25,
    '["https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Blender',
    'High-speed blender perfect for smoothies and food preparation',
    'Home & Kitchen',
    2299,
    '₹2,299',
    40,
    '["https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000007'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Yoga Mat',
    'Non-slip yoga mat with carrying strap, perfect for home or gym workouts',
    'Sports',
    899,
    '₹899',
    60,
    '["https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800"]'::jsonb,
    'published'
  ),
  (
    '20000000-0000-0000-0000-000000000008'::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Running Shoes',
    'Lightweight running shoes with cushioned sole for maximum comfort',
    'Sports',
    3999,
    '₹3,999 - ₹4,499',
    45,
    '["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800"]'::jsonb,
    'published'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  price_range = EXCLUDED.price_range,
  stock = EXCLUDED.stock,
  images = EXCLUDED.images,
  status = EXCLUDED.status;