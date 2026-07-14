import * as THREE from "three";
import type { GameRecipeV0 } from "../../game-recipe/types";
import { SWEEP_ARC_RADIANS, type BossAttackState, type Vec2 } from "../combat/BattleController";

export type AttackFeedbackStage = "idle" | "warning" | "imminent" | "release" | "recovery";

interface TelegraphMaterialSet {
  fill: THREE.MeshBasicMaterial;
  edge: THREE.MeshBasicMaterial;
}

export interface AttackTelegraphVisuals {
  group: THREE.Group;
  sweep: THREE.Group;
  charge: THREE.Group;
  nova: THREE.Group;
  novaCore: THREE.Mesh;
  releaseWave: THREE.Mesh;
  sweepMaterials: TelegraphMaterialSet;
  chargeMaterials: TelegraphMaterialSet;
  novaMaterials: TelegraphMaterialSet;
}

const IMMINENT_THRESHOLD = 0.68;

function createMaterial(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function createSweepTelegraph(ember: string, ivory: string): {
  group: THREE.Group;
  materials: TelegraphMaterialSet;
} {
  const group = new THREE.Group();
  const fill = createMaterial(ember, 0.18);
  const edge = createMaterial(ivory, 0.34);
  const thetaStart = Math.PI / 2 - SWEEP_ARC_RADIANS / 2;
  const fillMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.46, 2.48, 72, 1, thetaStart, SWEEP_ARC_RADIANS),
    fill,
  );
  const edgeMesh = new THREE.Mesh(
    new THREE.RingGeometry(2.34, 2.5, 72, 1, thetaStart, SWEEP_ARC_RADIANS),
    edge,
  );
  group.add(fillMesh, edgeMesh);
  group.rotation.x = -Math.PI / 2;
  group.visible = false;
  return { group, materials: { fill, edge } };
}

function createChargeTelegraph(ember: string, ivory: string): {
  group: THREE.Group;
  materials: TelegraphMaterialSet;
} {
  const group = new THREE.Group();
  const fill = createMaterial(ember, 0.16);
  const edge = createMaterial(ivory, 0.42);
  const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 11), fill);
  const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 11), edge);
  const rightEdge = leftEdge.clone();
  leftEdge.position.x = -0.56;
  rightEdge.position.x = 0.56;
  group.add(fillMesh, leftEdge, rightEdge);
  group.rotation.x = -Math.PI / 2;
  group.visible = false;
  return { group, materials: { fill, edge } };
}

function createNovaTelegraph(recipe: GameRecipeV0, ember: string, ivory: string): {
  group: THREE.Group;
  core: THREE.Mesh;
  materials: TelegraphMaterialSet;
} {
  const group = new THREE.Group();
  const fill = createMaterial(ember, 0.16);
  const edge = createMaterial(ivory, 0.38);
  const geometry = recipe.archetype === "revelation"
    ? new THREE.RingGeometry(2.55, 4.65, 96)
    : new THREE.RingGeometry(3.25, 3.68, 96);
  const edgeGeometry = recipe.archetype === "revelation"
    ? new THREE.RingGeometry(4.55, 4.68, 96)
    : new THREE.RingGeometry(3.57, 3.72, 96);
  group.add(new THREE.Mesh(geometry, fill), new THREE.Mesh(edgeGeometry, edge));
  group.rotation.x = -Math.PI / 2;
  group.visible = false;

  const core = new THREE.Mesh(new THREE.CircleGeometry(3.65, 96), fill.clone());
  core.rotation.x = -Math.PI / 2;
  core.visible = false;
  return { group, core, materials: { fill, edge } };
}

export function createAttackTelegraphs(recipe: GameRecipeV0): AttackTelegraphVisuals {
  const ember = recipe.boss.boss.palette[1];
  const ivory = recipe.boss.boss.palette[2];
  const sweep = createSweepTelegraph(ember, ivory);
  const charge = createChargeTelegraph(ember, ivory);
  const nova = createNovaTelegraph(recipe, ember, ivory);
  const releaseWave = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.88, 72),
    createMaterial(ivory, 0.8),
  );
  releaseWave.rotation.x = -Math.PI / 2;
  releaseWave.visible = false;

  const group = new THREE.Group();
  group.add(sweep.group, charge.group, nova.group, nova.core, releaseWave);
  return {
    group,
    sweep: sweep.group,
    charge: charge.group,
    nova: nova.group,
    novaCore: nova.core,
    releaseWave,
    sweepMaterials: sweep.materials,
    chargeMaterials: charge.materials,
    novaMaterials: nova.materials,
  };
}

