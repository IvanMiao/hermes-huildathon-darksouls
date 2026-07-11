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
2. Submit a new text run from `/studio`; the button moves through queued and
   producing states without a cross-origin request.
3. A duplicate submission with the same idempotency key does not create a
   second Hermes run.
4. A second concurrent request receives `429` and `Retry-After: 5`.
5. The completed run reports `convexEvidence: "mirrored"` and zero undeclared
   fallbacks.
6. `/control-room/:runId` reads the live mirrored evidence.
7. `/games/:runId` loads the generated ElevenLabs voice from Convex storage.
8. Stop the local runner: historical game URLs must remain playable while new
   production requests fail clearly.
