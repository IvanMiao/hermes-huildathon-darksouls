# Cloudflare Pages + D1 + R2 + Tunnel deployment

Soulloom keeps completed games entirely on Cloudflare while the Hermes process
stays isolated on the Studio laptop:

```text
Browser
  -> Cloudflare Pages /api/* Function
       ├── /api/evidence/* -> D1 run evidence + R2 audio
       └── /api/studio/*   -> Access -> Tunnel -> local Hermes runner

Local Hermes runner
  -> protected Pages evidence API
       -> ElevenLabs -> R2 audio -> D1 completed run
```

The Tunnel connects only to `127.0.0.1:8787`; it does not expose the laptop's
filesystem or a container socket. Completed game URLs read D1 and R2 directly,
so they remain playable when the runner or Tunnel is offline.

## 1. Create the Cloudflare storage

Authenticate Wrangler, create one D1 database and one Standard-class R2 bucket,
then apply the committed schema:

```bash
npx wrangler login
npm run cloudflare:db:create
npx wrangler r2 bucket create soulloom-artifacts
npm run cloudflare:db:migrate
```

`migrations/0001_cloudflare_evidence.sql` creates `studio_runs` and
`generated_audio`. The migration is idempotent and the runner mirrors each run
under its existing `run_id`.

The committed `wrangler.toml` binds both resources for direct deployments:

| Binding | Resource |
|---|---|
| `SOULLOOM_DB` | D1 database `soulloom-evidence` |
| `SOULLOOM_ARTIFACTS` | R2 bucket `soulloom-artifacts` |

If the database or bucket is recreated, update its ID/name in `wrangler.toml`
before deploying. Dashboard-managed deployments must expose the same binding
names in both Production and Preview.

