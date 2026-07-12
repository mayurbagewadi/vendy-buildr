-- Harden storefront theme publishing.
-- Live storefronts must only receive a structurally valid published draft.
-- This migration does not touch AI Designer or payment systems.

DROP FUNCTION IF EXISTS public.validate_store_theme_draft_payload(TEXT, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.publish_store_theme_draft(UUID);
DROP FUNCTION IF EXISTS public.rollback_store_theme_version(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.validate_store_theme_draft_payload(
  p_theme_id TEXT,
  p_theme_version TEXT,
  p_settings JSONB,
  p_layout JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  page_key TEXT;
  page_value JSONB;
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

  IF jsonb_typeof(COALESCE(p_layout, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Theme layout must be a JSON object';
  END IF;

  IF pg_column_size(COALESCE(p_settings, '{}'::jsonb)) > 65536 THEN
    RAISE EXCEPTION 'Theme settings payload is too large';
  END IF;

  IF pg_column_size(COALESCE(p_layout, '{}'::jsonb)) > 262144 THEN
    RAISE EXCEPTION 'Theme layout payload is too large';
  END IF;

  IF p_layout ? 'pages' THEN
    IF jsonb_typeof(p_layout->'pages') <> 'object' THEN
      RAISE EXCEPTION 'Theme layout pages must be a JSON object';
    END IF;

    FOR page_key, page_value IN SELECT key, value FROM jsonb_each(p_layout->'pages')
    LOOP
      IF jsonb_typeof(page_value) <> 'object' THEN
        RAISE EXCEPTION 'Theme page layout must be a JSON object';
      END IF;

      IF page_value ? 'sections' THEN
        IF jsonb_typeof(page_value->'sections') <> 'array' THEN
          RAISE EXCEPTION 'Theme page sections must be an array';
        END IF;

        section_count := jsonb_array_length(page_value->'sections');
        IF section_count > 25 THEN
          RAISE EXCEPTION 'Theme page cannot contain more than 25 sections';
        END IF;

        FOR section IN SELECT value FROM jsonb_array_elements(page_value->'sections')
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
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_store_theme_draft(p_store_id UUID)
RETURNS public.store_theme_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  theme_state public.store_theme_states%ROWTYPE;
  created_version public.store_theme_versions%ROWTYPE;
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
  FROM public.store_theme_states
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.store_theme_states (store_id)
    VALUES (p_store_id)
    RETURNING * INTO theme_state;
  END IF;

  PERFORM public.validate_store_theme_draft_payload(
    theme_state.draft_theme_id,
    theme_state.draft_theme_version,
    theme_state.draft_settings,
    theme_state.draft_layout
  );

  next_version := theme_state.publish_sequence + 1;

  INSERT INTO public.store_theme_versions (
    store_id,
    version_number,
    theme_id,
    theme_version,
    settings,
    layout,
    assets,
    published_by,
    reason
  )
  VALUES (
    theme_state.store_id,
    next_version,
    theme_state.draft_theme_id,
    theme_state.draft_theme_version,
    theme_state.draft_settings,
    theme_state.draft_layout,
    theme_state.draft_assets,
    auth.uid(),
    'publish'
  )
  RETURNING * INTO created_version;

  UPDATE public.store_theme_states
  SET
    published_version_id = created_version.id,
    publish_sequence = next_version,
    updated_at = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO theme_state;

  RETURN theme_state;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_store_theme_version(
  p_store_id UUID,
  p_version_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.store_theme_states
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_state public.store_theme_states%ROWTYPE;
  rollback_version public.store_theme_versions%ROWTYPE;
  created_version public.store_theme_versions%ROWTYPE;
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
  INTO current_state
  FROM public.store_theme_states
  WHERE store_id = p_store_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme state not found for store';
  END IF;

  SELECT *
  INTO rollback_version
  FROM public.store_theme_versions
  WHERE id = p_version_id
    AND store_id = p_store_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme version not found for store';
  END IF;

  PERFORM public.validate_store_theme_draft_payload(
    rollback_version.theme_id,
    rollback_version.theme_version,
    rollback_version.settings,
    rollback_version.layout
  );

  next_version := current_state.publish_sequence + 1;

  INSERT INTO public.store_theme_versions (
    store_id,
    version_number,
    theme_id,
    theme_version,
    settings,
    layout,
    assets,
    published_by,
    rollback_of_version_id,
    rollback_by,
    rollback_at,
    reason
  )
  VALUES (
    p_store_id,
    next_version,
    rollback_version.theme_id,
    rollback_version.theme_version,
    rollback_version.settings,
    rollback_version.layout,
    rollback_version.assets,
    auth.uid(),
    rollback_version.id,
    auth.uid(),
    NOW(),
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'rollback')
  )
  RETURNING * INTO created_version;

  UPDATE public.store_theme_states
  SET
    draft_theme_id = created_version.theme_id,
    draft_theme_version = created_version.theme_version,
    draft_settings = created_version.settings,
    draft_layout = created_version.layout,
    draft_assets = created_version.assets,
    published_version_id = created_version.id,
    publish_sequence = next_version,
    updated_at = NOW()
  WHERE store_id = p_store_id
  RETURNING * INTO current_state;

  RETURN current_state;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_store_theme_draft_payload(TEXT, TEXT, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_store_theme_draft(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_store_theme_version(UUID, UUID, TEXT) TO authenticated;
