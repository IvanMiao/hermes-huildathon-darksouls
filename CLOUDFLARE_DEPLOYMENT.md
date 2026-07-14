# Cloudflare Pages + Tunnel deployment

Soulloom keeps the static game durable while Hermes stays on the Studio laptop:

```text
Browser
  -> Cloudflare Pages /api/* Function
  -> Cloudflare Access service token
  -> Tunnel hostname
  -> 127.0.0.1:8787 runner
  -> Hermes -> Convex / ElevenLabs
```

The Pages Function is only a secret-holding reverse proxy. Hermes, filesystem
tools, QA, and generated artifacts never execute inside Cloudflare Workers.

## 1. Local runner

Copy `.env.example` to `.env.local` and configure the existing Convex values,
Hermes provider, and a new random runner token:

```text
SOULLOOM_RUNNER_API_TOKEN=<at-least-32-random-characters>
```

Start and verify the runner:

```bash
npm run studio:server
curl http://127.0.0.1:8787/api/health
```

The health endpoint must report `agentMode: "hermes"`. The startup warning about
an unset API token must not appear in production.

## 2. Managed Tunnel

Create a fixed public hostname such as `studio-api.example.com` and route it to
`http://127.0.0.1:8787`.

Protect that hostname with a Cloudflare Access self-hosted application and a
`Service Auth` policy. Create one service token for the Pages Function. Do not
make the Tunnel hostname publicly bypassable.

## 3. Pages variables and secrets

In the existing Pages project, configure Production variables/secrets:

| Name | Type | Value |
|---|---|---|
| `VITE_CONVEX_URL` | variable | production `https://*.convex.cloud` URL |
| `STUDIO_RUNNER_ORIGIN` | variable | `https://studio-api.example.com` |
| `STUDIO_RUNNER_API_TOKEN` | encrypted secret | same value as runner `.env.local` |
| `CF_ACCESS_CLIENT_ID` | encrypted secret | Access service token client ID |
| `CF_ACCESS_CLIENT_SECRET` | encrypted secret | Access service token secret |

`STUDIO_INTEGRATION_TOKEN` and `ELEVENLABS_API_KEY` do not belong in Pages.
They remain in the local runner/Convex production environments.

The Pages build remains:

```text
Build command: npm run build
Build output directory: dist
```

The committed `functions/api/[[path]].ts` proxy is deployed automatically by a
Git-integrated Pages build. `public/_routes.json` limits Function invocation to
`/api/*`. After adding or changing bindings, trigger a new Pages deployment.

## 4. Local end-to-end check

For the fast local path, run the deterministic API and Vite in two terminals:

```bash
npm run studio:server:local
npm run dev
```

Vite proxies `/api` to port 8787 and injects the server-side runner token from
`.env.local`. To test the actual Pages Function locally, copy
`.dev.vars.example` to `.dev.vars`, build, and use Wrangler:

```bash
npm run build
npx wrangler pages dev dist
```

## 5. Production acceptance gate

1. `GET https://<pages-domain>/api/health` reports `agentMode: "hermes"`.
2. Submit a new text run from `/studio`; it immediately opens the live Control
   Room, which moves through queued and producing states without a cross-origin
   request.
3. A duplicate submission with the same idempotency key does not create a
   second Hermes run.
4. A second concurrent request receives `429` and `Retry-After: 5`.
5. The completed run reports `convexEvidence: "mirrored"` and zero undeclared
   fallbacks.
6. `/control-room/:runId?job=1` shows events during production; completion stays
   in the Control Room and unlocks `OPEN BOSS FIGHT`.
7. `/games/:runId` loads the generated ElevenLabs voice from Convex storage.
8. Stop the local runner: historical game URLs must remain playable while new
   production requests fail clearly.

## 6. Runner token rotation and restart runbook

The runner and Pages Function must use the same secret under two different
names:

```text
local .env.local:                 SOULLOOM_RUNNER_API_TOKEN
Cloudflare Pages Production:     STUDIO_RUNNER_API_TOKEN
```

Treat `.env.local` as the source of truth. Restart the runner without inheriting
an older shell value:

```bash
env -u SOULLOOM_RUNNER_API_TOKEN npm run studio:server
```

Whenever the local token changes, or a restarted runner starts returning 401,
copy the current value to the Pages Production secret without printing it:

```bash
env -u SOULLOOM_RUNNER_API_TOKEN node --env-file=.env.local -e '
const token = process.env.SOULLOOM_RUNNER_API_TOKEN;
if (!token) throw new Error("SOULLOOM_RUNNER_API_TOKEN is missing");
process.stdout.write(token);
' | npx wrangler pages secret put STUDIO_RUNNER_API_TOKEN \
  --project-name soulloom-buildathon
```

Pages secret changes require a new Production deployment. Build only from the
intended, reviewed worktree, then deploy the current production branch:

```bash
git status --short
npm run build
npx wrangler pages deploy dist \
  --project-name soulloom-buildathon \
  --branch "$(git branch --show-current)" \
  --commit-hash "$(git rev-parse HEAD)"
```

Do not paste either token into `VITE_*`, command arguments, logs, issues, or
committed files. `wrangler pages secret list` confirms that the binding exists,
but Cloudflare intentionally cannot reveal its value.

## 7. Fast production diagnosis

`GET /api/health` is intentionally unauthenticated. A `200` health response
proves that Pages can reach the runner, but it does **not** prove that the two
runner tokens match.

Use a nonexistent UUID to test Pages-to-runner authentication without starting
or billing a Hermes production:

```bash
curl -i \
  https://soulloom-buildathon.pages.dev/api/studio/runs/00000000-0000-4000-8000-000000000000
```

Interpret the result before changing configuration:

| Result | Meaning | Next check |
|---|---|---|
| `404 Studio job not found` | Authentication and proxy routing are working | Test a real Studio submission |
| `401 Unauthorized` | Pages token and runner token differ | Repeat the token sync and Production deployment above |
| `502 Studio runner is unavailable` | Function cannot reach the configured origin | Check runner process, Tunnel process, and `STUDIO_RUNNER_ORIGIN` |
| `503 Studio runner proxy is not configured` | A required Pages binding is missing or invalid | Run `wrangler pages secret list` and inspect Production variables |
| Cloudflare Access `403` or HTML login response | Access policy rejected the Function | Check the Access service-token pair and policy |

After authentication returns the expected `404`, perform the smallest real
acceptance test: submit one Studio run, poll its `statusUrl`, and require
`state: completed`, `status: published`, `qaPassed: true`, and
`convexEvidence: mirrored`.
