# Soulloom

Soulloom is a constrained tweet-to-boss-fight runtime. The current vertical
slice combines a strict `BossSpec` contract with a playable Three.js encounter
and a deterministic combat state machine.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Move with WASD or the arrow keys, roll with
Space, and strike with J. Defeat FABLE or press R/Enter after an outcome to
restart the encounter.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The production output is written to `dist/`.

## Implemented scope

- Vite + strict TypeScript + Three.js browser foundation, with no React.
- Responsive WebGL output matched to the container and capped at 2× device DPR.
- Crisp DOM-based interface text layered over the 3D arena.
- A complete combat loop driven by `DEFAULT_BOSS_SPEC`: movement, auto-facing
  strike, dodge/i-frames, sweep/charge/nova, phase two, death, victory, restart.
- A deterministic combat controller kept separate from the Three.js scene.
- A dark mythic arena, readable telegraphs, player health and a bottom Boss bar.
- Detailed procedural knight and Boss models with complete weapons, articulated
  strike/roll/attack poses, floating scripture, candles, architecture and a
  deterministic cracked-stone `CanvasTexture`.
- A strict Ajv JSON Schema for the canonical `BossSpec` runtime contract.
- Deterministic input validation followed by balance normalization and a second
  canonical-schema validation pass.
- Tests for the contract, legal attack set, clamping, palette, phase threshold,
  movement boundary, strike range, dodge invulnerability and restart flow.

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

## Not implemented yet

The agent pipeline, backend/server code, Convex, Cloudflare, ElevenLabs,
generated assets, audio, and secrets/credentials are not implemented yet.
