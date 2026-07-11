import "./style.css";
import { DEFAULT_BOSS_SPEC } from "./boss-spec/defaultBossSpec";
import { normalizeBossSpec } from "./boss-spec/normalize";
import { createBattleScene } from "./game/createBattleScene";

const spec = normalizeBossSpec(DEFAULT_BOSS_SPEC);
const gameContainer = document.querySelector<HTMLElement>("#game");

// Future audio must be unlocked from an explicit user gesture before gameplay:
// resume AudioContext there, then preload voice assets. This smoke slice stays silent.
if (!gameContainer) {
  throw new Error("Missing #game scene container");
}

createBattleScene(spec, gameContainer);