function setMaterialStage(
  materials: TelegraphMaterialSet,
  stage: AttackFeedbackStage,
  progress: number,
  ember: THREE.Color,
  ivory: THREE.Color,
): void {
  const imminentProgress = Math.max(0, (progress - IMMINENT_THRESHOLD) / (1 - IMMINENT_THRESHOLD));
  const pulse = 0.5 + Math.sin(progress * Math.PI * 12) * 0.5;
  materials.fill.color.copy(ember).lerp(ivory, imminentProgress * 0.72);
  materials.edge.color.copy(ivory);

  if (stage === "release") {
    materials.fill.opacity = 0.78 - progress * 0.28;
    materials.edge.opacity = 0.98 - progress * 0.42;
    return;
  }
  if (stage === "imminent") {
    materials.fill.opacity = 0.3 + imminentProgress * 0.18 + pulse * 0.08;
    materials.edge.opacity = 0.58 + imminentProgress * 0.34;
    return;
  }
  materials.fill.opacity = 0.12 + progress * 0.18;
  materials.edge.opacity = 0.24 + progress * 0.24;
}

function orientTowardTarget(group: THREE.Group, boss: Vec2, target: Vec2): void {
  const dx = target.x - boss.x;
  const dz = target.z - boss.z;
  group.rotation.z = Math.atan2(-dx, -dz);
}

function resolveFeedbackStage(attack: BossAttackState | null): AttackFeedbackStage {
  if (!attack) return "idle";
  if (attack.stage === "active") return "release";
  if (attack.stage === "recovery") return "recovery";
  return attack.elapsed / Math.max(attack.duration, 0.001) >= IMMINENT_THRESHOLD
    ? "imminent"
    : "warning";
}

export function updateAttackTelegraphs(
  visuals: AttackTelegraphVisuals,
  attack: BossAttackState | null,
  bossPosition: Vec2,
  phase: 1 | 2,
  recipe: GameRecipeV0,
): AttackFeedbackStage {
  const stage = resolveFeedbackStage(attack);
  visuals.sweep.visible = attack?.type === "sweep" && stage !== "recovery";
  visuals.charge.visible = attack?.type === "charge" && stage !== "recovery";
  const novaVisible = attack?.type === "nova" && stage !== "recovery";
  const revelationCore = recipe.archetype === "revelation" && phase === 2;
  visuals.nova.visible = Boolean(novaVisible && !revelationCore);
  visuals.novaCore.visible = Boolean(novaVisible && revelationCore);
  visuals.releaseWave.visible = Boolean(attack && stage === "release");

  if (!attack || stage === "recovery") {
    return stage;
  }

  const progress = Math.min(1, attack.elapsed / Math.max(attack.duration, 0.001));
  const ember = new THREE.Color(recipe.boss.boss.palette[1]);
  const ivory = new THREE.Color(recipe.boss.boss.palette[2]);
  const positionY = stage === "release" ? 0.075 : 0.055;

  if (attack.type === "sweep") {
    visuals.sweep.position.set(bossPosition.x, positionY, bossPosition.z);
    orientTowardTarget(visuals.sweep, bossPosition, attack.target);
    visuals.sweep.scale.setScalar(stage === "release" ? 1 + progress * 0.1 : 0.97 + progress * 0.03);
    setMaterialStage(visuals.sweepMaterials, stage, progress, ember, ivory);
  } else if (attack.type === "charge") {
    const dx = attack.target.x - bossPosition.x;
    const dz = attack.target.z - bossPosition.z;
    const distance = Math.max(0.1, Math.hypot(dx, dz));
    visuals.charge.position.set(bossPosition.x + dx / 2, positionY, bossPosition.z + dz / 2);
    orientTowardTarget(visuals.charge, bossPosition, attack.target);
    visuals.charge.scale.set(stage === "release" ? 1.08 : 1, Math.min(1, distance / 5.5), 1);
    setMaterialStage(visuals.chargeMaterials, stage, progress, ember, ivory);
  } else {
    const novaVisual = revelationCore ? visuals.novaCore : visuals.nova;
    novaVisual.position.set(bossPosition.x, positionY, bossPosition.z);
    novaVisual.scale.setScalar(stage === "release" ? 1 + progress * 0.13 : 0.25 + progress * 0.75);
    setMaterialStage(visuals.novaMaterials, stage, progress, ember, ivory);
    if (revelationCore && visuals.novaCore.material instanceof THREE.MeshBasicMaterial) {
      visuals.novaCore.material.color.copy(visuals.novaMaterials.fill.color);
      visuals.novaCore.material.opacity = visuals.novaMaterials.fill.opacity;
    }
  }

  if (visuals.releaseWave.visible) {
    visuals.releaseWave.position.set(bossPosition.x, 0.09, bossPosition.z);
    visuals.releaseWave.scale.setScalar(0.45 + progress * 2.2);
    if (visuals.releaseWave.material instanceof THREE.MeshBasicMaterial) {
      visuals.releaseWave.material.opacity = Math.max(0, 0.82 * (1 - progress));
    }
  }
  return stage;
}
