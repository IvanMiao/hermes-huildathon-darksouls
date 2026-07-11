# Soulloom Implementation Plan

## Priority model

Order work by the shortest path to a reliable two-minute demo:

1. A complete playable boss fight is the irreducible product output.
2. Deterministic QA must exist before agents can safely generate specs.
3. The agent workflow should produce and repair artifacts, not edit runtime code.
4. Observability and sponsor integrations come after the local loop is reliable.
5. Visual polish is concentrated on phase two, hit feedback, and readable telegraphs.

## P0 — Runtime and contract foundation (completed)

**Files:** `src/boss-spec/*`, `src/game/createBattleScene.ts`, project config

**Goal:** A real Three.js canvas boots from a strict, normalized `BossSpec`; malformed specs cannot enter the runtime.

**Verify:**

```bash
npm audit
npm test
npm run typecheck
npm run build
```

Exit gate: default spec renders in a browser with no console errors.

## P1 — Playable combat vertical slice (implemented; manual play gate pending)

**Files:** `src/game/createBattleScene.ts`, `src/game/combat/*`, combat unit tests

**Goal:** One complete 60–75 second encounter: movement, auto-facing strike, dodge/i-frames, health, sweep/charge/nova telegraphs, phase transition, death, victory, and restart.

Implementation order:

1. Player movement, attack cooldown, damage and restart.
2. Boss health and deterministic state machine.
3. Sweep with visible telegraph and punish window.
4. Charge and nova using the same attack contract.
5. Phase-two transition that triggers exactly once before further damage resolves.
6. Victory/death flow and fixed opening sequence.

**Verify:** pure state-machine tests plus ten manual start-to-finish runs.

Exit gate: the default Boss can be defeated and the player can die/restart without reloading the page.

## P2 — Deterministic release gate (implemented)

**Files:** `src/debugBridge.ts`, `src/simulation/*`, `tests/e2e/*`, Playwright config

**Goal:** QA can deterministically inspect and trigger intro, each telegraph, phase two, death and victory without playing a full run.

Tasks:

1. Development-only `window.__SOULLOOM__` bridge.
2. Seeded attack selection and headless combat simulation.
3. Checks for legal spec, reachable phase two, defeatable boss, death/restart and reachable voice trigger.
4. Playwright page-load, keyboard-input, console-error and screenshot tests.

**Verify:** one command runs schema, simulation and browser smoke gates.

Exit gate: a failing combat parameter blocks release and identifies an owning artifact/role.

Implemented with a recipe-driven fixed-step simulator, explicit artifact/owner failure
reports, a development-only `window.__SOULLOOM__` QA bridge, and Playwright
keyboard/state/console/screenshot coverage. Run the full gate with
`npm run verify`.

## P3 — Local autonomous studio loop (implemented)

**Files:** `runner/`, artifact schemas, run fixtures

**Goal:** Hermes Manager coordinates Creative and Encounter work in parallel, merges a draft, sends it through QA, and reroutes only failed ownership areas.

Tasks:

1. Versioned `ProductionBrief`, `ThemeSpec`, `EncounterSpec` and `QAReport` schemas.
2. Run directory with append-only events and artifact versions.
3. Manager routing: Creative + Encounter → merge → QA → targeted retry → regression.
4. Hard timeout and explicit cached/default fallback labels.

**Verify:** two inputs produce different artifacts or routing; one recorded real failure is repaired and passes regression.

Exit gate: no agent edits Three.js runtime files, and an unpassed run cannot publish.

Implemented with a provider-neutral `HermesStudioManager`, deterministic local
Creative/Encounter adapters, versioned JSON Schema contracts, append-only JSONL
events, immutable artifact versions, an 8-second specialist timeout, visibly
labelled cached/default fallbacks, and a single targeted repair pass followed by
regression QA. The fixtures now publish `GameRecipeV0`: one passes directly and
one invalid Procession omits its required charge chain, is rejected, and repairs
only Encounter before regression. Use `npm run studio:fixtures`
to materialize complete auditable runs under `.soulloom/runs/`.

## P4 — Minimal Studio and Control Room UI (implemented)

**Files:** `src/studio/*`, `src/control-room/*`

**Goal:** The main path stays simple while proof data remains auditable.

Tasks:

1. Create page with one source input (pasted text or tweet image) and `MAKE IT PLAYABLE`.
2. Live artifact timeline with short summaries.
3. First-class `RELEASE BLOCKED` and before/after repair diff states.
4. Control Room with run graph, artifacts, QA, latency, cost and fallback status.
5. `/games/:runId` route that only opens published runs.

**Verify:** a fixture run can replay pass, block and repair states without fake model calls.

Exit gate: a viewer can explain who produced what, why release was blocked, and what changed.

Implemented as route-split deterministic fixture views at `/studio` and
`/control-room/:runId`. The Control Room replays the current P3
`EncounterSpec` → `DraftGameRecipe` → QA workflow, including the rejected
Procession without an adjacent charge chain and the Encounter-only repair.
`/games/:runId` requires both published status and a `release_published` event.
P3 does not yet emit model cost, so the UI displays `Not reported by P3`
instead of inventing proof data.

## P5 — Event-bound ElevenLabs voice

**Goal:** Generate one approved original Boss voice line, cache it, preload it, and play it exactly once on `phase_two_enter`; cached fallback is visibly labelled.

**Verify:** ten phase transitions produce ten single voice triggers; missing audio never blocks gameplay.

## P6 — Convex evidence layer and Cloudflare delivery

**Goal:** Mirror runs/events/artifacts/QA to Convex; deploy the static shell/runtime to Cloudflare Pages; expose only the local runner API through a protected Tunnel.

Order:

1. Deploy static hello-world shell early.
2. Add Convex run/event subscriptions and artifact storage.
3. Add idempotent start endpoint, CORS allowlist and concurrency limit.
4. Freeze DNS/Tunnel topology before final polish.

**Verify:** three published historical games remain playable while the local runner is offline.

## P7 — Demo polish and freeze

Only after P1–P6 gates pass:

1. Phase-two freeze frame, light shift, halo and nova.
2. 60–80 ms hit stop, boss flash and restrained camera shake.
3. Dodge trail and perfect-dodge feedback.
4. Cached house music and audio ducking.
5. Record fallback video and rehearse the two-minute path.

Do not add mobile controls, arbitrary code generation, generated sprite sheets, dynamic music in the critical path, inventory, progression, multiple bosses or a fourth attack.

## Time-box checkpoints

- 00:45 — P0 complete.
- 02:45 — P1 complete and playable end to end.
- 04:00 — P2 release gate complete.
- 05:15 — P3 local agency loop complete.
- 06:00 — P4/P5 demo path complete.
- 06:45 — P6 public delivery complete.
- 07:00 onward — feature freeze; bugs, repeated runs, recording and rehearsal only.
