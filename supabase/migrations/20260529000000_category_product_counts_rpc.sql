CREATE OR REPLACE FUNCTION public.get_category_product_counts(p_store_id uuid)
RETURNS TABLE(category text, product_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.category,
    count(*)::bigint AS product_count
  FROM public.products p
  WHERE p.store_id = p_store_id
    AND p.status = 'published'
    AND p.category IS NOT NULL
    AND btrim(p.category) <> ''
  GROUP BY p.category
$$;

GRANT EXECUTE ON FUNCTION public.get_category_product_counts(uuid) TO anon, authenticated;
