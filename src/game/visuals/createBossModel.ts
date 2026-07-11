import * as THREE from "three";
import type { BossSpec } from "../../boss-spec/types";

export interface BossModel {
  group: THREE.Group;
  rig: THREE.Group;
  bodyMaterial: THREE.MeshStandardMaterial;
  weaponPivot: THREE.Group;
  halo: THREE.Group;
  scriptureShards: THREE.Group;
}

function createRitualStaff(ember: string, ivory: string): THREE.Group {
  const staff = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: "#3b292a",
    emissive: ember,
    emissiveIntensity: 0.12,
    metalness: 0.82,
    roughness: 0.28,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 2.45, 8), metal);
  pole.position.y = 0.7;
  pole.castShadow = true;
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 8, 48), metal);
  head.position.y = 1.88;
  const innerEye = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({
      color: ivory,
      emissive: ivory,
      emissiveIntensity: 0.55,
      roughness: 0.18,
    }),
  );
  innerEye.position.y = 1.88;
  for (let index = 0; index < 6; index += 1) {
    const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.42, 4), metal);
    const angle = (index / 6) * Math.PI * 2;
    thorn.position.set(Math.sin(angle) * 0.34, 1.88 + Math.cos(angle) * 0.34, 0);
    thorn.rotation.z = -angle;
    staff.add(thorn);
  }
  staff.add(pole, head, innerEye);
  return staff;
}

export function createBossModel(spec: BossSpec): BossModel {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const [shadow, ember, ivory] = spec.boss.palette;

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: shadow,
    emissive: ember,
    emissiveIntensity: 0.14,
    metalness: 0.5,
    roughness: 0.36,
  });
  const robeMaterial = new THREE.MeshStandardMaterial({
    color: "#24151a",
    emissive: ember,
    emissiveIntensity: 0.05,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });

  const outerRobe = new THREE.Mesh(new THREE.ConeGeometry(1.02, 2.95, 7), robeMaterial);
  outerRobe.position.y = 1.47;
  outerRobe.rotation.y = Math.PI / 7;
  outerRobe.castShadow = true;
  rig.add(outerRobe);

  const innerRobe = new THREE.Mesh(new THREE.ConeGeometry(0.74, 2.58, 6), bodyMaterial);
  innerRobe.position.set(0, 1.55, 0.18);
  innerRobe.rotation.y = -Math.PI / 6;
  rig.add(innerRobe);

  for (let index = -2; index <= 2; index += 1) {
    const stole = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 1.82, 0.05),
      new THREE.MeshStandardMaterial({
        color: index === 0 ? "#5c2d23" : "#342024",
        emissive: ember,
        emissiveIntensity: index === 0 ? 0.12 : 0.04,
        roughness: 0.8,
      }),
    );
    stole.position.set(index * 0.19, 1.52 - Math.abs(index) * 0.05, 0.72 - Math.abs(index) * 0.08);
    stole.rotation.z = index * 0.025;
    rig.add(stole);
  }

  const shoulders = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.78, 0),
    new THREE.MeshStandardMaterial({ color: "#2d2027", metalness: 0.72, roughness: 0.24 }),
  );
  shoulders.position.y = 2.12;
  shoulders.scale.set(1.55, 0.42, 0.7);
  shoulders.castShadow = true;
  rig.add(shoulders);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.09, 8, 32),
    new THREE.MeshStandardMaterial({ color: "#4a2b27", metalness: 0.65, roughness: 0.3 }),
  );
  collar.position.y = 2.18;
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.68;
  rig.add(collar);

  const mask = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 0),
    new THREE.MeshStandardMaterial({
      color: ivory,
      emissive: ivory,
      emissiveIntensity: 0.2,
      metalness: 0.18,
      roughness: 0.28,
    }),
  );
  mask.position.set(0, 2.58, 0.08);
  mask.scale.set(0.72, 1.2, 0.42);
  rig.add(mask);

  const eyeSlit = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.045, 0.035),
    new THREE.MeshBasicMaterial({ color: ember }),
  );
  eyeSlit.position.set(0, 2.58, 0.29);
  rig.add(eyeSlit);

  const halo = new THREE.Group();
  halo.position.y = 2.52;
  const haloMaterial = new THREE.MeshBasicMaterial({ color: ember });
  const outerHalo = new THREE.Mesh(new THREE.TorusGeometry(1.14, 0.035, 10, 96), haloMaterial);
  outerHalo.rotation.x = Math.PI / 2.12;
  const innerHalo = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.02, 8, 64), haloMaterial);
  innerHalo.rotation.set(Math.PI / 2.55, 0.18, 0);
  halo.add(outerHalo, innerHalo);
  rig.add(halo);

  const crown = new THREE.Group();
  for (let index = -3; index <= 3; index += 1) {
    const thorn = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.58 + (3 - Math.abs(index)) * 0.07, 4),
      haloMaterial,
    );
    thorn.position.set(index * 0.17, 3.08 - Math.abs(index) * 0.04, 0);
    thorn.rotation.z = -index * 0.07;
    crown.add(thorn);
  }
  rig.add(crown);

  const scriptureShards = new THREE.Group();
  const parchment = new THREE.MeshStandardMaterial({
    color: "#a48162",
    emissive: ember,
    emissiveIntensity: 0.08,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  for (let index = 0; index < 7; index += 1) {
    const shard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22 + (index % 2) * 0.09, 0.52),
      parchment,
    );
    const angle = (index / 7) * Math.PI * 2;
    shard.position.set(Math.cos(angle) * 1.28, 1.75 + (index % 3) * 0.28, Math.sin(angle) * 0.62);
    shard.rotation.set(index * 0.3, -angle, index * 0.21);
    scriptureShards.add(shard);
  }
  rig.add(scriptureShards);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0.92, 1.72, 0.08);
  weaponPivot.rotation.z = -0.42;
  weaponPivot.add(createRitualStaff(ember, ivory));
  rig.add(weaponPivot);

  const glow = new THREE.PointLight(ember, 25, 8, 2);
  glow.position.set(0, 2.35, 0.9);
  rig.add(glow);

  return { group, rig, bodyMaterial, weaponPivot, halo, scriptureShards };
}
