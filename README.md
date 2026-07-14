# Soulloom

> **One internet moment in. One playable boss fight out.**
>
> **We do not generate arbitrary game code. We operate an autonomous game studio.**

Soulloom turns an internet moment into a tested, playable Boss encounter. A
Hermes Studio Manager coordinates creative, encounter, audio, and QA work; a
fixed Three.js runtime assembles their approved artifacts into the final game.

## Product model

```text
Internet moment
  → Studio Manager
  → Creative + Encounter + Audio artifacts
  → deterministic QA
  → targeted repair or release
  → playable URL
```

Three constraints make the system reliable:

- Agents produce versioned specs and assets, never arbitrary runtime code.
- QA owns the release gate; failed runs are repaired and tested again.
- Published games depend on the fixed runtime and durable artifacts, not a live
  generation session.

## Delivery

The target deployment keeps the public game stable while the autonomous studio
runs locally:

```text
Cloudflare Pages        Convex                 Local Studio Runner
/studio                 runs + events          Hermes Manager
/games/:runId    ↔      specs + QA      ↔      specialist tasks
fixed runtime           artifact storage       ElevenLabs + Playwright
                              ▲
                     protected Tunnel
```

The release path is intentionally short:

1. Build and publish the static Studio and game runtime to Cloudflare Pages.
2. Store run state, approved specs, QA evidence, and generated assets in Convex.
3. Expose only the local runner API through a protected Cloudflare Tunnel.
4. Publish `/games/:runId` only after deterministic QA passes.

## Build the current runtime

Requires Node.js 20 or newer.

```bash
npm install
npm run studio:server # terminal 1: real Hermes runner on :8787
npm run dev
```

Move with WASD or the arrow keys, roll with Space, and strike with J. Run the
complete deterministic release gate with:

```bash
npm run verify
```

That one command validates the schemas, runs the recipe-driven headless combat
simulation, type-checks and builds the runtime, then runs Playwright page-load,
keyboard, console-error, QA-state, and screenshot checks against local Chrome.
The deployable static output is written to `dist/`.

Run the local P3 studio loop with any source text:

```bash
npm run studio -- "I smell fear."
```

The Manager writes append-only events and immutable artifact versions under
`.soulloom/runs/<runId>/`. To materialize both the direct-pass fixture and the
recorded QA-blocked → Encounter repair → regression-pass fixture, run:

```bash
npm run studio:fixtures
```

The current repository implements the constrained `BossSpec`, playable Three.js
runtime, deterministic P2 release gate, the P3 local autonomous studio loop, and
the `GameRecipeV0` encounter grammar. The runtime supports three verified
packages: Duel, Procession (closing arena + charge chain), and Revelation
(phase-two nova safety inversion). Try them locally in the development
playground with:

```text
/playground?recipe=duel
/playground?recipe=procession
/playground?recipe=revelation
```

The development-only `window.__SOULLOOM__` bridge is removed from production
builds. The P3 orchestration core accepts specialist adapters; fixtures remain
offline and reproducible, while `npm run studio -- "tweet text"` and the browser
Studio invoke parallel schema-constrained Hermes Creative/Encounter specialists
through the same Manager-owned artifact boundary.
Live specialists run in a fail-closed Bubblewrap sandbox: the local home and
project are hidden, the working directory is ephemeral, inherited environment
variables are cleared, and Hermes file/terminal/code tools, plugins, MCP, rules,
and memory are disabled.
`npm run studio:local -- "tweet text"` retains the deterministic path, while
`npm run studio:server` exposes the live workflow through an authenticated,
asynchronous local API. Cloudflare Pages proxies `/api/*` to its protected
Tunnel without placing runner or Access tokens in the Vite bundle. A submitted
run enters the Control Room immediately; durable events and artifacts appear as
Hermes produces them. Passing QA unlocks `OPEN BOSS FIGHT` without automatically
opening the game. Deterministic fixtures remain available for offline replay.
See [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)
for the production configuration and acceptance gate.
