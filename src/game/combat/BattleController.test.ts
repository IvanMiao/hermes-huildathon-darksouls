import { describe, expect, it } from "vitest";
import { DEFAULT_BOSS_SPEC } from "../../boss-spec/defaultBossSpec";
import { BattleController, type CombatInput } from "./BattleController";

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

function collectAttackOrder(seed: number, count: number): string[] {
  const controller = new BattleController(DEFAULT_BOSS_SPEC, { seed });
  controller.state.player.hp = 1_000_000;
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
    const controller = new BattleController(DEFAULT_BOSS_SPEC);

    advance(controller, 5, { ...idleInput, movement: { x: 1, z: 1 } });

    expect(Math.hypot(controller.state.player.position.x, controller.state.player.position.z))
      .toBeCloseTo(5.15, 2);
  });

  it("only damages the boss when a strike is in range", () => {
    const controller = new BattleController(DEFAULT_BOSS_SPEC);

    const missed = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(missed).toContainEqual({ type: "player_strike", connected: false });
    expect(controller.state.boss.hp).toBe(DEFAULT_BOSS_SPEC.boss.maxHp);

    controller.state.player.position = { x: 0, z: -0.3 };
    advance(controller, 0.5);
    const hit = controller.update(0.016, { ...idleInput, attackPressed: true });

    expect(hit).toContainEqual({ type: "player_strike", connected: true });
    expect(controller.state.boss.hp).toBeLessThan(DEFAULT_BOSS_SPEC.boss.maxHp);
  });

  it("enters phase two exactly once when health crosses the threshold", () => {
    const controller = new BattleController(DEFAULT_BOSS_SPEC);
    controller.state.player.position = { x: 0, z: -0.3 };
    controller.state.boss.hp = DEFAULT_BOSS_SPEC.boss.maxHp / 2 + 1;

    const transition = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(transition.filter(({ type }) => type === "phase_two")).toHaveLength(1);
    expect(controller.state.phase).toBe(2);

    advance(controller, 1.7);
    const laterHit = controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(laterHit.some(({ type }) => type === "phase_two")).toBe(false);
  });

  it("grants invulnerability during a dodge", () => {
    const controller = new BattleController(DEFAULT_BOSS_SPEC);

    controller.update(0.016, { ...idleInput, dodgePressed: true });

    expect(controller.state.player.invulnerableRemaining).toBeGreaterThan(0);
    expect(controller.state.player.dodgeRemaining).toBeGreaterThan(0);
  });

  it("can restart after victory", () => {
    const controller = new BattleController(DEFAULT_BOSS_SPEC);
    controller.state.player.position = { x: 0, z: -0.3 };
    controller.state.boss.hp = 1;

    controller.update(0.016, { ...idleInput, attackPressed: true });
    expect(controller.state.outcome).toBe("victory");

    const restart = controller.update(0.016, { ...idleInput, restartPressed: true });
    expect(restart).toEqual([{ type: "restart" }]);
    expect(controller.state.outcome).toBe("fighting");
    expect(controller.state.boss.hp).toBe(DEFAULT_BOSS_SPEC.boss.maxHp);
  });

  it("keeps the teaching cycle fixed and replays later attacks from a seed", () => {
    const firstRun = collectAttackOrder(867_5309, 8);
    const replay = collectAttackOrder(867_5309, 8);

    expect(firstRun.slice(0, 3)).toEqual(["sweep", "charge", "nova"]);
    expect(firstRun).toHaveLength(8);
    expect(replay).toEqual(firstRun);
  });
});
