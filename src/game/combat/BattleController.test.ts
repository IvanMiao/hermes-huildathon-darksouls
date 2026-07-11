import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_RECIPE } from "../../game-recipe/defaultGameRecipe";
import type { GameRecipeV0 } from "../../game-recipe/types";
import {
  BattleController,
  doesNovaHit,
  PROCESSION_MINIMUM_RADIUS,
  type CombatInput,
} from "./BattleController";

const idleInput: CombatInput = {
  movement: { x: 0, z: 0 },
  attackPressed: false,
  dodgePressed: false,
  restartPressed: false,
};

function advance(controller: BattleController, seconds: number, input = idleInput): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.016) {
    controller.update(0.016, input);
  }
}

function createProcessionRecipe(): GameRecipeV0 {
  return {
    ...structuredClone(DEFAULT_GAME_RECIPE),
    runId: "test-procession",
    archetype: "procession",
    arena: { rule: "closing_ring", theme: "ruined-cathedral" },
    combat: {
      phaseOneOrder: ["sweep", "charge", "nova"],
      phaseTwoOrder: ["charge", "charge", "sweep", "nova"],
      phaseTwoRule: "charge_chain",
    },
  };
}

function createRevelationRecipe(): GameRecipeV0 {
  return {
    ...structuredClone(DEFAULT_GAME_RECIPE),
    runId: "test-revelation",
    archetype: "revelation",
    arena: { rule: "inner_sanctuary", theme: "void-sanctum" },
    combat: {
      phaseOneOrder: ["sweep", "charge", "nova"],
      phaseTwoOrder: ["nova", "sweep", "charge"],
      phaseTwoRule: "outer_safe_nova",
    },
  };
}

function collectAttackOrder(
  recipe: GameRecipeV0,
  count: number,
  phase: 1 | 2 = 1,
): string[] {
  const controller = new BattleController(recipe);
  controller.state.player.hp = 1_000_000;
  controller.state.phase = phase;
  controller.state.phaseTransitionRemaining = 0;
  controller.state.boss.nextAttackRemaining = 0;
  const attacks: string[] = [];

  for (let elapsed = 0; elapsed < 45 && attacks.length < count; elapsed += 0.016) {
    const events = controller.update(0.016, idleInput);
    for (const event of events) {
      if (event.type === "boss_attack_started") {
        attacks.push(event.attack);
      }
    }
  }

  return attacks;
}

