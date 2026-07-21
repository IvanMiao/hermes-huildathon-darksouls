# Local studio runner

`HermesStudioManager` owns one constrained workflow:

```text
ProductionBrief
  ├─ Creative Director → ThemeSpec
  └─ Encounter Designer → EncounterSpec
          ↓
     DraftGameRecipeV0 → Release QA
          ├─ PASS → release.json
          └─ FAIL → failed owner only → regression QA
```

The specialists receive data and return JSON. They have no filesystem handle and
cannot edit `src/game/` or any other runtime file. `RunStore` is the only writer;
it writes inside one run directory:

```text
.soulloom/runs/<runId>/
  events.jsonl
  artifacts/<kind>/v1.json
  artifacts/<kind>/v2.json
  release.json                # only after a passing QAReport
```

`events.jsonl` is append-only. Artifact files use exclusive creation and are
never overwritten. `ProductionBrief`, `ThemeSpec`, `EncounterSpec`, and `QAReport`
all carry `schemaVersion: "1.0"` and are validated by the JSON Schemas exported
from `schemas.ts` before persistence.

The published artifact is a `GameRecipeV0`, which wraps the narrative `BossSpec`
with a verified Duel, Procession, or Revelation package.

`npm run studio -- "tweet text"` now starts two schema-constrained Hermes
one-shot specialists in parallel under `HermesStudioManager`. QA routes a
second one-shot call only to the failed owner. Hermes receives only the complete
brief and artifact schema, runs with the restricted `file` toolset, and is told
not to call tools or modify files. Invalid output, process failure, or timeout
remains visibly labelled as a fallback in the artifact source and CLI summary.

Hermes v0.18.2 changed `delegate_task` to return background handles immediately.
It cannot consolidate child artifacts before a scripted `hermes -z` process
exits, so the live adapter intentionally uses direct parallel specialist calls.

Hermes must already be installed and configured (`hermes setup --portal` or an
equivalent provider setup). Live mode is fail-closed and requires an explicit
provider and model:

```bash
SOULLOOM_HERMES_TIMEOUT_MS=30000 npm run studio -- "I smell fear."
SOULLOOM_HERMES_PROVIDER=openai-api SOULLOOM_HERMES_MODEL=gpt-5.6-terra npm run studio -- "I smell fear."
```

Every specialist runs inside Bubblewrap with the user's home directory hidden.
Only the read-only Hermes installation, Python runtime, and Hermes credential
file are mounted back into the sandbox. The child receives an empty temporary
working directory and cleared environment, while Hermes `--safe-mode` disables
user rules, plugins, MCP servers, and memory. Its explicit `hermes-webhook`
toolset contains no file, terminal, code-execution, or delegation tools. This
Linux sandbox requires `/usr/bin/bwrap`; use `SOULLOOM_HERMES_SANDBOX_BIN` only
when Bubblewrap is installed at another path.

For deterministic offline development, use:

```bash
npm run studio:local -- "I smell fear."
npm run studio:fixtures
```

The browser Studio uses the same live path through an asynchronous local HTTP
runner. Start it beside Vite:

```bash
npm run studio:server
npm run dev
```

Vite proxies Studio requests to `127.0.0.1:8787` and, when configured, evidence
reads to the Pages deployment. `POST /api/studio/runs` requires an
`Idempotency-Key`, returns a job immediately, and accepts one production at a
time. The browser enters the returned Control Room immediately and subscribes
to the protected same-origin event stream, with bounded polling as a
rolling-deployment fallback. Each durable event and artifact is included while
production is running. After deterministic QA, the Pages evidence API creates
per-run ElevenLabs voice and boss music, stores them in R2, and mirrors the full
release evidence to D1 before the job becomes complete. `GET /api/health` remains available
for Tunnel health checks. Text input is live; tweet-image OCR is still a
labelled fixture path.

Set `SOULLOOM_RUNNER_API_TOKEN` in `.env.local` for every Tunnel deployment.
The Cloudflare Pages Function sends that token server-to-server; it is never a
`VITE_*` variable. For a deterministic local API, run:

```bash
npm run studio:server:local
```
