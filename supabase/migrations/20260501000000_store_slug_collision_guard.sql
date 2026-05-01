-- Prevents a store's subdomain from matching another store's slug (and vice versa).
-- Without this, the OR query used in store lookups can return two rows,
-- causing maybeSingle() errors and making both stores unreachable.

CREATE OR REPLACE FUNCTION check_slug_subdomain_no_collision()
RETURNS TRIGGER AS $$
BEGIN
  -- When subdomain is being set, reject if any OTHER store has that value as its slug
  IF NEW.subdomain IS NOT NULL AND NEW.subdomain != '' THEN
    IF EXISTS (
      SELECT 1 FROM stores
      WHERE LOWER(slug) = LOWER(NEW.subdomain)
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION
        'subdomain "%" conflicts with an existing store slug. Choose a different subdomain.',
        NEW.subdomain;
    END IF;
  END IF;

  -- When slug is being set, reject if any OTHER store has that value as its subdomain
  IF NEW.slug IS NOT NULL AND NEW.slug != '' THEN
    IF EXISTS (
      SELECT 1 FROM stores
      WHERE LOWER(subdomain) = LOWER(NEW.slug)
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION
        'slug "%" conflicts with an existing store subdomain. Choose a different slug.',
        NEW.slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stores_slug_subdomain_collision_check ON stores;

CREATE TRIGGER stores_slug_subdomain_collision_check
  BEFORE INSERT OR UPDATE OF slug, subdomain ON stores
  FOR EACH ROW
  EXECUTE FUNCTION check_slug_subdomain_no_collision();
