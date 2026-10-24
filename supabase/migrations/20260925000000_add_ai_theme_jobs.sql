-- ─────────────────────────────────────────────────────────────────────────────
-- AI Theme Jobs — durable async queue for Build Theme page generation.
--
-- Why this exists: generating one storefront page via the LLM can legitimately
-- take 40-180+ seconds. Calling that synchronously from the browser (the old
-- "generate_theme_page" edge function action) ties the job's lifetime to one
-- HTTP connection, which Cloudflare (~100s) and Supabase's own edge function
-- wall-clock limit (150s free / 400s paid) will eventually kill — with no
-- graceful error, and no record that the job ever ran.
--
-- This table is both the job queue and the single source of truth for job
-- state. A background worker (running on the VPS, outside any HTTP request
-- path) claims rows with FOR UPDATE SKIP LOCKED, does the slow LLM call, and
-- writes results straight into the existing store_ai_themes /
-- store_ai_theme_pages tables — unchanged shape, unchanged validation rules.
-- The browser only ever does fast reads/writes against this table.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS ai_theme_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  page_type        TEXT        NOT NULL CHECK (page_type IN (
                                 'home', 'products', 'categories', 'product_detail',
                                 'cart', 'about', 'policies'
                               )),
  prompt           TEXT        NOT NULL,

  status           TEXT        NOT NULL DEFAULT 'queued' CHECK (status IN (
                                 'queued', 'running', 'succeeded', 'failed', 'cancelled'
                               )),

  -- Retry / scheduling
  attempt          INT         NOT NULL DEFAULT 0,
  max_attempts     INT         NOT NULL DEFAULT 3,
  run_after        TIMESTAMPTZ NOT NULL DEFAULT now(),  -- backoff scheduling for retries

  -- Lease — a worker owns a job only while lease_expires_at is in the future.
  -- The reaper (below) reclaims jobs whose worker died mid-run.
  lease_owner      TEXT,
  lease_expires_at TIMESTAMPTZ,

  cancel_requested BOOLEAN     NOT NULL DEFAULT false,

  -- Result bookkeeping — the actual HTML is written to store_ai_themes /
  -- store_ai_theme_pages by the worker, never duplicated here.
  html_length      INT,
  missing_ids      TEXT[],
  version_id       UUID,
  error_message    TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ
);

-- One active job per (store, page_type) — a second click on "Build" while a
-- page is already queued/running returns the existing job instead of paying
-- for a duplicate LLM call.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_theme_jobs_one_active
  ON ai_theme_jobs (store_id, page_type)
  WHERE status IN ('queued', 'running');

-- Claim query: cheap lookup of the oldest claimable job.
CREATE INDEX IF NOT EXISTS idx_ai_theme_jobs_claimable
  ON ai_theme_jobs (run_after)
  WHERE status = 'queued';

-- Reaper query: running jobs whose lease has expired.
CREATE INDEX IF NOT EXISTS idx_ai_theme_jobs_running_lease
  ON ai_theme_jobs (lease_expires_at)
  WHERE status = 'running';

-- Client polling: "give me every job for this store's most recent batch".
CREATE INDEX IF NOT EXISTS idx_ai_theme_jobs_store_created
  ON ai_theme_jobs (store_id, created_at DESC);

CREATE OR REPLACE FUNCTION _update_ai_theme_jobs_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_theme_jobs_updated_at ON ai_theme_jobs;
CREATE TRIGGER trg_ai_theme_jobs_updated_at
  BEFORE UPDATE ON ai_theme_jobs
  FOR EACH ROW EXECUTE FUNCTION _update_ai_theme_jobs_ts();

ALTER TABLE ai_theme_jobs ENABLE ROW LEVEL SECURITY;

-- Store owner: read-only. Jobs are only ever written by the enqueue RPC
-- (security definer, runs as the authenticated user) or the worker
-- (service role, bypasses RLS). Nobody writes a job row directly.
CREATE POLICY "atj_owner_select" ON ai_theme_jobs
  FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Store owner: can request cancellation of their own job, nothing else.
