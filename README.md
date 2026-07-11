# Tweetborne

Tweetborne is a constrained tweet-to-boss-fight runtime. This foundation slice
proves the browser stack and freezes the `BossSpec` contract before combat or
agent orchestration is added.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The page boots a real Phaser canvas using
the canonical `I SMELL FEAR` spec and displays the arena, player marker, FABLE,
the title, and the future keyboard controls.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The production output is written to `dist/`.

## Implemented scope

- Vite + strict TypeScript + Phaser 3 browser foundation, with no React.
- A responsive, non-combat boot scene driven by `DEFAULT_BOSS_SPEC`.
- A strict Ajv JSON Schema for the canonical `BossSpec` runtime contract.
- Deterministic input validation followed by balance normalization and a second
  canonical-schema validation pass.
- Tests for the default contract, legal attack set, clamping, palette, and phase
  threshold rules.

The runtime accepts exactly one each of `sweep`, `charge`, and `nova`. Malformed
objects, extra properties, illegal or duplicate attacks, invalid colors, and a
`phaseTwoAt` outside `0.25–0.75` are rejected. Only these balance fields clamp:

| Field | Safe range |
| --- | ---: |
| `boss.maxHp` | `300–2000` |
| `boss.phase2Multiplier` | `1–2` |
| `attacks[].telegraphMs` | `600–2000` |
| `attacks[].damage` | `1–50` |

Audio is intentionally absent. A code comment records the required future
user-gesture/`AudioContext.resume()` boundary so browser autoplay policy is not
forgotten when voice support is implemented.

## Not implemented in this step

Combat, the agent pipeline, backend/server code, Convex, Cloudflare,
ElevenLabs, generated assets, and secrets/credentials are all out of scope.
