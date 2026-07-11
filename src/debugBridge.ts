import type { AttackType, BossSpec } from "./boss-spec/types";
import type {
  BattleController,
  CombatEvent,
  CombatState,
} from "./game/combat/BattleController";

export const DEBUG_SCENARIOS = [
  "intro",
  "sweep",
  "charge",
  "nova",
  "phase_two",
  "defeat",
  "victory",
  "restart",
] as const;

export type DebugScenario = (typeof DEBUG_SCENARIOS)[number];

export interface DebugSnapshot {
  paused: boolean;
  introVisible: boolean;
  combat: CombatState;
}

export interface SoulloomDebugBridge {
  readonly version: 1;
  getSnapshot(): DebugSnapshot;
  trigger(scenario: DebugScenario): void;
  dismissIntro(): void;
  pause(): void;
  resume(): void;
  step(milliseconds: number): void;
}

interface DebugRuntimeAdapter {
  controller: BattleController;
  spec: BossSpec;
  dispatch(events: CombatEvent[]): void;
  getIntroVisible(): boolean;
  showIntro(): void;
  dismissIntro(): void;
  getPaused(): boolean;
  setPaused(paused: boolean): void;
  step(milliseconds: number): void;
  requestRender(): void;
}

declare global {
  interface Window {
    __SOULLOOM__?: SoulloomDebugBridge;
  }
}

function startAttack(adapter: DebugRuntimeAdapter, attackType: AttackType): void {
  const { state } = adapter.controller;
  const attackSpec = state.outcome === "fighting"
    ? adapter.spec.attacks.find(({ type }) => type === attackType)
    : undefined;

  if (!attackSpec) {
    adapter.dispatch(adapter.controller.reset());
    startAttack(adapter, attackType);
    return;
  }

  state.phaseTransitionRemaining = 0;
  state.boss.attack = {
    type: attackType,
    stage: "telegraph",
    elapsed: 0,
    duration: attackSpec.telegraphMs / 1_000,
    target: { ...state.player.position },
    hasHit: false,
  };
  adapter.dispatch([{ type: "boss_attack_started", attack: attackType }]);
}

function triggerPhaseTwo(adapter: DebugRuntimeAdapter): void {
  if (adapter.controller.state.outcome !== "fighting") {
    adapter.dispatch(adapter.controller.reset());
  }
  const { state } = adapter.controller;
  state.phase = 2;
  state.boss.hp = Math.min(
    state.boss.hp,
    state.boss.maxHp * adapter.spec.boss.phaseTwoAt,
  );
  state.boss.attack = null;
  state.boss.nextAttackRemaining = 0.75;
  state.phaseTransitionRemaining = 1.15;
  adapter.dispatch([{ type: "phase_two" }]);
}

function triggerOutcome(
  adapter: DebugRuntimeAdapter,
  outcome: "victory" | "defeat",
): void {
  const { state } = adapter.controller;
  state.outcome = outcome;
  state.boss.attack = null;
  if (outcome === "victory") {
    state.boss.hp = 0;
  } else {
    state.player.hp = 0;
  }
  adapter.dispatch([{ type: outcome }]);
}

/** Installs the development-only QA surface used by Playwright and local debugging. */
export function installDebugBridge(adapter: DebugRuntimeAdapter): () => void {
  const bridge: SoulloomDebugBridge = {
    version: 1,
    getSnapshot: () => ({
      paused: adapter.getPaused(),
      introVisible: adapter.getIntroVisible(),
      combat: structuredClone(adapter.controller.state),
    }),
    trigger: (scenario) => {
      if (scenario === "intro") {
        adapter.showIntro();
      } else if (scenario === "phase_two") {
        triggerPhaseTwo(adapter);
      } else if (scenario === "defeat" || scenario === "victory") {
        triggerOutcome(adapter, scenario);
      } else if (scenario === "restart") {
        adapter.dispatch(adapter.controller.reset());
      } else {
        startAttack(adapter, scenario);
      }
      adapter.requestRender();
    },
    dismissIntro: () => {
      adapter.dismissIntro();
      adapter.requestRender();
    },
    pause: () => {
      adapter.setPaused(true);
      adapter.requestRender();
    },
    resume: () => {
      adapter.setPaused(false);
      adapter.requestRender();
    },
    step: (milliseconds) => {
      adapter.step(milliseconds);
      adapter.requestRender();
    },
  };

  window.__SOULLOOM__ = bridge;
  window.dispatchEvent(new Event("soulloom-debug-ready"));

  return () => {
    if (window.__SOULLOOM__ === bridge) {
      delete window.__SOULLOOM__;
    }
  };
}