-- RLS alone only restricts which ROWS an UPDATE can touch, not which
-- COLUMNS — without the column-level grant below, this policy would let an
-- owner PATCH status/result fields directly (e.g. fake a job as
-- 'succeeded'). The grant below is what actually narrows this to
-- cancel_requested; the policy just adds the row-ownership check on top.
CREATE POLICY "atj_owner_cancel" ON ai_theme_jobs
  FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

REVOKE UPDATE ON ai_theme_jobs FROM authenticated;
GRANT UPDATE (cancel_requested) ON ai_theme_jobs TO authenticated;

-- Service role (the VPS worker, and edge functions) bypasses RLS entirely —
-- no explicit policy needed for it.

-- ─── Enqueue (called from the ai-designer edge function, service role) ────
-- NOTE: this is invoked with the service-role key, where auth.uid() is
-- NULL — it is NOT meant to be called directly by an authenticated
-- browser client. The edge function is the trust boundary: it validates
-- that user_id actually owns store_id (matching the pattern already used
-- for every other action in that function) before calling this. This RPC
-- just does the atomic "return existing active job, or insert" step, plus
-- a defensive ownership check of its own.
--
-- Inserts-or-returns-existing per the one-active-job-per-page unique index
-- above, so a double-click on "Build" can never enqueue (and pay for) the
-- same page twice.
CREATE OR REPLACE FUNCTION enqueue_ai_theme_job(
  p_store_id UUID,
  p_user_id UUID,
  p_page_type TEXT,
  p_prompt TEXT
) RETURNS ai_theme_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job ai_theme_jobs;
  v_store_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) INTO v_store_exists;
  IF NOT v_store_exists THEN
    RAISE EXCEPTION 'Store not found';
  END IF;

  -- Existing active job for this page? Return it instead of enqueuing again.
  SELECT * INTO v_job FROM ai_theme_jobs
    WHERE store_id = p_store_id AND page_type = p_page_type
      AND status IN ('queued', 'running')
    LIMIT 1;

  IF v_job.id IS NOT NULL THEN
    RETURN v_job;
  END IF;

  INSERT INTO ai_theme_jobs (store_id, user_id, page_type, prompt)
  VALUES (p_store_id, p_user_id, p_page_type, p_prompt)
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- ─── Claim (service role only — the worker calls this) ────────────────────
CREATE OR REPLACE FUNCTION claim_next_ai_theme_job(
  p_worker TEXT,
  p_lease_seconds INT DEFAULT 240
) RETURNS SETOF ai_theme_jobs
LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM ai_theme_jobs
    WHERE status = 'queued' AND run_after <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    UPDATE ai_theme_jobs
    SET status = 'running',
        attempt = attempt + 1,
        lease_owner = p_worker,
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        started_at = COALESCE(started_at, now())
    WHERE id = v_id
    RETURNING *;
END;
$$;

