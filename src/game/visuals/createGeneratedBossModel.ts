import * as THREE from "three";
import type { BossSpec } from "../../boss-spec/types";
import type { BossModel } from "./createBossModel";
import type { GeneratedBossVisual } from "./resolveBattleVisualProfile";

function createLance(material: THREE.Material, glow: THREE.Material): THREE.Group {
  const lance = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 2.6, 7), material);
  shaft.position.y = 0.72;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 5), glow);
  head.position.y = 2.02;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 30), glow);
  ring.position.y = 1.55;
  lance.add(shaft, head, ring);
  return lance;
}

export function createGeneratedBossModel(
  spec: BossSpec,
  visual: GeneratedBossVisual,
): BossModel {
  const seraph = visual === "iron_seraph";
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const [, recipeAccent, recipeLight] = spec.boss.palette;
  const accent = seraph ? recipeAccent : "#9b78ff";
  const light = seraph ? recipeLight : "#7de8ff";

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: seraph ? "#353a42" : "#151b2b",
    emissive: accent,
    emissiveIntensity: 0.14,
    metalness: seraph ? 0.88 : 0.62,
    roughness: seraph ? 0.24 : 0.36,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: seraph ? "#161a20" : "#0d1020",
    emissive: accent,
    emissiveIntensity: 0.06,
    metalness: 0.82,
    roughness: 0.32,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: light,
    emissive: accent,
    emissiveIntensity: 1.1,
    metalness: 0.32,
    roughness: 0.16,
  });

  if (seraph) {
    const torso = new THREE.Mesh(new THREE.OctahedronGeometry(0.88, 0), bodyMaterial);
    torso.position.y = 1.72;
    torso.scale.set(1.4, 1.05, 0.72);
    torso.castShadow = true;
    rig.add(torso);

    const waist = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.75, 6), darkMetal);
    waist.position.y = 0.82;
    waist.rotation.y = Math.PI / 6;
    waist.castShadow = true;
    rig.add(waist);

    for (const side of [-1, 1]) {
      for (let index = 0; index < 2; index += 1) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.2 - index * 0.35, 4), bodyMaterial);
        wing.position.set(side * (1.05 + index * 0.35), 1.85 - index * 0.18, -0.18);
        wing.rotation.set(Math.PI / 2, 0, side * (0.72 + index * 0.3));
        wing.castShadow = true;
        rig.add(wing);
      }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 1.35, 7), darkMetal);
      arm.position.set(side * 0.92, 1.32, 0.08);
      arm.rotation.z = side * 0.24;
      rig.add(arm);
    }

    const mask = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.92, 5), glowMaterial);
    mask.position.set(0, 2.6, 0.04);
    mask.rotation.x = Math.PI;
    mask.scale.z = 0.58;
    rig.add(mask);
    for (let index = -2; index <= 2; index += 1) {
      const crownBlade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.72, 4), glowMaterial);
      crownBlade.position.set(index * 0.2, 3.05 - Math.abs(index) * 0.08, 0);
      crownBlade.rotation.z = -index * 0.08;
      rig.add(crownBlade);
    }
  } else {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), bodyMaterial);
    core.position.y = 1.65;
    core.scale.set(1.35, 0.86, 1.1);
    core.castShadow = true;
    rig.add(core);

    const face = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 8, 36), glowMaterial);
    face.position.set(0, 1.68, 0.82);
    const eye = new THREE.Mesh(new THREE.OctahedronGeometry(0.19, 0), glowMaterial);
    eye.position.set(0, 1.68, 0.91);
    rig.add(face, eye);

    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 1.25, 6), darkMetal);
      upper.position.set(Math.cos(angle) * 0.85, 0.98, Math.sin(angle) * 0.72);
      upper.rotation.set(Math.sin(angle) * 0.58, 0, -Math.cos(angle) * 0.58);
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.72, 5), glowMaterial);
      claw.position.set(Math.cos(angle) * 1.22, 0.35, Math.sin(angle) * 1.05);
      claw.rotation.set(Math.sin(angle) * 0.42, 0, -Math.cos(angle) * 0.42);
      rig.add(upper, claw);
    }

    for (let index = 0; index < 3; index += 1) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.13, 1.05, 5), glowMaterial);
      spine.position.set((index - 1) * 0.42, 2.5 - Math.abs(index - 1) * 0.16, -0.22);
      spine.rotation.z = (index - 1) * -0.24;
      rig.add(spine);
    }
  }

  const halo = new THREE.Group();
  halo.position.y = seraph ? 2.35 : 1.66;
  const haloCount = seraph ? 2 : 3;
  for (let index = 0; index < haloCount; index += 1) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry((seraph ? 1.15 : 1.42) + index * 0.3, 0.035, 7, 64),
      new THREE.MeshBasicMaterial({ color: index % 2 ? light : accent }),
    );
    orbit.rotation.set(Math.PI / (2.1 + index * 0.35), index * 0.4, index * 0.3);
    halo.add(orbit);
  }
  rig.add(halo);

  const scriptureShards = new THREE.Group();
  const shardCount = seraph ? 6 : 8;
  for (let index = 0; index < shardCount; index += 1) {
    const shard = new THREE.Mesh(
      seraph ? new THREE.TetrahedronGeometry(0.22, 0) : new THREE.OctahedronGeometry(0.16, 0),
      index % 2 ? glowMaterial : darkMetal,
    );
    const angle = (index / shardCount) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 1.48, 1.5 + (index % 3) * 0.36, Math.sin(angle) * 0.78);
    shard.rotation.set(angle, -angle, index * 0.4);
    scriptureShards.add(shard);
  }
  rig.add(scriptureShards);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(seraph ? 1.02 : 1.24, seraph ? 1.68 : 1.2, 0.08);
  weaponPivot.rotation.z = -0.42;
  weaponPivot.add(createLance(darkMetal, glowMaterial));
  rig.add(weaponPivot);

  const glow = new THREE.PointLight(accent, seraph ? 22 : 30, 9, 2);
  glow.position.set(0, seraph ? 2.05 : 1.72, 0.8);
  rig.add(glow);

  return { group, rig, bodyMaterial, weaponPivot, halo, scriptureShards };
}
