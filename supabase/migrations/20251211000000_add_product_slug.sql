-- Add slug column to products table for SEO-friendly URLs
-- This improves Google ranking and user experience

-- Add slug column
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs from existing product names
-- Convert to lowercase, replace spaces with hyphens, remove special chars
-- Append product ID to ensure uniqueness (will be cleaned up later)
UPDATE public.products
SET slug = CASE
  -- If name is empty or becomes empty after cleaning, use 'product-{id}'
  WHEN COALESCE(TRIM(name), '') = '' THEN 'product-' || id
  -- Generate slug from name and append short ID suffix for uniqueness
  ELSE lower(regexp_replace(
    regexp_replace(COALESCE(name, ''), '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )) || '-' || substring(id::text, 1, 8)
END
WHERE slug IS NULL;

-- Clean up any remaining issues (empty slugs, leading/trailing hyphens)
UPDATE public.products
SET slug = CASE
  WHEN slug = '' OR slug = '-' THEN 'product-' || id
  ELSE regexp_replace(regexp_replace(slug, '^-+|-+$', '', 'g'), '-+', '-', 'g')
END
WHERE slug IS NOT NULL;

-- Create unique index on slug per store (each store can have same slug)
CREATE UNIQUE INDEX IF NOT EXISTS products_store_slug_unique
ON public.products(store_id, slug);

-- Add constraint to ensure slug is always set for new products
ALTER TABLE public.products
ADD CONSTRAINT products_slug_not_empty
CHECK (slug IS NOT NULL AND slug != '');
