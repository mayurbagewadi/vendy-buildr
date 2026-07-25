-- Store-level GST MVP and immutable order GST snapshots.
-- Product-level GST/HSN and e-invoice/IRN are intentionally out of scope.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_price_includes_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_show_on_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_prefix text DEFAULT 'INV',
  ADD COLUMN IF NOT EXISTS next_invoice_number integer NOT NULL DEFAULT 1001;

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_gst_rate_range,
  ADD CONSTRAINT stores_gst_rate_range CHECK (gst_rate >= 0 AND gst_rate <= 40);

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_next_invoice_number_positive,
  ADD CONSTRAINT stores_next_invoice_number_positive CHECK (next_invoice_number > 0);

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_gstin_format,
  ADD CONSTRAINT stores_gstin_format CHECK (
    gstin IS NULL
    OR gstin = ''
    OR gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gst_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS gst_price_includes_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gst_show_on_summary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS taxable_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_prefix text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS gst_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_store_invoice_number
ON public.orders(store_id, invoice_number)
WHERE invoice_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_order_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next integer;
  v_should_assign boolean;
BEGIN
  v_should_assign := NEW.gst_enabled = true
    AND NEW.invoice_number IS NULL
    AND COALESCE(NEW.payment_status, 'pending') NOT IN ('awaiting_payment', 'failed');

  IF NOT v_should_assign THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(NULLIF(invoice_prefix, ''), 'INV'),
    next_invoice_number
  INTO v_prefix, v_next
  FROM public.stores
  WHERE id = NEW.store_id
  FOR UPDATE;

  IF v_next IS NULL THEN
    v_next := 1001;
  END IF;

  NEW.invoice_prefix := COALESCE(NULLIF(NEW.invoice_prefix, ''), v_prefix);
  NEW.invoice_number := NEW.invoice_prefix || '-' || lpad(v_next::text, 6, '0');
  NEW.invoice_issued_at := COALESCE(NEW.invoice_issued_at, now());

  UPDATE public.stores
  SET next_invoice_number = v_next + 1
  WHERE id = NEW.store_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_order_invoice_number_on_insert ON public.orders;
CREATE TRIGGER assign_order_invoice_number_on_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_invoice_number();

DROP TRIGGER IF EXISTS assign_order_invoice_number_on_payment_update ON public.orders;
CREATE TRIGGER assign_order_invoice_number_on_payment_update
BEFORE UPDATE OF payment_status ON public.orders
FOR EACH ROW
WHEN (OLD.invoice_number IS NULL AND NEW.invoice_number IS NULL)
EXECUTE FUNCTION public.assign_order_invoice_number();

COMMENT ON COLUMN public.stores.gst_rate IS 'Store-level default GST percentage for the GST MVP. Product-level GST is intentionally not implemented yet.';
COMMENT ON COLUMN public.orders.gst_snapshot IS 'Immutable GST settings and calculated amounts captured when the order was placed.';
