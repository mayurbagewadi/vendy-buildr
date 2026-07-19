-- ============================================
-- Store Theme Publish / Rollback RPCs
-- Keep publish state transitions atomic and reusable.
-- ============================================

CREATE OR REPLACE FUNCTION public.publish_store_theme_draft(p_store_id UUID)
RETURNS public.store_theme_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  theme_state public.store_theme_state%ROWTYPE;
  next_version INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.stores
    WHERE id = p_store_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to publish this store theme';
  END IF;

  SELECT *
  INTO theme_state
  FROM public.store_theme_state
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme state not found for store';
  END IF;

  next_version := theme_state.version + 1;

  UPDATE public.store_theme_state
  SET
    published_theme_id = draft_theme_id,
    published_theme_version = draft_theme_version,
    published_settings = draft_settings,
    published_page_layout = draft_page_layout,
    published_at = NOW(),
    published_by = auth.uid(),
    version = next_version,
    updated_at = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO theme_state;

  INSERT INTO public.store_theme_snapshots (
    store_id,
    version,
    theme_id,
    theme_version,
    settings,
    page_layout,
    reason,
    created_by
  )
  VALUES (
    theme_state.store_id,
    theme_state.version,
    theme_state.published_theme_id,
    theme_state.published_theme_version,
    theme_state.published_settings,
    theme_state.published_page_layout,
    'publish',
    auth.uid()
  );

  RETURN theme_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_store_theme_snapshot(
  p_store_id UUID,
  p_snapshot_id UUID
)
RETURNS public.store_theme_state
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot_row public.store_theme_snapshots%ROWTYPE;
  theme_state public.store_theme_state%ROWTYPE;
  next_version INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.stores
    WHERE id = p_store_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to rollback this store theme';
  END IF;

  SELECT *
  INTO snapshot_row
  FROM public.store_theme_snapshots
  WHERE id = p_snapshot_id
    AND store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme snapshot not found';
  END IF;

  SELECT *
  INTO theme_state
  FROM public.store_theme_state
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme state not found for store';
  END IF;

  next_version := theme_state.version + 1;

  UPDATE public.store_theme_state
  SET
    draft_theme_id = snapshot_row.theme_id,
    draft_theme_version = snapshot_row.theme_version,
    draft_settings = snapshot_row.settings,
    draft_page_layout = snapshot_row.page_layout,
    draft_updated_at = NOW(),
    published_theme_id = snapshot_row.theme_id,
    published_theme_version = snapshot_row.theme_version,
    published_settings = snapshot_row.settings,
    published_page_layout = snapshot_row.page_layout,
    published_at = NOW(),
    published_by = auth.uid(),
    version = next_version,
    updated_at = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO theme_state;

  INSERT INTO public.store_theme_snapshots (
    store_id,
    version,
    theme_id,
    theme_version,
    settings,
    page_layout,
    reason,
    created_by
  )
  VALUES (
    theme_state.store_id,
    theme_state.version,
    theme_state.published_theme_id,
    theme_state.published_theme_version,
    theme_state.published_settings,
    theme_state.published_page_layout,
    'rollback',
    auth.uid()
  );

  RETURN theme_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_store_theme_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_store_theme_snapshot(UUID, UUID) TO authenticated;
