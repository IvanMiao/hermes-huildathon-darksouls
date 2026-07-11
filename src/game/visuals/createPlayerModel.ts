import * as THREE from "three";

export interface PlayerModel {
  group: THREE.Group;
  rig: THREE.Group;
  armorMaterial: THREE.MeshStandardMaterial;
  weaponPivot: THREE.Group;
  cloak: THREE.Mesh;
  rollTrail: THREE.Mesh;
}

function createSword(armorMaterial: THREE.Material): THREE.Group {
  const sword = new THREE.Group();
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.075, 0);
  bladeShape.lineTo(-0.095, 0.88);
  bladeShape.lineTo(0, 1.25);
  bladeShape.lineTo(0.095, 0.88);
  bladeShape.lineTo(0.075, 0);
  bladeShape.closePath();

  const blade = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 1,
    }),
    new THREE.MeshStandardMaterial({
      color: "#c8c4bb",
      emissive: "#e4ded0",
      emissiveIntensity: 0.045,
      metalness: 0.98,
      roughness: 0.14,
    }),
  );
  blade.position.y = 0.2;
  blade.castShadow = true;

  const fuller = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.76, 0.012),
    new THREE.MeshStandardMaterial({ color: "#4a4e50", metalness: 0.9, roughness: 0.25 }),
  );
  fuller.position.set(0, 0.7, 0.06);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.065, 0.09), armorMaterial);
  guard.position.y = 0.16;
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.05, 0.34, 8),
    new THREE.MeshStandardMaterial({ color: "#291d18", roughness: 0.9 }),
  );
  grip.position.y = -0.05;
  const pommel = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), armorMaterial);
  pommel.position.y = -0.24;

  sword.add(blade, fuller, guard, grip, pommel);
  return sword;
}

function createLimb(
  radius: number,
  length: number,
  material: THREE.Material,
): THREE.Mesh {
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.85, radius, length, 7), material);
  limb.castShadow = true;
  return limb;
}

export function createPlayerModel(): PlayerModel {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  const armorMaterial = new THREE.MeshStandardMaterial({
    color: "#687075",
    emissive: "#88aeb0",
    emissiveIntensity: 0.1,
    metalness: 0.88,
    roughness: 0.28,
  });
  const darkIron = new THREE.MeshStandardMaterial({
    color: "#272d30",
    metalness: 0.76,
    roughness: 0.38,
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: "#171a1d",
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const leather = new THREE.MeshStandardMaterial({ color: "#30231d", roughness: 0.92 });

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.22, 7), darkIron);
  hips.position.y = 0.48;
  rig.add(hips);

  for (const side of [-1, 1]) {
    const leg = createLimb(0.105, 0.44, darkIron);
    leg.position.set(side * 0.13, 0.25, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.29), darkIron);
    boot.position.set(side * 0.13, 0.07, 0.055);
    boot.castShadow = true;
    rig.add(leg, boot);
  }

  const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.34, 0.58, 7), armorMaterial);
  cuirass.position.y = 0.78;
  cuirass.scale.z = 0.7;
  cuirass.castShadow = true;
  rig.add(cuirass);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.035, 6, 20), leather);
  belt.position.y = 0.52;
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.7;
  rig.add(belt);

  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 6), armorMaterial);
    pauldron.position.set(side * 0.38, 0.98, 0);
    pauldron.scale.set(1.25, 0.55, 0.8);
    pauldron.castShadow = true;
    const arm = createLimb(0.075, 0.5, darkIron);
    arm.position.set(side * 0.4, 0.72, 0);
    arm.rotation.z = side * 0.12;
    rig.add(pauldron, arm);
  }

  const helm = new THREE.Mesh(new THREE.DodecahedronGeometry(0.23, 0), armorMaterial);
  helm.position.y = 1.24;
  helm.scale.set(0.9, 1.1, 0.85);
  helm.castShadow = true;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.085, 0.055), darkIron);
  visor.position.set(0, 1.25, 0.19);
  for (let index = -2; index <= 2; index += 1) {
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.055, 0.012),
      new THREE.MeshBasicMaterial({ color: "#07090a" }),
    );
    slit.position.set(index * 0.055, 1.25, 0.224);
    rig.add(slit);
  }
  rig.add(helm, visor);

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 7, 1, true), cloth);
  cloak.position.set(0, 0.64, -0.14);
  cloak.rotation.x = -0.11;
  cloak.scale.z = 0.7;
  cloak.castShadow = true;
  rig.add(cloak);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.4, 0.78, 0.04);
  weaponPivot.rotation.set(0.08, 0.12, -0.52);
  weaponPivot.add(createSword(armorMaterial));
  rig.add(weaponPivot);

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.43, 0.48, 48),
    new THREE.MeshBasicMaterial({
      color: "#90b8b9",
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.025;
  group.add(marker);

  const rollTrail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 1.65),
    new THREE.MeshBasicMaterial({
      color: "#86a9ac",
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  rollTrail.rotation.x = -Math.PI / 2;
  rollTrail.position.set(0, 0.035, 0.7);
  rollTrail.visible = false;
  group.add(rollTrail);

  // Recenter the animated rig around the torso so a forward roll does not send
  // the model below the floor plane.
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
