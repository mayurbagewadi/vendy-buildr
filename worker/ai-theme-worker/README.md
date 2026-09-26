# AI Theme Worker

Standalone background worker for Build Theme AI page generation. Runs on the
VPS as its own process — outside nginx, outside Cloudflare, outside any HTTP
request path. It claims jobs from the `ai_theme_jobs` table, calls OpenRouter
(which can legitimately take 40-180+ seconds), and writes results straight
into the existing `store_ai_themes` / `store_ai_theme_pages` tables.

This exists because the old design called the LLM synchronously from inside
a Supabase Edge Function, awaited directly by the browser. That tied a slow
AI call to one HTTP connection's lifetime, which Cloudflare (~100s) and
Supabase's own edge function wall-clock limit (150s free / 400s paid) will
eventually kill. This worker has no such limit — it makes outbound requests
only, so nothing about it ever passes through `api.digitaldukandar.in`,
nginx, or Cloudflare. **No Cloudflare/DNS changes required, ever, for this
to work.**

## First-time setup on the VPS

```bash
cd /var/www/digitaldukandar/worker/ai-theme-worker
npm install
cp .env.example .env
nano .env   # fill in SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard → Settings → API)
npm run build
```

Install PM2 globally if it isn't already:
```bash
npm install -g pm2
```

Start it:
```bash
pm2 start ecosystem.config.cjs
pm2 save            # persist the process list
pm2 startup         # follow the printed command to survive VPS reboots
```

## Deploying an update

```bash
cd /var/www/digitaldukandar
git pull
cd worker/ai-theme-worker
npm install          # only if package.json changed
npm run build
pm2 restart ai-theme-worker
```

`kill_timeout` in `ecosystem.config.cjs` gives in-flight jobs 15s to finish
cleanly before a forced kill; anything still running past that is safely
recovered by the reaper cron (`reap_stale_ai_theme_jobs`, runs every minute)
within about a minute of the lease expiring — no job is ever silently lost,
worst case it's retried.

## Operating it

```bash
pm2 logs ai-theme-worker       # live logs
pm2 status                     # up/down, restart count, memory
pm2 restart ai-theme-worker    # after a config/.env change
pm2 stop ai-theme-worker       # stop claiming (existing leases still expire
                                # normally and get reaped/retried)
```

Useful SQL for checking queue health (run in Supabase SQL editor):

```sql
-- Current queue depth + oldest waiting job (the real health signal —
-- alert if this climbs past a few minutes with no worker running)
select status, count(*), min(created_at) as oldest
from ai_theme_jobs
where status in ('queued','running')
group by status;

-- Recent failures, to see what's actually going wrong
select page_type, error_message, attempt, created_at
from ai_theme_jobs
where status = 'failed'
order by created_at desc
limit 20;
```

## Scaling

First lever: raise `AI_WORKER_CONCURRENCY` in `.env` (each in-flight call is
just an idle outbound HTTPS request — cheap on CPU/RAM well past 20-30).
Second lever, only once that's maxed and the queue is still backing up: run
a second PM2 process (`pm2 start ecosystem.config.cjs --only ai-theme-worker`
a second time under a different `name`, or a second VPS). The `FOR UPDATE
SKIP LOCKED` claim query makes running multiple workers safe with zero code
changes — they never claim the same job.

Size concurrency to your OpenRouter rate limit and budget, not to your store
count. The queue is the buffer between merchant demand and how fast you can
actually process it.
