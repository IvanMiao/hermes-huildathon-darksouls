import type { AttackType, BossSpec } from "../../boss-spec/types";

export interface Vec2 {
  x: number;
  z: number;
}

export interface CombatInput {
  movement: Vec2;
  attackPressed: boolean;
  dodgePressed: boolean;
  restartPressed: boolean;
}

export type CombatOutcome = "fighting" | "victory" | "defeat";
export type AttackStage = "telegraph" | "active" | "recovery";

export interface BossAttackState {
  type: AttackType;
  stage: AttackStage;
  elapsed: number;
  duration: number;
  target: Vec2;
  hasHit: boolean;
}

export type CombatEvent =
  | { type: "player_strike"; connected: boolean }
  | { type: "player_dodge" }
  | { type: "player_hit"; damage: number }
  | { type: "boss_attack_started"; attack: AttackType }
  | { type: "phase_two" }
  | { type: "victory" }
  | { type: "defeat" }
  | { type: "restart" };

export interface CombatState {
  elapsed: number;
  outcome: CombatOutcome;
  phase: 1 | 2;
  phaseTransitionRemaining: number;
  player: {
    hp: number;
    maxHp: number;
    position: Vec2;
    attackCooldown: number;
    dodgeCooldown: number;
    dodgeRemaining: number;
    invulnerableRemaining: number;
    dodgeDirection: Vec2;
  };
  boss: {
    hp: number;
    maxHp: number;
    position: Vec2;
    attack: BossAttackState | null;
    nextAttackRemaining: number;
    attackIndex: number;
  };
}

const ARENA_RADIUS = 5.15;
const PLAYER_MAX_HP = 100;
const PLAYER_SPEED = 3.7;
const PLAYER_STRIKE_DAMAGE = 58;
const PLAYER_STRIKE_RANGE = 1.58;
const PLAYER_STRIKE_COOLDOWN = 0.46;
export const DODGE_DURATION = 0.36;
const DODGE_INVULNERABILITY = 0.29;
const DODGE_COOLDOWN = 0.7;
const DODGE_SPEED = 9.2;
const CHARGE_SPEED = 9.6;

const NO_INPUT: CombatInput = {
  movement: { x: 0, z: 0 },
  attackPressed: false,
  dodgePressed: false,
  restartPressed: false,
};

function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.z);
}

