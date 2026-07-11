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
npm run dev
```

Move with WASD or the arrow keys, roll with Space, and strike with J. Run the
complete deterministic release gate with:

```bash
npm run verify
```

That one command validates the schema, runs the seeded headless combat
simulation, type-checks and builds the runtime, then runs Playwright page-load,
keyboard, console-error, QA-state, and screenshot checks against local Chrome.
The deployable static output is written to `dist/`.

The current repository implements the constrained `BossSpec` contract and the
playable Three.js combat runtime plus its deterministic P2 release gate. The
development-only `window.__SOULLOOM__` bridge can pause, step, inspect, and force
intro, all three telegraphs, phase two, defeat, victory, and restart; it is
removed from production builds. The autonomous studio, Convex evidence layer,
audio pipeline, and Cloudflare delivery are the next delivery stages.
