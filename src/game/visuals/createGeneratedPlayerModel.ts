import * as THREE from "three";
import type { PlayerModel } from "./createPlayerModel";
import type { GeneratedPlayerVisual } from "./resolveBattleVisualProfile";

function limb(radius: number, length: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius, length, 6), material);
  mesh.castShadow = true;
  return mesh;
}

function createPolearm(
  metal: THREE.Material,
  glow: THREE.Material,
  thorned: boolean,
): THREE.Group {
  const weapon = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.52, 7), metal);
  pole.position.y = 0.55;
  const blade = new THREE.Mesh(
    thorned
      ? new THREE.ConeGeometry(0.18, 0.72, 4)
      : new THREE.TorusGeometry(0.26, 0.055, 6, 28, Math.PI * 1.2),
    glow,
  );
  blade.position.y = 1.36;
  blade.rotation.set(thorned ? 0 : Math.PI / 2, 0, thorned ? 0 : -0.42);
  const counterweight = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), glow);
  counterweight.position.y = -0.25;
  weapon.add(pole, blade, counterweight);
  return weapon;
}

export function createGeneratedPlayerModel(visual: GeneratedPlayerVisual): PlayerModel {
  const thorned = visual === "thorn_wanderer";
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  const accent = thorned ? "#d8b35f" : "#62e4ff";
  const armorMaterial = new THREE.MeshStandardMaterial({
    color: thorned ? "#5d6648" : "#d5e9ef",
    emissive: accent,
    emissiveIntensity: thorned ? 0.12 : 0.22,
    metalness: thorned ? 0.42 : 0.86,
    roughness: thorned ? 0.58 : 0.2,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: thorned ? "#20251a" : "#182534",
    metalness: thorned ? 0.2 : 0.7,
    roughness: 0.54,
  });
  const glowMaterial = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.25,
    metalness: 0.5,
    roughness: 0.18,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: thorned ? "#343c28" : "#263b50",
    emissive: accent,
    emissiveIntensity: 0.06,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });

  const hips = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), darkMaterial);
  hips.position.y = 0.48;
  hips.scale.set(1.1, 0.65, 0.82);
  rig.add(hips);

  for (const side of [-1, 1]) {
    const leg = limb(0.09, 0.5, darkMaterial);
    leg.position.set(side * 0.13, 0.27, 0);
    leg.rotation.z = side * 0.06;
    const boot = new THREE.Mesh(
      thorned ? new THREE.ConeGeometry(0.12, 0.28, 5) : new THREE.BoxGeometry(0.16, 0.12, 0.32),
      darkMaterial,
    );
    boot.position.set(side * 0.14, 0.08, 0.07);
    boot.rotation.x = thorned ? Math.PI / 2 : 0;
    rig.add(leg, boot);
  }

  const torso = new THREE.Mesh(
    thorned ? new THREE.ConeGeometry(0.36, 0.72, 6) : new THREE.OctahedronGeometry(0.42, 0),
    armorMaterial,
  );
  torso.position.y = 0.82;
  torso.scale.set(1, thorned ? 1 : 0.86, 0.62);
  torso.castShadow = true;
  rig.add(torso);

  const chestLight = new THREE.Mesh(
    thorned ? new THREE.TetrahedronGeometry(0.12, 0) : new THREE.RingGeometry(0.1, 0.145, 24),
    glowMaterial,
  );
  chestLight.position.set(0, 0.86, 0.34);
  rig.add(chestLight);

  for (const side of [-1, 1]) {
    const arm = limb(0.065, 0.48, darkMaterial);
    arm.position.set(side * 0.36, 0.73, 0);
    arm.rotation.z = side * 0.14;
    const shoulder = new THREE.Mesh(
      thorned ? new THREE.ConeGeometry(0.16, 0.46, 5) : new THREE.TetrahedronGeometry(0.22, 0),
      armorMaterial,
    );
    shoulder.position.set(side * 0.38, 1.02, 0);
    shoulder.rotation.z = side * (thorned ? -0.78 : 0.22);
    shoulder.scale.set(1.1, 0.72, 0.78);
    rig.add(arm, shoulder);
  }

  const helm = new THREE.Mesh(
    thorned ? new THREE.ConeGeometry(0.24, 0.62, 6) : new THREE.IcosahedronGeometry(0.24, 0),
    armorMaterial,
  );
  helm.position.y = thorned ? 1.36 : 1.26;
  helm.scale.set(0.82, 1.12, 0.72);
  helm.castShadow = true;
  const face = new THREE.Mesh(
    thorned ? new THREE.BoxGeometry(0.24, 0.05, 0.04) : new THREE.CircleGeometry(0.11, 16),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  face.position.set(0, thorned ? 1.31 : 1.26, 0.21);
  rig.add(helm, face);

  const cloak = new THREE.Mesh(
    thorned ? new THREE.ConeGeometry(0.46, 1.18, 5, 1, true) : new THREE.PlaneGeometry(0.72, 1.22, 1, 3),
    cloth,
  );
  cloak.position.set(0, 0.68, -0.19);
  cloak.rotation.x = -0.11;
  cloak.scale.z = 0.72;
  cloak.castShadow = true;
  rig.add(cloak);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.42, 0.75, 0.03);
  weaponPivot.rotation.set(0.08, 0.12, -0.52);
  weaponPivot.add(createPolearm(darkMaterial, glowMaterial, thorned));
  rig.add(weaponPivot);

  const silhouetteLight = new THREE.PointLight(accent, 5.5, 3.4, 2);
  silhouetteLight.position.set(0, 1.05, 0.45);
  rig.add(silhouetteLight);

  const marker = new THREE.Mesh(
    thorned ? new THREE.RingGeometry(0.42, 0.5, 6) : new THREE.RingGeometry(0.4, 0.47, 32),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.38, side: THREE.DoubleSide }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.025;
  group.add(marker);

  const rollTrail = new THREE.Mesh(
    thorned ? new THREE.RingGeometry(0.2, 0.62, 6) : new THREE.PlaneGeometry(0.5, 1.9),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  rollTrail.rotation.x = -Math.PI / 2;
  rollTrail.position.set(0, 0.035, 0.76);
  rollTrail.visible = false;
  group.add(rollTrail);

  const pivotHeight = 0.72;
  const body = new THREE.Group();
  for (const child of [...rig.children]) {
    rig.remove(child);
    child.position.y -= pivotHeight;
    body.add(child);
  }
  rig.position.y = pivotHeight;
  rig.add(body);

  return { group, rig, armorMaterial, weaponPivot, cloak, rollTrail };
}
