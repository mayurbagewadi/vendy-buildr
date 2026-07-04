-- Harden storefront theme publishing.
-- Live storefronts must only receive a structurally valid published draft.
-- This migration does not touch AI Designer or payment systems.

CREATE OR REPLACE FUNCTION public.validate_store_theme_draft_payload(
  p_theme_id TEXT,
  p_theme_version TEXT,
  p_settings JSONB,
  p_page_layout JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  section JSONB;
  block JSONB;
  section_count INTEGER;
  block_count INTEGER;
BEGIN
  IF COALESCE(BTRIM(p_theme_id), '') = '' THEN
    RAISE EXCEPTION 'Theme id is required';
  END IF;

  IF p_theme_id <> 'default' AND COALESCE(BTRIM(p_theme_version), '') = '' THEN
    RAISE EXCEPTION 'Theme version is required for runtime themes';
  END IF;

  IF jsonb_typeof(COALESCE(p_settings, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Theme settings must be a JSON object';
  END IF;

  IF jsonb_typeof(COALESCE(p_page_layout, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Theme page layout must be a JSON object';
  END IF;

  IF pg_column_size(COALESCE(p_settings, '{}'::jsonb)) > 65536 THEN
    RAISE EXCEPTION 'Theme settings payload is too large';
  END IF;

  IF pg_column_size(COALESCE(p_page_layout, '{}'::jsonb)) > 262144 THEN
    RAISE EXCEPTION 'Theme page layout payload is too large';
  END IF;

  IF p_page_layout ? 'sections' THEN
    IF jsonb_typeof(p_page_layout->'sections') <> 'array' THEN
      RAISE EXCEPTION 'Theme page layout sections must be an array';
    END IF;

    section_count := jsonb_array_length(p_page_layout->'sections');
    IF section_count > 25 THEN
      RAISE EXCEPTION 'Theme page layout cannot contain more than 25 sections';
    END IF;

    FOR section IN SELECT value FROM jsonb_array_elements(p_page_layout->'sections')
    LOOP
      IF jsonb_typeof(section) <> 'object' THEN
        RAISE EXCEPTION 'Theme section must be a JSON object';
      END IF;

      IF COALESCE(BTRIM(section->>'id'), '') = '' THEN
        RAISE EXCEPTION 'Theme section id is required';
      END IF;

      IF COALESCE(BTRIM(section->>'type'), '') = '' THEN
        RAISE EXCEPTION 'Theme section type is required';
      END IF;

      IF section ? 'order' AND jsonb_typeof(section->'order') <> 'number' THEN
        RAISE EXCEPTION 'Theme section order must be a number';
      END IF;

      IF section ? 'visible' AND jsonb_typeof(section->'visible') <> 'boolean' THEN
        RAISE EXCEPTION 'Theme section visible must be a boolean';
      END IF;

      IF section ? 'settings' AND jsonb_typeof(section->'settings') <> 'object' THEN
        RAISE EXCEPTION 'Theme section settings must be a JSON object';
      END IF;

      IF section ? 'blocks' THEN
        IF jsonb_typeof(section->'blocks') <> 'array' THEN
          RAISE EXCEPTION 'Theme section blocks must be an array';
        END IF;

        block_count := jsonb_array_length(section->'blocks');
        IF block_count > 50 THEN
          RAISE EXCEPTION 'Theme section cannot contain more than 50 blocks';
        END IF;

        FOR block IN SELECT value FROM jsonb_array_elements(section->'blocks')
        LOOP
          IF jsonb_typeof(block) <> 'object' THEN
            RAISE EXCEPTION 'Theme block must be a JSON object';
          END IF;

          IF COALESCE(BTRIM(block->>'id'), '') = '' THEN
            RAISE EXCEPTION 'Theme block id is required';
          END IF;

          IF COALESCE(BTRIM(block->>'type'), '') = '' THEN
            RAISE EXCEPTION 'Theme block type is required';
          END IF;

          IF block ? 'settings' AND jsonb_typeof(block->'settings') <> 'object' THEN
            RAISE EXCEPTION 'Theme block settings must be a JSON object';
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
END;
$$;

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

  PERFORM public.validate_store_theme_draft_payload(
    theme_state.draft_theme_id,
    theme_state.draft_theme_version,
    theme_state.draft_settings,
    theme_state.draft_page_layout
  );

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

GRANT EXECUTE ON FUNCTION public.validate_store_theme_draft_payload(TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_store_theme_draft(UUID) TO authenticated;