describe("BattleController", () => {
  it("moves the player but keeps them inside the arena", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);

    advance(controller, 5, { ...idleInput, movement: { x: 1, z: 1 } });

    expect(Math.hypot(controller.state.player.position.x, controller.state.player.position.z))
      .toBeCloseTo(5.15, 2);
  });

  it("only damages the boss when a strike is in range", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);

    const missed = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(missed).toContainEqual({ type: "player_strike", connected: false });
    expect(controller.state.boss.hp).toBe(DEFAULT_GAME_RECIPE.boss.boss.maxHp);

    controller.state.player.position = { x: 0, z: -0.3 };
    advance(controller, 0.5);
    const hit = controller.update(0.016, { ...idleInput, attackPressed: true });

    expect(hit).toContainEqual({ type: "player_strike", connected: true });
    expect(controller.state.boss.hp).toBeLessThan(DEFAULT_GAME_RECIPE.boss.boss.maxHp);
  });

  it("enters phase two exactly once when health crosses the threshold", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);
    controller.state.player.position = { x: 0, z: -0.3 };
    controller.state.boss.hp = DEFAULT_GAME_RECIPE.boss.boss.maxHp / 2 + 1;

    const transition = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(transition.filter(({ type }) => type === "phase_two")).toHaveLength(1);
    expect(controller.state.phase).toBe(2);

    advance(controller, 1.7);
    const laterHit = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(laterHit.some(({ type }) => type === "phase_two")).toBe(false);
  });

  it("grants invulnerability during a dodge", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);

    controller.update(0.016, { ...idleInput, dodgePressed: true });

    expect(controller.state.player.invulnerableRemaining).toBeGreaterThan(0);
    expect(controller.state.player.dodgeRemaining).toBeGreaterThan(0);
  });

  it("limits the sweep to its telegraphed forward arc", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);
    controller.state.boss.position = { x: 0, z: 0 };
    controller.state.player.position = { x: 2, z: 0 };
    controller.state.boss.attack = {
      type: "sweep",
      stage: "active",
      elapsed: 0,
      duration: 0.24,
      target: { x: 0, z: 2 },
      hasHit: false,
    };

    const outsideArc = controller.update(0.016, idleInput);
    expect(outsideArc.some(({ type }) => type === "player_hit")).toBe(false);

    controller.state.player.position = { x: 0, z: 2 };
    const insideArc = controller.update(0.016, idleInput);
    expect(insideArc.some(({ type }) => type === "player_hit")).toBe(true);
  });

  it("emits perfect dodge feedback once when an attack crosses invulnerability", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);
    controller.state.boss.position = { x: 0, z: 0 };
    controller.state.player.position = { x: 0, z: 2 };
    controller.state.player.invulnerableRemaining = 0.2;
    controller.state.boss.attack = {
      type: "sweep",
      stage: "active",
      elapsed: 0,
      duration: 0.24,
      target: { x: 0, z: 2 },
      hasHit: false,
    };

    const firstFrame = controller.update(0.016, idleInput);
    const laterFrame = controller.update(0.016, idleInput);

    expect(firstFrame).toContainEqual({ type: "perfect_dodge", attack: "sweep" });
    expect(firstFrame.some(({ type }) => type === "player_hit")).toBe(false);
    expect(laterFrame.some(({ type }) => type === "perfect_dodge")).toBe(false);
  });

  it("can restart after victory", () => {
    const controller = new BattleController(DEFAULT_GAME_RECIPE);
    controller.state.player.position = { x: 0, z: -0.3 };
    controller.state.boss.hp = 1;

    controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(controller.state.outcome).toBe("victory");

    const restart = controller.update(0.016, { ...idleInput, restartPressed: true });
    expect(restart).toEqual([{ type: "restart" }]);
    expect(controller.state.outcome).toBe("fighting");
    expect(controller.state.boss.hp).toBe(DEFAULT_GAME_RECIPE.boss.boss.maxHp);
  });

  it("follows the recipe attack order deterministically", () => {
    const firstRun = collectAttackOrder(DEFAULT_GAME_RECIPE, 8);
    const replay = collectAttackOrder(DEFAULT_GAME_RECIPE, 8);

    expect(firstRun.slice(0, 3)).toEqual(["sweep", "charge", "nova"]);
    expect(firstRun).toHaveLength(8);
    expect(replay).toEqual(firstRun);
  });

  it("shrinks Procession after phase two and executes a charge chain", () => {
    const recipe = createProcessionRecipe();
    const controller = new BattleController(recipe);
    controller.state.phase = 2;
    controller.state.phaseTransitionRemaining = 0;
    controller.state.player.hp = 1_000_000;
    const radii: number[] = [];

    for (let elapsed = 0; elapsed < 24; elapsed += 0.5) {
      advance(controller, 0.5);
      radii.push(controller.state.arena.radius);
    }

    expect(radii.every((radius, index) => index === 0 || radius <= (radii[index - 1] ?? radius)))
      .toBe(true);
    expect(controller.state.arena.radius).toBeCloseTo(PROCESSION_MINIMUM_RADIUS, 2);
    expect(collectAttackOrder(recipe, 4, 2)).toEqual([
      "charge",
      "charge",
      "sweep",
      "nova",
    ]);
  });

  it("reverses Revelation nova safety from inner sanctuary to outer ring", () => {
    const recipe = createRevelationRecipe();

    expect(doesNovaHit(recipe, 1, 1.5)).toBe(false);
    expect(doesNovaHit(recipe, 1, 3.2)).toBe(true);
    expect(doesNovaHit(recipe, 2, 1.5)).toBe(true);
    expect(doesNovaHit(recipe, 2, 4.4)).toBe(false);
  });
});