function normalize(vector: Vec2, fallback: Vec2 = { x: 0, z: 1 }): Vec2 {
  const magnitude = length(vector);
  if (magnitude < 0.0001) {
    return { ...fallback };
  }

  return { x: vector.x / magnitude, z: vector.z / magnitude };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clampToArena(position: Vec2): void {
  const radius = length(position);
  if (radius <= ARENA_RADIUS) {
    return;
  }

  position.x = (position.x / radius) * ARENA_RADIUS;
  position.z = (position.z / radius) * ARENA_RADIUS;
}

function countdown(value: number, delta: number): number {
  return Math.max(0, value - delta);
}

function createInitialState(spec: BossSpec): CombatState {
  return {
    elapsed: 0,
    outcome: "fighting",
    phase: 1,
    phaseTransitionRemaining: 0,
    player: {
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      position: { x: 0, z: 2.8 },
      attackCooldown: 0,
      dodgeCooldown: 0,
      dodgeRemaining: 0,
      invulnerableRemaining: 0,
      dodgeDirection: { x: 0, z: -1 },
    },
    boss: {
      hp: spec.boss.maxHp,
      maxHp: spec.boss.maxHp,
      position: { x: 0, z: -1.55 },
      attack: null,
      nextAttackRemaining: 1.8,
      attackIndex: 0,
    },
  };
}

export class BattleController {
  state: CombatState;

  constructor(private readonly spec: BossSpec) {
    this.state = createInitialState(spec);
  }

  reset(): CombatEvent[] {
    this.state = createInitialState(this.spec);
    return [{ type: "restart" }];
  }

  update(delta: number, input: CombatInput = NO_INPUT): CombatEvent[] {
    if (this.state.outcome !== "fighting") {
      return input.restartPressed ? this.reset() : [];
    }

    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    const events: CombatEvent[] = [];
    this.state.elapsed += safeDelta;
    this.updateTimers(safeDelta);

    if (this.state.phaseTransitionRemaining > 0) {
      this.state.phaseTransitionRemaining = countdown(
        this.state.phaseTransitionRemaining,
        safeDelta,
      );
      return events;
    }

    this.updatePlayer(safeDelta, input, events);
    if (this.state.outcome === "fighting") {
      this.updateBoss(safeDelta, events);
    }

    return events;
  }

  private updateTimers(delta: number): void {
    const player = this.state.player;
    player.attackCooldown = countdown(player.attackCooldown, delta);
    player.dodgeCooldown = countdown(player.dodgeCooldown, delta);
    player.dodgeRemaining = countdown(player.dodgeRemaining, delta);
    player.invulnerableRemaining = countdown(player.invulnerableRemaining, delta);
  }

  private updatePlayer(
    delta: number,
    input: CombatInput,
    events: CombatEvent[],
  ): void {
    const player = this.state.player;
    const movement = normalize(input.movement, { x: 0, z: 0 });

    if (input.dodgePressed && player.dodgeCooldown === 0) {
      const awayFromBoss = normalize({
        x: player.position.x - this.state.boss.position.x,
        z: player.position.z - this.state.boss.position.z,
      });
      player.dodgeDirection = length(input.movement) > 0 ? movement : awayFromBoss;
      player.dodgeRemaining = DODGE_DURATION;
      player.invulnerableRemaining = DODGE_INVULNERABILITY;
      player.dodgeCooldown = DODGE_COOLDOWN;
      events.push({ type: "player_dodge" });
    }

    const velocity = player.dodgeRemaining > 0
      ? {
          x: player.dodgeDirection.x * DODGE_SPEED,
          z: player.dodgeDirection.z * DODGE_SPEED,
        }
      : { x: movement.x * PLAYER_SPEED, z: movement.z * PLAYER_SPEED };

    player.position.x += velocity.x * delta;
    player.position.z += velocity.z * delta;
    clampToArena(player.position);

    if (!input.attackPressed || player.attackCooldown > 0 || player.dodgeRemaining > 0) {
      return;
    }

    player.attackCooldown = PLAYER_STRIKE_COOLDOWN;
    const connected = distance(player.position, this.state.boss.position) <= PLAYER_STRIKE_RANGE;
    events.push({ type: "player_strike", connected });

    if (!connected) {
      return;
    }

    const previousHp = this.state.boss.hp;
    this.state.boss.hp = Math.max(0, previousHp - PLAYER_STRIKE_DAMAGE);
    const phaseThreshold = this.state.boss.maxHp * this.spec.boss.phaseTwoAt;

    if (this.state.boss.hp === 0) {
      this.state.outcome = "victory";
      this.state.boss.attack = null;
      events.push({ type: "victory" });
      return;
    }

    if (this.state.phase === 1 && previousHp > phaseThreshold && this.state.boss.hp <= phaseThreshold) {
      this.state.phase = 2;
      this.state.phaseTransitionRemaining = 1.15;
      this.state.boss.attack = null;
      this.state.boss.nextAttackRemaining = 0.75;
      events.push({ type: "phase_two" });
    }
  }

  private updateBoss(delta: number, events: CombatEvent[]): void {
    const boss = this.state.boss;

    if (!boss.attack) {
      boss.nextAttackRemaining = countdown(boss.nextAttackRemaining, delta);
      if (boss.nextAttackRemaining === 0) {
        this.startBossAttack(events);
      }
      return;
    }

    const attack = boss.attack;
    attack.elapsed += delta;

    if (attack.stage === "telegraph" && attack.elapsed >= attack.duration) {
      attack.stage = "active";
      attack.elapsed = 0;
      attack.duration = attack.type === "charge" ? 0.58 : 0.24;
    }

    if (attack.stage === "active") {
      this.updateActiveAttack(attack, delta, events);
      if (attack.elapsed >= attack.duration) {
        attack.stage = "recovery";
        attack.elapsed = 0;
        attack.duration = this.state.phase === 2 ? 0.48 : 0.72;
      }
      return;
    }

    if (attack.stage === "recovery" && attack.elapsed >= attack.duration) {
      boss.attack = null;
      boss.nextAttackRemaining = this.state.phase === 2 ? 0.58 : 0.92;
    }
  }

  private startBossAttack(events: CombatEvent[]): void {
    const boss = this.state.boss;
    const attackSpec = this.spec.attacks[boss.attackIndex % this.spec.attacks.length];
    if (!attackSpec) {
      return;
    }

    const phaseSpeed = this.state.phase === 2 ? this.spec.boss.phase2Multiplier : 1;
    boss.attackIndex += 1;
    boss.attack = {
      type: attackSpec.type,
      stage: "telegraph",
      elapsed: 0,
      duration: attackSpec.telegraphMs / 1_000 / phaseSpeed,
      target: { ...this.state.player.position },
      hasHit: false,
    };
    events.push({ type: "boss_attack_started", attack: attackSpec.type });
  }

  private updateActiveAttack(
    attack: BossAttackState,
    delta: number,
    events: CombatEvent[],
  ): void {
    if (attack.type === "charge") {
      const direction = normalize({
        x: attack.target.x - this.state.boss.position.x,
        z: attack.target.z - this.state.boss.position.z,
      });
      this.state.boss.position.x += direction.x * CHARGE_SPEED * delta;
      this.state.boss.position.z += direction.z * CHARGE_SPEED * delta;
      clampToArena(this.state.boss.position);
    }

    if (attack.hasHit || !this.attackTouchesPlayer(attack)) {
      return;
    }

    attack.hasHit = true;
    if (this.state.player.invulnerableRemaining > 0) {
      return;
    }

    const attackSpec = this.spec.attacks.find(({ type }) => type === attack.type);
    if (!attackSpec) {
      return;
    }

    const phaseDamage = this.state.phase === 2 ? this.spec.boss.phase2Multiplier : 1;
    const damage = Math.round(attackSpec.damage * phaseDamage);
    this.state.player.hp = Math.max(0, this.state.player.hp - damage);
    events.push({ type: "player_hit", damage });

    if (this.state.player.hp === 0) {
      this.state.outcome = "defeat";
      events.push({ type: "defeat" });
    }
  }

  private attackTouchesPlayer(attack: BossAttackState): boolean {
    const range = attack.type === "sweep" ? 2.45 : attack.type === "nova" ? 3.65 : 0.72;
    return distance(this.state.player.position, this.state.boss.position) <= range;
  }
}
