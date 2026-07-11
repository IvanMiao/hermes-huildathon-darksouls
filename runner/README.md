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
with a verified Duel, Procession, or Revelation package. The default local
adapters are deterministic fixtures for offline development.
A live Hermes adapter should implement `StudioAdapters` and preserve the same
timeout, fallback, artifact, QA, and publication boundaries.