-- ─── Fenced completion (service role only) ─────────────────────────────────
-- Only succeeds if this worker still owns the lease for this exact attempt —
-- stops a slow/zombie worker from overwriting a newer retry's result.
CREATE OR REPLACE FUNCTION complete_ai_theme_job(
  p_job_id UUID,
  p_worker TEXT,
  p_attempt INT,
  p_html_length INT,
  p_missing_ids TEXT[],
  p_version_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE ai_theme_jobs
  SET status = 'succeeded',
      html_length = p_html_length,
      missing_ids = p_missing_ids,
      version_id = p_version_id,
      finished_at = now()
  WHERE id = p_job_id AND lease_owner = p_worker AND attempt = p_attempt AND status = 'running';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─── Fenced fail/retry (service role only) ─────────────────────────────────
CREATE OR REPLACE FUNCTION fail_ai_theme_job(
  p_job_id UUID,
  p_worker TEXT,
  p_attempt INT,
  p_error TEXT,
  p_retryable BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INT;
  v_max_attempts INT;
BEGIN
  SELECT max_attempts INTO v_max_attempts FROM ai_theme_jobs WHERE id = p_job_id;

  IF p_retryable AND p_attempt < v_max_attempts THEN
    UPDATE ai_theme_jobs
    SET status = 'queued',
        error_message = p_error,
        run_after = now() + make_interval(secs => LEAST(300, 5 * (2 ^ p_attempt)::int) + floor(random() * 5)::int),
        lease_owner = NULL,
        lease_expires_at = NULL
    WHERE id = p_job_id AND lease_owner = p_worker AND attempt = p_attempt AND status = 'running';
  ELSE
    UPDATE ai_theme_jobs
    SET status = 'failed',
        error_message = p_error,
        finished_at = now()
    WHERE id = p_job_id AND lease_owner = p_worker AND attempt = p_attempt AND status = 'running';
  END IF;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─── Heartbeat / cancellation check (service role only) ────────────────────
-- Worker calls this periodically during a long LLM call to extend its lease
-- and find out if the merchant clicked Cancel.
CREATE OR REPLACE FUNCTION extend_ai_theme_job_lease(
  p_job_id UUID,
  p_worker TEXT,
  p_attempt INT,
  p_lease_seconds INT DEFAULT 240
) RETURNS TABLE (still_owned BOOLEAN, cancel_requested BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
  v_rows INT;
  v_cancel BOOLEAN;
BEGIN
  UPDATE ai_theme_jobs
  SET lease_expires_at = now() + make_interval(secs => p_lease_seconds)
  WHERE id = p_job_id AND lease_owner = p_worker AND attempt = p_attempt AND status = 'running'
  RETURNING ai_theme_jobs.cancel_requested INTO v_cancel;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN QUERY SELECT (v_rows > 0), COALESCE(v_cancel, false);
END;
$$;

-- ─── Reaper — reclaims jobs whose worker died mid-run ──────────────────────
-- Also fails jobs that sat in 'queued' too long (no worker running at all),
-- so the UI never waits forever with no explanation.
CREATE OR REPLACE FUNCTION reap_stale_ai_theme_jobs()
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Worker died mid-run: retry if attempts remain, else fail.
  UPDATE ai_theme_jobs
  SET status = CASE WHEN attempt < max_attempts THEN 'queued' ELSE 'failed' END,
      run_after = now() + interval '5 seconds',
      lease_owner = NULL,
      lease_expires_at = NULL,
      error_message = COALESCE(error_message, 'Worker lost (lease expired)'),
      finished_at = CASE WHEN attempt < max_attempts THEN NULL ELSE now() END
  WHERE status = 'running' AND lease_expires_at < now();

  -- No worker has picked this up in 20+ minutes — something is fully down.
  UPDATE ai_theme_jobs
  SET status = 'failed',
      error_message = 'No worker available (queued too long)',
      finished_at = now()
  WHERE status = 'queued' AND created_at < now() - interval '20 minutes';
END;
$$;

SELECT cron.schedule(
  'reap-stale-ai-theme-jobs',
  '* * * * *',  -- every minute
  $$SELECT public.reap_stale_ai_theme_jobs()$$
);

-- ─── Lock these down to service_role only ──────────────────────────────────
-- Postgres grants EXECUTE on new functions to PUBLIC by default. Every
-- function above except the table's own RLS-governed SELECT/UPDATE is meant
-- to be called ONLY by the edge function or the VPS worker, both of which
-- use the service-role key. Without this, an authenticated browser user
-- could call enqueue_ai_theme_job directly with an arbitrary p_user_id (it
-- trusts that parameter — the edge function is the trust boundary, not this
-- function), or call claim/complete/fail/extend and interfere with other
-- stores' jobs, or trigger the reaper on demand.
REVOKE EXECUTE ON FUNCTION enqueue_ai_theme_job(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_next_ai_theme_job(TEXT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_ai_theme_job(UUID, TEXT, INT, INT, TEXT[], UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION fail_ai_theme_job(UUID, TEXT, INT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION extend_ai_theme_job_lease(UUID, TEXT, INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION reap_stale_ai_theme_jobs() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION enqueue_ai_theme_job(UUID, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_ai_theme_job(TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION complete_ai_theme_job(UUID, TEXT, INT, INT, TEXT[], UUID) TO service_role;
GRANT EXECUTE ON FUNCTION fail_ai_theme_job(UUID, TEXT, INT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION extend_ai_theme_job_lease(UUID, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION reap_stale_ai_theme_jobs() TO service_role;