Cloudflare's current free allowances are sufficient for a buildathon-scale
demo, but they are usage limits rather than unlimited hosting. D1 Free includes
5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. R2
Standard includes 10 GB-month storage, 1 million Class A operations/month, and
10 million Class B operations/month; R2 requires enabling its subscription even
when usage remains inside the free allowance. See Cloudflare's current
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[R2 pricing](https://developers.cloudflare.com/r2/pricing/), and
[Pages binding guide](https://developers.cloudflare.com/pages/functions/bindings/)
before provisioning.

## 2. Configure the Pages Function

Add these Production secrets and variables:

| Name | Type | Purpose |
|---|---|---|
| `STUDIO_INTEGRATION_TOKEN` | encrypted secret | authenticates runner and migration writes to D1/R2 |
| `ELEVENLABS_API_KEY` | encrypted secret | generates voice and music inside the Pages Function |
| `ELEVENLABS_VOICE_ID` | encrypted secret | approved ElevenLabs library voice |
| `STUDIO_RUNNER_ORIGIN` | variable | protected Tunnel origin, for example `https://studio-api.example.com` |
| `STUDIO_RUNNER_API_TOKEN` | encrypted secret | authenticates Pages to the local runner |
| `CF_ACCESS_CLIENT_ID` | encrypted secret | Access service-token client ID |
| `CF_ACCESS_CLIENT_SECRET` | encrypted secret | Access service-token secret |

Use two different random values for `STUDIO_INTEGRATION_TOKEN` and
`STUDIO_RUNNER_API_TOKEN`. Neither secret may use a `VITE_*` name.

The Pages build remains:

```text
Build command: npm run build
Build output directory: dist
```

The committed `functions/api/[[path]].ts` routes evidence requests to D1/R2 and
all other API requests through the protected runner proxy. `public/_routes.json`
limits Function invocation to `/api/*`.

## 3. Configure the local runner and Tunnel

Copy `.env.example` to `.env.local` and configure:

```text
CLOUDFLARE_EVIDENCE_URL=https://<pages-domain>
STUDIO_INTEGRATION_TOKEN=<same integration token as Pages>
SOULLOOM_RUNNER_API_TOKEN=<different, at-least-32-character token>
SOULLOOM_HERMES_PROVIDER=<provider>
SOULLOOM_HERMES_MODEL=<model>
```

The ElevenLabs key now belongs only to the Pages environment, not the laptop or
browser. Start and verify the runner:

```bash
npm run studio:server
curl http://127.0.0.1:8787/api/health
```

Create a managed Tunnel hostname such as `studio-api.example.com` pointing to
`http://127.0.0.1:8787`. Protect it with a Cloudflare Access self-hosted
application and a `Service Auth` policy. Give only the Pages Function's service
token access; do not configure a public bypass.

## 4. Migrate existing evidence

Deploy the new Function and bindings before migrating data. The default demo
audio is migrated from its old storage URLs with:

```bash
npm run cloudflare:migrate:legacy
```

To preserve historical runs, export the old `studioRuns` table as JSONL, then
pass the extracted `documents.jsonl` path:

```bash
npm run cloudflare:migrate:legacy -- /absolute/path/to/studioRuns/documents.jsonl
```

The script downloads each legacy voice/music file, writes it to R2, rewrites
recipe and artifact URLs, and upserts the completed run into D1. It is safe to
rerun for the same `run_id`. Keep the old service available until the default
audio and every required historical run have passed the acceptance gate.

## 5. Local end-to-end check

The fast local workflow still uses the deterministic runner and Vite:

```bash
npm run studio:server:local
npm run dev
```

When `CLOUDFLARE_EVIDENCE_URL` is set, Vite proxies `/api/evidence` to that Pages
deployment and the remaining `/api` routes to port 8787. To emulate the actual
Pages Function locally instead, copy `.dev.vars.example` to `.dev.vars`, build,
and pass the D1/R2 bindings to Wrangler:

```bash
npm run build
npx wrangler pages dev dist \
  --d1 SOULLOOM_DB=<database-id> \
  --r2 SOULLOOM_ARTIFACTS=soulloom-artifacts
```

## 6. Production acceptance gate

1. `GET https://<pages-domain>/api/health` reports `agentMode: "hermes"`.
2. A migrated or newly completed run returns its durable D1 evidence.
3. Both `/api/evidence/artifacts/demo-fable/*.mp3` URLs support browser playback
   and byte-range requests.
4. A Studio submission enters the live Control Room immediately and receives
   ordered runner SSE updates.
5. A duplicate idempotency key does not create a second Hermes run; a concurrent
   production receives `429` and `Retry-After: 5`.
6. A successful job reports `cloudflareEvidence: "mirrored"`, includes generated
   voice/music artifacts, and unlocks `OPEN BOSS FIGHT`.
7. `/games/:runId` loads its recipe from D1 and its audio from R2.
8. Stop the local runner and Tunnel: the completed Control Room and game still
   load, while new Studio production fails clearly.

## 7. Secret rotation and fast diagnosis

The runner API token pair is:

```text
local .env.local:              SOULLOOM_RUNNER_API_TOKEN
Cloudflare Pages Production:  STUDIO_RUNNER_API_TOKEN
```

The evidence write token pair is:

```text
local .env.local:              STUDIO_INTEGRATION_TOKEN
Cloudflare Pages Production:  STUDIO_INTEGRATION_TOKEN
```

After rotating a Pages secret, redeploy Production. Never paste a secret into a
`VITE_*` variable, command argument, log, issue, or committed file.

`GET /api/health` proves Pages can reach the runner but does not prove runner
token equality. Querying a nonexistent Studio UUID is a non-billing auth check:

```bash
curl -i \
  https://<pages-domain>/api/studio/runs/00000000-0000-4000-8000-000000000000
```

| Result | Meaning |
|---|---|
| `404 Studio job not found` | runner authentication and proxy routing work |
| `401 Unauthorized` | Pages and runner tokens differ |
| `502 Studio runner is unavailable` | runner or Tunnel is unreachable |
| `503 ... not configured` | a required Pages binding or secret is missing |
| Cloudflare Access `403` | Access rejected the Pages service token |

For evidence writes, a `401` during job completion means the two
`STUDIO_INTEGRATION_TOKEN` values differ; a `503` names the missing D1, R2, or
ElevenLabs binding.
