import * as THREE from "three";
import type { BossSpec } from "../../boss-spec/types";
import type { ArenaModel } from "./createArenaModel";
import type { GeneratedArenaVisual } from "./resolveBattleVisualProfile";

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

function createBeacon(color: string, garden: boolean): THREE.Group {
  const beacon = new THREE.Group();
  const base = new THREE.Mesh(
    garden
      ? new THREE.CylinderGeometry(0.18, 0.28, 0.32, 5)
      : new THREE.CylinderGeometry(0.2, 0.32, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: garden ? "#171a14" : "#182333", roughness: 0.72 }),
  );
  base.position.y = garden ? 0.16 : 0.08;
  const crystal = new THREE.Mesh(
    garden
      ? new THREE.ConeGeometry(0.11, 0.7, 5)
      : new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.4,
      roughness: 0.18,
    }),
  );
  crystal.position.y = garden ? 0.66 : 0.34;
  const light = new THREE.PointLight(color, 3.5, 3.2, 2);
  light.position.y = 0.55;
  beacon.add(base, crystal, light);
  return beacon;
}

export function createGeneratedArenaModel(
  spec: BossSpec,
  visual: GeneratedArenaVisual,
): ArenaModel {
  const garden = visual === "obsidian_garden";
  const group = new THREE.Group();
  const candleFlames = new THREE.Group();
  const accent = garden ? "#a8e063" : "#64d9ff";
  const secondary = garden ? "#e1b866" : "#9c7cff";

  const foundation = new THREE.Mesh(
    new THREE.CylinderGeometry(6.18, 6.5, 0.42, garden ? 10 : 12),
    new THREE.MeshStandardMaterial({
      color: garden ? "#0d120f" : "#101827",
      metalness: garden ? 0.34 : 0.72,
      roughness: garden ? 0.78 : 0.32,
    }),
  );
  foundation.position.y = -0.22;
  foundation.receiveShadow = true;
  group.add(foundation);

  const slabMaterial = new THREE.MeshStandardMaterial({
    color: garden ? "#202b22" : "#26364d",
    emissive: garden ? "#172318" : "#172a40",
    emissiveIntensity: 0.22,
    metalness: garden ? 0.18 : 0.64,
    roughness: garden ? 0.86 : 0.38,
  });
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 1.48), slabMaterial);
    const radius = 2.1 + (index % 3) * 1.38;
    slab.position.set(Math.cos(angle) * radius, 0.01 + (index % 2) * 0.035, Math.sin(angle) * radius);
    slab.rotation.set(0, -angle + (garden ? 0.16 : -0.1), (index % 2 ? 1 : -1) * 0.018);
    slab.receiveShadow = true;
    group.add(slab);
  }

  for (const radius of [1.55, 3.15, 5.45]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.035, radius + 0.035, 96),
      new THREE.MeshBasicMaterial({
        color: radius === 3.15 ? accent : secondary,
        transparent: true,
        opacity: radius === 3.15 ? 0.38 : 0.16,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.095;
    group.add(ring);
  }

  const skyline = new THREE.Group();
  for (let index = 0; index < 9; index += 1) {
    const angle = Math.PI + (index / 8) * Math.PI;
    const monument = new THREE.Mesh(
      garden
        ? new THREE.ConeGeometry(0.42 + (index % 2) * 0.14, 3.4 + (index % 3), 5)
        : new THREE.BoxGeometry(0.5, 3.6 + (index % 3) * 0.85, 0.5),
      new THREE.MeshStandardMaterial({
        color: garden ? "#121a15" : "#172338",
        emissive: index % 2 ? accent : secondary,
        emissiveIntensity: 0.12,
        metalness: garden ? 0.1 : 0.62,
        roughness: 0.56,
      }),
    );
    monument.position.set(
      Math.cos(angle) * 7.1,
      1.8 + (index % 3) * 0.42,
      Math.sin(angle) * 7.1,
    );
    monument.rotation.set(garden ? 0.08 : 0.2, -angle, (index - 4) * 0.025);
    monument.castShadow = true;
    skyline.add(monument);
  }
  group.add(skyline);

  const astrolabe = new THREE.Group();
  astrolabe.position.set(0, 3.1, -6.25);
  for (let index = 0; index < 3; index += 1) {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(1.15 + index * 0.46, 0.035 + index * 0.008, 8, 72),
      new THREE.MeshBasicMaterial({ color: index === 1 ? accent : secondary, transparent: true, opacity: 0.52 }),
    );
    orbit.rotation.set(index * 0.58, index * 0.4, index * 0.31);
    astrolabe.add(orbit);
  }
  const core = new THREE.Mesh(
    garden ? new THREE.DodecahedronGeometry(0.42, 0) : new THREE.IcosahedronGeometry(0.38, 1),
    new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.1 }),
  );
  astrolabe.add(core);
  group.add(astrolabe);

  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
    const beacon = createBeacon(index % 2 ? accent : secondary, garden);
    beacon.position.set(Math.cos(angle) * 5.35, 0.02, Math.sin(angle) * 5.35);
    candleFlames.add(beacon);
  }
  group.add(candleFlames);

  const random = seededRandom(garden ? 0x5f3759df : 0xa57a1e11);
  const positions = new Float32Array(360 * 3);
  for (let index = 0; index < 360; index += 1) {
    const radius = 2 + random() * 9;
    const angle = random() * Math.PI * 2;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0.3 + random() * 7;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const emberField = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: spec.boss.palette[2] || accent,
      size: garden ? 0.05 : 0.035,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  group.add(emberField);

  return { group, emberField, candleFlames };
}
