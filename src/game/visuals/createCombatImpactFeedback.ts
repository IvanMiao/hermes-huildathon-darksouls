import * as THREE from "three";
import type { Vec2 } from "../combat/BattleController";

export const BOSS_IMPACT_DURATION = 0.18;
export const PLAYER_IMPACT_DURATION = 0.28;
export const PERFECT_DODGE_DURATION = 0.36;

export interface CombatImpactFeedback {
  group: THREE.Group;
  bossImpact: THREE.Mesh;
  playerImpact: THREE.Mesh;
  perfectDodge: THREE.Mesh;
}

function createFlashMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createCombatImpactFeedback(ember: string, ivory: string): CombatImpactFeedback {
  const bossImpactMaterial = createFlashMaterial(ivory, 0.9);
  bossImpactMaterial.wireframe = true;
  const bossImpact = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.34, 1),
    bossImpactMaterial,
  );
  bossImpact.visible = false;

  const playerImpactMaterial = createFlashMaterial(ember, 0.92);
  playerImpactMaterial.wireframe = true;
  const playerImpact = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    playerImpactMaterial,
  );
  playerImpact.visible = false;

  const perfectDodge = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.46, 64),
    createFlashMaterial(ivory, 0.88),
  );
  perfectDodge.rotation.x = -Math.PI / 2;
  perfectDodge.visible = false;

  const group = new THREE.Group();
  group.add(bossImpact, playerImpact, perfectDodge);
  return { group, bossImpact, playerImpact, perfectDodge };
}

export function placeBossImpact(feedback: CombatImpactFeedback, position: Vec2): void {
  feedback.bossImpact.position.set(position.x, 1.15, position.z);
  feedback.bossImpact.rotation.set(0, 0, 0);
}

export function placePlayerImpact(feedback: CombatImpactFeedback, position: Vec2): void {
  feedback.playerImpact.position.set(position.x, 0.78, position.z);
  feedback.playerImpact.rotation.set(0, 0, 0);
}

export function placePerfectDodge(feedback: CombatImpactFeedback, position: Vec2): void {
  feedback.perfectDodge.position.set(position.x, 0.12, position.z);
}

function setFlashState(mesh: THREE.Mesh, remaining: number, duration: number, growth: number): void {
  mesh.visible = remaining > 0;
  if (!mesh.visible) return;

  const progress = 1 - remaining / duration;
  mesh.scale.setScalar(0.65 + progress * growth);
  mesh.rotation.y = progress * Math.PI * 0.7;
  if (mesh.material instanceof THREE.MeshBasicMaterial) {
    mesh.material.opacity = Math.sin(progress * Math.PI) * 0.94;
  }
}

export function updateCombatImpactFeedback(
  feedback: CombatImpactFeedback,
  timers: { bossHit: number; playerHit: number; perfectDodge: number },
): void {
  setFlashState(feedback.bossImpact, timers.bossHit, BOSS_IMPACT_DURATION, 2.15);
  setFlashState(feedback.playerImpact, timers.playerHit, PLAYER_IMPACT_DURATION, 2.4);

  feedback.perfectDodge.visible = timers.perfectDodge > 0;
  if (feedback.perfectDodge.visible) {
    const progress = 1 - timers.perfectDodge / PERFECT_DODGE_DURATION;
    feedback.perfectDodge.scale.setScalar(0.7 + progress * 3.5);
    if (feedback.perfectDodge.material instanceof THREE.MeshBasicMaterial) {
      feedback.perfectDodge.material.opacity = Math.sin(progress * Math.PI) * 0.92;
    }
  }
}
