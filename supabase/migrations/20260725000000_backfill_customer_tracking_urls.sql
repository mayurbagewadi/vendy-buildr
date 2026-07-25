-- Use the platform tracking page instead of Delhivery's phone-gated public page.

WITH delhivery_urls AS (
  SELECT
    sh.id AS shipment_id,
    sh.order_id,
    CASE
      WHEN st.custom_domain IS NOT NULL
        AND st.custom_domain <> ''
        AND COALESCE(st.custom_domain_verified, false) = true
        THEN 'https://' || st.custom_domain || '/track/' || sh.awb
      WHEN st.subdomain IS NOT NULL
        AND st.subdomain <> ''
        THEN 'https://' || st.subdomain || '.digitaldukandar.in/track/' || sh.awb
      ELSE 'https://digitaldukandar.in/' || st.slug || '/track/' || sh.awb
    END AS customer_tracking_url
  FROM public.shipments sh
  JOIN public.stores st ON st.id = sh.store_id
  WHERE sh.provider = 'delhivery'
    AND sh.awb IS NOT NULL
    AND sh.awb <> ''
)
UPDATE public.shipments sh
SET tracking_url = du.customer_tracking_url
FROM delhivery_urls du
WHERE sh.id = du.shipment_id;

WITH delhivery_urls AS (
  SELECT
    sh.order_id,
    CASE
      WHEN st.custom_domain IS NOT NULL
        AND st.custom_domain <> ''
        AND COALESCE(st.custom_domain_verified, false) = true
        THEN 'https://' || st.custom_domain || '/track/' || sh.awb
      WHEN st.subdomain IS NOT NULL
        AND st.subdomain <> ''
        THEN 'https://' || st.subdomain || '.digitaldukandar.in/track/' || sh.awb
      ELSE 'https://digitaldukandar.in/' || st.slug || '/track/' || sh.awb
    END AS customer_tracking_url
  FROM public.shipments sh
  JOIN public.stores st ON st.id = sh.store_id
  WHERE sh.provider = 'delhivery'
    AND sh.awb IS NOT NULL
    AND sh.awb <> ''
)
UPDATE public.orders o
SET tracking_url = du.customer_tracking_url
FROM delhivery_urls du
WHERE o.id = du.order_id;
