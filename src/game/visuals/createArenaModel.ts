import * as THREE from "three";
import type { BossSpec } from "../../boss-spec/types";

export interface ArenaModel {
  group: THREE.Group;
  emberField: THREE.Points;
  candleFlames: THREE.Group;
}

function createSeededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1_664_525 + 1_013_904_223) >>> 0;
    return value / 4_294_967_296;
  };
}

function createStoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D context is required for the stone texture");
  }

  const random = createSeededRandom(0x7f4a7c15);
  context.fillStyle = "#21191b";
  context.fillRect(0, 0, size, size);

  for (let index = 0; index < 3_200; index += 1) {
    const shade = 18 + Math.floor(random() * 30);
    context.fillStyle = `rgba(${shade + 10}, ${shade}, ${shade}, ${0.04 + random() * 0.1})`;
    const grain = 1 + random() * 3;
    context.fillRect(random() * size, random() * size, grain, grain);
  }

  context.strokeStyle = "rgba(112, 79, 65, 0.14)";
  context.lineWidth = 2;
  const tile = 64;
  for (let y = 0; y <= size; y += tile) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
  }
  for (let row = 0; row < size / tile; row += 1) {
    const offset = row % 2 === 0 ? 0 : tile / 2;
    for (let x = offset; x <= size; x += tile) {
      context.beginPath();
      context.moveTo(x, row * tile);
      context.lineTo(x, (row + 1) * tile);
      context.stroke();
    }
  }

  for (let crackIndex = 0; crackIndex < 28; crackIndex += 1) {
    let x = random() * size;
    let y = random() * size;
    context.beginPath();
    context.moveTo(x, y);
    for (let segment = 0; segment < 4 + random() * 5; segment += 1) {
      x += (random() - 0.5) * 32;
      y += 8 + random() * 22;
      context.lineTo(x, y);
    }
    context.strokeStyle = `rgba(4, 3, 4, ${0.16 + random() * 0.22})`;
    context.lineWidth = 0.7 + random() * 1.3;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  return texture;
}

function createPillar(stone: THREE.Material, trim: THREE.Material): THREE.Group {
  const pillar = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 0.32, 8), trim);
  base.position.y = 0.16;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.56, 0.34, 8), stone);
  foot.position.y = 0.48;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.43, 4.9, 10), stone);
  shaft.position.y = 3.08;
  shaft.castShadow = true;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.35, 0.28, 8), trim);
  collar.position.y = 5.58;
  const capital = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.92), trim);
  capital.position.y = 5.82;
  capital.rotation.y = Math.PI / 4;
  pillar.add(base, foot, shaft, collar, capital);
  return pillar;
}

function createCandle(ember: string): THREE.Group {
  const candle = new THREE.Group();
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: "#9b8e78", roughness: 0.95 }),
  );
  wax.position.y = 0.14;
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 8, 6),
    new THREE.MeshBasicMaterial({ color: "#ffd28a" }),
  );
  flame.position.y = 0.36;
  flame.scale.set(0.75, 1.6, 0.75);
  const light = new THREE.PointLight(ember, 1.8, 2.4, 2);
  light.position.y = 0.38;
  candle.add(wax, flame, light);
  return candle;
}

export function createArenaModel(spec: BossSpec): ArenaModel {
  const group = new THREE.Group();
  const candleFlames = new THREE.Group();
  const [shadow, ember, ivory] = spec.boss.palette;
  const stoneTexture = createStoneTexture();
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: "#6d5553",
    map: stoneTexture,
    bumpMap: stoneTexture,
    bumpScale: 0.045,
    metalness: 0.08,
    roughness: 0.94,
  });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(6.25, 128), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const undercroft = new THREE.Mesh(
    new THREE.CylinderGeometry(6.25, 6.45, 0.42, 128),
    new THREE.MeshStandardMaterial({ color: shadow, roughness: 0.9 }),
  );
  undercroft.position.y = -0.23;
  group.add(undercroft);

  for (const radius of [1.45, 2.78, 3.88, 5.42]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.028, radius + 0.028, 96),
      new THREE.MeshBasicMaterial({
        color: radius === 2.78 ? ember : ivory,
        transparent: true,
        opacity: radius === 2.78 ? 0.18 : 0.06,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.025;
    group.add(ring);
  }

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(angle) * 1.45, 0.03, Math.sin(angle) * 1.45),
      new THREE.Vector3(Math.cos(angle) * 5.42, 0.03, Math.sin(angle) * 5.42),
    ]);
    group.add(
      new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: ivory, transparent: true, opacity: 0.055 }),
      ),
    );
  }

  const stone = new THREE.MeshStandardMaterial({ color: "#19161a", roughness: 0.94 });
  const trim = new THREE.MeshStandardMaterial({ color: "#2d2528", roughness: 0.82 });
  for (let index = 0; index < 9; index += 1) {
    const angle = Math.PI + (index / 8) * Math.PI;
    const pillar = createPillar(stone, trim);
    pillar.position.set(Math.cos(angle) * 7.25, 0, Math.sin(angle) * 7.25);
    pillar.rotation.y = -angle;
    group.add(pillar);
  }

  const altar = new THREE.Group();
  const altarBase = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 1.05), trim);
  altarBase.position.y = 0.18;
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.25), stone);
  altarTop.position.y = 0.46;
  const reliquary = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), floorMaterial);
  reliquary.position.y = 0.86;
  altar.add(altarBase, altarTop, reliquary);
  altar.position.set(0, 0, -5.55);
  group.add(altar);

  const candlePositions = [
    [-1.35, -5.1], [-0.92, -5.18], [0.92, -5.18], [1.35, -5.1],
    [-4.8, -2.4], [4.8, -2.4], [-5.1, 0.2], [5.1, 0.2],
  ] as const;
  candlePositions.forEach(([x, z], index) => {
    const candle = createCandle(ember);
    candle.position.set(x, 0.02, z);
    candle.scale.setScalar(0.82 + (index % 3) * 0.16);
    candleFlames.add(candle);
  });
  group.add(candleFlames);

  for (const side of [-1, 1]) {
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(1.55, 8.5, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: "#b5bac2",
        transparent: true,
        opacity: 0.018,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.set(side * 3.5, 4.1, -2.6);
    beam.rotation.z = side * 0.24;
    group.add(beam);
  }

  const random = createSeededRandom(0x913baf21);
  const particleCount = 230;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const radius = 1.4 + random() * 8;
    const angle = random() * Math.PI * 2;
    particlePositions[index * 3] = Math.cos(angle) * radius;
    particlePositions[index * 3 + 1] = random() * 5.8;
    particlePositions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const emberField = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: ember,
      size: 0.035,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  group.add(emberField);

  return { group, emberField, candleFlames };
}
