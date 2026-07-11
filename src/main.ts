import "./style.css";
import { DEFAULT_BOSS_SPEC } from "./boss-spec/defaultBossSpec";
import { normalizeBossSpec } from "./boss-spec/normalize";
import { createGame } from "./game/createGame";

const spec = normalizeBossSpec(DEFAULT_BOSS_SPEC);

// Future audio must be unlocked from an explicit user gesture before gameplay:
// resume AudioContext there, then preload voice assets. This smoke slice stays silent.
createGame(spec);
