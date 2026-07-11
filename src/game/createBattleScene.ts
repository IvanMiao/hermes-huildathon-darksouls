import * as THREE from "three";
import { FABLE_BOSS_MUSIC_URL } from "../boss-spec/defaultBossSpec";
import type { BossSpec } from "../boss-spec/types";
import type { GameRecipeV0 } from "../game-recipe/types";
import {
  BattleController,
  DODGE_DURATION,
  type BossAttackState,
  type CombatEvent,
  type CombatInput,
} from "./combat/BattleController";
import { createArenaModel } from "./visuals/createArenaModel";
import { createBossModel } from "./visuals/createBossModel";
import { createGeneratedArenaModel } from "./visuals/createGeneratedArenaModel";
import { createGeneratedBossModel } from "./visuals/createGeneratedBossModel";
import { createGeneratedPlayerModel } from "./visuals/createGeneratedPlayerModel";
import { createPlayerModel } from "./visuals/createPlayerModel";
import {
  createAttackTelegraphs,
  updateAttackTelegraphs,
  type AttackTelegraphVisuals,
} from "./visuals/createAttackTelegraphs";
import {
  BOSS_IMPACT_DURATION,
  createCombatImpactFeedback,
  PERFECT_DODGE_DURATION,
  placeBossImpact,
  placePerfectDodge,
  placePlayerImpact,
  PLAYER_IMPACT_DURATION,
  updateCombatImpactFeedback,
  type CombatImpactFeedback,
} from "./visuals/createCombatImpactFeedback";
import {
  resolveBattleVisualProfile,
  type BattleVisualProfile,
} from "./visuals/resolveBattleVisualProfile";
import { createPhaseVoicePlayer, type PhaseVoicePlayer } from "./createPhaseVoicePlayer";
import { createBattleMusicPlayer, type BattleMusicPlayer } from "./createBattleMusicPlayer";

const MAX_PIXEL_RATIO = 2;
const STRIKE_VISUAL_DURATION = 0.28;
const ATTACK_LABELS = {
  sweep: "CENSURE OF THE FAITHFUL",
  charge: "ABSOLUTE PROCESSION",
  nova: "CHOIR OF CONSENT",
} as const;

interface BattleUi {
  root: HTMLElement;
  playerHealth: HTMLElement;
  bossHealth: HTMLElement;
  phase: HTMLElement;
  attackCallout: HTMLElement;
  eventCallout: HTMLElement;
  perfectDodgeCallout: HTMLElement;
  hitVignette: HTMLElement;
  intro: HTMLElement;
  result: HTMLElement;
  resultTitle: HTMLElement;
  resultLine: HTMLElement;
  restartButton: HTMLButtonElement;
}

interface CombatVisuals {
  boss: THREE.Group;
  bossRig: THREE.Group;
  bossWeaponPivot: THREE.Group;
  bossHalo: THREE.Group;
  scriptureShards: THREE.Group;
  player: THREE.Group;
  playerRig: THREE.Group;
  playerWeaponPivot: THREE.Group;
  playerCloak: THREE.Mesh;
  rollTrail: THREE.Mesh;
  bossBodyMaterial: THREE.MeshStandardMaterial;
  playerMaterial: THREE.MeshStandardMaterial;
  slash: THREE.Mesh;
  telegraphs: AttackTelegraphVisuals;
  impacts: CombatImpactFeedback;
  arenaBoundary: THREE.Mesh;
  emberField: THREE.Points;
  candleFlames: THREE.Group;
}

interface EffectTimers {
  slash: number;
  bossHit: number;
  playerHit: number;
  perfectDodge: number;
  hitStop: number;
  cameraShake: number;
  eventCallout: number;
}

function makeElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createInterface(container: HTMLElement, spec: BossSpec): BattleUi {
  const root = makeElement("div", "battle-ui");
  root.dataset.sceneUi = "";

  const playerPanel = makeElement("section", "player-vitals");
  playerPanel.setAttribute("aria-label", "Player health");
  playerPanel.append(makeElement("p", "vital-label", "THE UNNAMED WITNESS"));
  const playerTrack = makeElement("div", "health-track player-health-track");
  playerTrack.setAttribute("role", "progressbar");
  playerTrack.setAttribute("aria-label", "Player health");
  playerTrack.setAttribute("aria-valuemin", "0");
  playerTrack.setAttribute("aria-valuemax", "100");
  playerTrack.setAttribute("aria-valuenow", "100");
  const playerHealth = makeElement("div", "health-fill player-health-fill");
  playerTrack.append(playerHealth);
  playerPanel.append(playerTrack);

  const phase = makeElement("p", "phase-mark", "I");
  phase.setAttribute("aria-label", "Boss phase one");

  const attackCallout = makeElement("p", "attack-callout");
  const eventCallout = makeElement("p", "event-callout");
  eventCallout.setAttribute("aria-live", "polite");
  const perfectDodgeCallout = makeElement("p", "perfect-dodge-callout", "PERFECT REBUTTAL");
  perfectDodgeCallout.setAttribute("aria-live", "polite");
  const hitVignette = makeElement("div", "hit-vignette");
  hitVignette.setAttribute("aria-hidden", "true");

  const controls = makeElement(
    "p",
    "controls",
    "WASD / ARROWS  MOVE    SPACE  ROLL    J  STRIKE",
  );

  const bossHud = makeElement("section", "boss-hud");
  bossHud.setAttribute("aria-label", "Boss health");
  const bossIdentity = makeElement("div", "boss-identity");
  bossIdentity.append(
    makeElement("p", "boss-title", spec.boss.title),
    makeElement("h1", "boss-name", spec.boss.name),
  );
  const bossTrack = makeElement("div", "health-track boss-health-track");
  bossTrack.setAttribute("role", "progressbar");
  bossTrack.setAttribute("aria-label", `${spec.boss.name} health`);
  bossTrack.setAttribute("aria-valuemin", "0");
  bossTrack.setAttribute("aria-valuemax", String(spec.boss.maxHp));
  bossTrack.setAttribute("aria-valuenow", String(spec.boss.maxHp));
  const bossHealth = makeElement("div", "health-fill boss-health-fill");
  bossTrack.append(bossHealth);
  bossHud.append(bossIdentity, bossTrack);

  const intro = makeElement("section", "battle-intro");
  intro.append(
    makeElement("p", "intro-kicker", "A VERSE TAKES FLESH"),
    makeElement("h2", "intro-name", spec.boss.name),
    makeElement("p", "intro-title", spec.boss.title),
    makeElement("blockquote", "intro-line", spec.boss.lines.intro),
  );

  const result = makeElement("section", "battle-result is-hidden");
  result.setAttribute("aria-live", "assertive");
  const resultTitle = makeElement("h2", "result-title");
  const resultLine = makeElement("p", "result-line");
  const restartButton = makeElement("button", "restart-button", "RISE AGAIN") as HTMLButtonElement;
  restartButton.type = "button";
  result.append(resultTitle, resultLine, restartButton);

  root.append(
    playerPanel,
    phase,
    attackCallout,
    eventCallout,
    perfectDodgeCallout,
    hitVignette,
    controls,
    bossHud,
    intro,
    result,
  );
  container.append(root);

  return {
    root,
    playerHealth,
    bossHealth,
    phase,
    attackCallout,
    eventCallout,
    perfectDodgeCallout,
    hitVignette,
    intro,
    result,
    resultTitle,
    resultLine,
    restartButton,
  };
}

function createVisuals(
  scene: THREE.Scene,
  recipe: GameRecipeV0,
  profile: BattleVisualProfile,
): CombatVisuals {
  const spec = recipe.boss;
  const arena = profile.family === "fable"
    ? createArenaModel(spec)
    : createGeneratedArenaModel(spec, profile.arena);
  const boss = profile.family === "fable"
    ? createBossModel(spec)
    : createGeneratedBossModel(spec, profile.boss);
  const player = profile.family === "fable"
    ? createPlayerModel()
    : createGeneratedPlayerModel(profile.player);
  const telegraphs = createAttackTelegraphs(recipe);
  const impacts = createCombatImpactFeedback(spec.boss.palette[1], spec.boss.palette[2]);
  const slash = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.045, 8, 48, Math.PI * 1.25),
    new THREE.MeshBasicMaterial({
      color: "#d9e3df",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  slash.rotation.x = -Math.PI / 2;
  slash.position.y = 0.65;
  slash.visible = false;
  const arenaBoundary = new THREE.Mesh(
    new THREE.RingGeometry(0.97, 1, 128),
    new THREE.MeshBasicMaterial({
      color: spec.boss.palette[2],
      transparent: true,
      opacity: recipe.arena.rule === "closing_ring" ? 0.34 : 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  arenaBoundary.rotation.x = -Math.PI / 2;
  arenaBoundary.position.y = 0.07;
  arenaBoundary.visible = recipe.arena.rule !== "open_ring";

  scene.add(
    arena.group,
    boss.group,
    player.group,
    telegraphs.group,
    impacts.group,
    slash,
    arenaBoundary,
  );

  return {
    boss: boss.group,
    bossRig: boss.rig,
    bossWeaponPivot: boss.weaponPivot,
    bossHalo: boss.halo,
    scriptureShards: boss.scriptureShards,
    player: player.group,
    playerRig: player.rig,
    playerWeaponPivot: player.weaponPivot,
    playerCloak: player.cloak,
    rollTrail: player.rollTrail,
    bossBodyMaterial: boss.bodyMaterial,
    playerMaterial: player.armorMaterial,
    telegraphs,
    impacts,
    slash,
    arenaBoundary,
    emberField: arena.emberField,
    candleFlames: arena.candleFlames,
  };
}

function attackProgress(attack: BossAttackState): number {
  return Math.min(1, attack.elapsed / Math.max(attack.duration, 0.001));
}

function updatePlayerAnimation(
  visuals: CombatVisuals,
  controller: BattleController,
  timers: EffectTimers,
  elapsed: number,
  reducedMotion: boolean,
): void {
  const player = controller.state.player;
  const isRolling = player.dodgeRemaining > 0;

  if (isRolling) {
    const progress = 1 - player.dodgeRemaining / DODGE_DURATION;
    visuals.playerRig.rotation.x = -progress * Math.PI * 2;
    visuals.playerRig.position.y = 0.72 + Math.sin(progress * Math.PI) * 0.16;
    visuals.playerCloak.rotation.x = -0.42 - Math.sin(progress * Math.PI) * 0.34;
    visuals.rollTrail.visible = true;
    const trailMaterial = visuals.rollTrail.material;
    if (trailMaterial instanceof THREE.MeshBasicMaterial) {
      trailMaterial.opacity = Math.sin(progress * Math.PI) * 0.24;
    }
    visuals.rollTrail.scale.y = 0.75 + Math.sin(progress * Math.PI) * 0.55;
  } else {
    visuals.playerRig.rotation.x = 0;
    visuals.playerRig.position.y = 0.72 + (reducedMotion ? 0 : Math.sin(elapsed * 5) * 0.012);
    visuals.playerCloak.rotation.x = -0.11;
    visuals.rollTrail.visible = false;
  }

  if (timers.slash > 0) {
    const progress = 1 - timers.slash / STRIKE_VISUAL_DURATION;
    const swing = Math.sin(Math.min(1, progress) * Math.PI);
    visuals.playerWeaponPivot.rotation.set(0.08, 0.12 - swing * 0.35, -0.52 - swing * 2.15);
    visuals.playerRig.rotation.y = -swing * 0.18;
  } else {
    visuals.playerWeaponPivot.rotation.set(0.08, 0.12, -0.52);
    visuals.playerRig.rotation.y = 0;
  }
}

function updateBossAnimation(
  visuals: CombatVisuals,
  attack: BossAttackState | null,
  elapsed: number,
  phase: 1 | 2,
  reducedMotion: boolean,
): void {
  const idle = reducedMotion ? 0 : Math.sin(elapsed * (phase === 2 ? 2.2 : 1.45));
  visuals.bossRig.position.y = idle * 0.035;
  visuals.bossRig.rotation.set(0, 0, 0);
  visuals.bossWeaponPivot.rotation.set(0, 0, -0.42);
  visuals.bossHalo.scale.setScalar(phase === 2 ? 1.12 : 1);

  if (attack) {
    const progress = attackProgress(attack);
    const telegraph = attack.stage === "telegraph" ? progress : 1;

    if (attack.type === "sweep") {
      const swing = attack.stage === "active" ? Math.sin(progress * Math.PI) : 0;
      visuals.bossWeaponPivot.rotation.z = -0.42 + telegraph * 1.05 - swing * 3.4;
      visuals.bossRig.rotation.y = attack.stage === "active" ? -swing * 0.62 : telegraph * 0.18;
    } else if (attack.type === "charge") {
      visuals.bossWeaponPivot.rotation.z = -0.42 - telegraph * 0.78;
      visuals.bossRig.rotation.x = attack.stage === "active" ? -0.42 : -telegraph * 0.2;
    } else {
      visuals.bossWeaponPivot.rotation.z = -0.42 - telegraph * 1.18;
      visuals.bossRig.position.y += telegraph * 0.2;
      const haloScale = 1 + telegraph * 0.34 + (attack.stage === "active" ? 0.2 : 0);
      visuals.bossHalo.scale.setScalar(haloScale);
    }
  }

  visuals.scriptureShards.rotation.y = reducedMotion ? 0 : elapsed * (phase === 2 ? 0.55 : 0.28);
}

function updateEnvironmentAnimation(
  visuals: CombatVisuals,
  elapsed: number,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    return;
  }

  visuals.emberField.rotation.y += 0.00042;
  visuals.emberField.position.y = Math.sin(elapsed * 0.24) * 0.18;
  visuals.candleFlames.children.forEach((candle, index) => {
    const flame = candle.children[1];
    if (flame) {
      flame.scale.y = 1.45 + Math.sin(elapsed * 8 + index * 1.7) * 0.22;
      flame.position.x = Math.sin(elapsed * 5.5 + index) * 0.008;
    }
  });
}

function updateHud(ui: BattleUi, controller: BattleController): void {
  const { player, boss, phase } = controller.state;
  ui.playerHealth.style.transform = `scaleX(${player.hp / player.maxHp})`;
  ui.bossHealth.style.transform = `scaleX(${boss.hp / boss.maxHp})`;
  ui.playerHealth.parentElement?.setAttribute("aria-valuenow", String(player.hp));
  ui.bossHealth.parentElement?.setAttribute("aria-valuenow", String(boss.hp));
  ui.root.dataset.playerPosition = `${player.position.x.toFixed(2)},${player.position.z.toFixed(2)}`;
  ui.root.dataset.playerInvulnerable = String(player.invulnerableRemaining > 0);
  ui.root.dataset.bossHp = String(boss.hp);
  ui.phase.textContent = phase === 1 ? "I" : "II";
  ui.phase.setAttribute("aria-label", `Boss phase ${phase === 1 ? "one" : "two"}`);

  const attack = boss.attack;
  ui.attackCallout.textContent = attack?.stage === "telegraph"
    ? ATTACK_LABELS[attack.type]
    : "";
  ui.attackCallout.classList.toggle("is-visible", attack?.stage === "telegraph");
}

function showResult(ui: BattleUi, outcome: "victory" | "defeat", spec: BossSpec): void {
  const victory = outcome === "victory";
  ui.resultTitle.textContent = victory ? "THE ORACLE FALLS SILENT" : "YOU HAVE BEEN UNWRITTEN";
  ui.resultLine.textContent = victory ? spec.boss.lines.defeat : "The ash remembers. Rise, and answer again.";
  ui.restartButton.textContent = victory ? "FACE THE VERSE AGAIN" : "RISE AGAIN";
  ui.result.classList.remove("is-hidden");
  ui.restartButton.focus({ preventScroll: true });
}

function handleEvents(
  events: CombatEvent[],
  ui: BattleUi,
  visuals: CombatVisuals,
  timers: EffectTimers,
  spec: BossSpec,
  recipe?: GameRecipeV0,
  phaseVoice?: PhaseVoicePlayer,
  battleMusic?: BattleMusicPlayer,
): void {
  for (const event of events) {
    if (event.type === "player_strike") {
      timers.slash = STRIKE_VISUAL_DURATION;
      if (event.connected) {
        timers.bossHit = BOSS_IMPACT_DURATION;
        timers.hitStop = Math.max(timers.hitStop, 0.072);
        timers.cameraShake = 0.1;
        placeBossImpact(visuals.impacts, {
          x: visuals.boss.position.x,
          z: visuals.boss.position.z,
        });
      }
    } else if (event.type === "perfect_dodge") {
      timers.perfectDodge = PERFECT_DODGE_DURATION;
      timers.hitStop = Math.max(timers.hitStop, 0.045);
      timers.cameraShake = Math.max(timers.cameraShake, 0.08);
      placePerfectDodge(visuals.impacts, {
        x: visuals.player.position.x,
        z: visuals.player.position.z,
      });
    } else if (event.type === "player_hit") {
      timers.playerHit = PLAYER_IMPACT_DURATION;
      timers.hitStop = Math.max(timers.hitStop, 0.086);
      timers.cameraShake = 0.2;
      placePlayerImpact(visuals.impacts, {
        x: visuals.player.position.x,
        z: visuals.player.position.z,
      });
    } else if (event.type === "phase_two") {
      battleMusic?.enterPhaseTwo();
      phaseVoice?.playPhaseTwo();
      timers.eventCallout = 1.8;
      timers.cameraShake = 0.38;
      const ruleCallout = recipe?.archetype === "procession"
        ? " THE RING CLOSES. PROCESSION DOUBLES."
        : recipe?.archetype === "revelation"
          ? " THE CENTER CONDEMNS. SEEK THE OUTER RING."
          : "";
      ui.eventCallout.textContent = `${spec.boss.lines.phaseTwo}${ruleCallout}`;
      ui.eventCallout.classList.add("is-visible", "is-phase");
      visuals.bossBodyMaterial.emissiveIntensity = 0.48;
    } else if (event.type === "victory" || event.type === "defeat") {
      battleMusic?.playAftermath();
      showResult(ui, event.type, spec);
    } else if (event.type === "restart") {
      phaseVoice?.reset();
      battleMusic?.reset();
      ui.result.classList.add("is-hidden");
      ui.eventCallout.classList.remove("is-visible", "is-phase");
      timers.bossHit = 0;
      timers.playerHit = 0;
      timers.perfectDodge = 0;
      timers.hitStop = 0;
      visuals.bossBodyMaterial.emissiveIntensity = 0.14;
      visuals.boss.visible = true;
      visuals.player.visible = true;
    }
  }
}

function updateEffects(
  delta: number,
  elapsed: number,
  controller: BattleController,
  visuals: CombatVisuals,
  ui: BattleUi,
  timers: EffectTimers,
): void {
  timers.slash = Math.max(0, timers.slash - delta);
  timers.bossHit = Math.max(0, timers.bossHit - delta);
  timers.playerHit = Math.max(0, timers.playerHit - delta);
  timers.perfectDodge = Math.max(0, timers.perfectDodge - delta);
  timers.hitStop = Math.max(0, timers.hitStop - delta);
  timers.cameraShake = Math.max(0, timers.cameraShake - delta);
  timers.eventCallout = Math.max(0, timers.eventCallout - delta);

  visuals.slash.visible = timers.slash > 0;
  if (visuals.slash.visible) {
    visuals.slash.position.set(
      controller.state.player.position.x,
      0.62,
      controller.state.player.position.z,
    );
    visuals.slash.rotation.z = elapsed * 10;
    const progress = 1 - timers.slash / STRIKE_VISUAL_DURATION;
    visuals.slash.scale.setScalar(0.85 + progress * 0.72);
  }

  visuals.bossBodyMaterial.emissiveIntensity = timers.bossHit > 0
    ? 1.4
    : controller.state.phase === 2 ? 0.48 : 0.14;
  visuals.playerMaterial.emissiveIntensity = timers.playerHit > 0 ? 1.15 : 0.1;
  updateCombatImpactFeedback(visuals.impacts, timers);
  ui.root.classList.toggle("is-player-hit", timers.playerHit > 0);
  ui.perfectDodgeCallout.classList.toggle("is-visible", timers.perfectDodge > 0);

  if (timers.eventCallout === 0) {
    ui.eventCallout.classList.remove("is-visible", "is-phase");
  }
}

function createInput(container: HTMLElement): {
  read: () => CombatInput;
  requestRestart: () => void;
  dispose: () => void;
} {
  const held = new Set<string>();
  const pressed = new Set<string>();
  let restartRequested = false;
  const controlledKeys = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyJ",
    "Space",
    "Enter",
    "KeyR",
  ]);

  function onKeyDown(event: KeyboardEvent): void {
    if (!controlledKeys.has(event.code)) {
      return;
    }
    event.preventDefault();
    if (!event.repeat) {
      pressed.add(event.code);
    }
    held.add(event.code);
  }

  function onKeyUp(event: KeyboardEvent): void {
    held.delete(event.code);
  }

  function onPointerDown(): void {
    container.focus({ preventScroll: true });
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  container.addEventListener("pointerdown", onPointerDown);

  return {
    read: () => {
      const input: CombatInput = {
        movement: {
          x: Number(held.has("KeyD") || held.has("ArrowRight"))
            - Number(held.has("KeyA") || held.has("ArrowLeft")),
          z: Number(held.has("KeyS") || held.has("ArrowDown"))
            - Number(held.has("KeyW") || held.has("ArrowUp")),
        },
        attackPressed: pressed.has("KeyJ"),
        dodgePressed: pressed.has("Space"),
        restartPressed: restartRequested || pressed.has("Enter") || pressed.has("KeyR"),
      };
      pressed.clear();
      restartRequested = false;
      return input;
    },
    requestRestart: () => {
      restartRequested = true;
    },
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      container.removeEventListener("pointerdown", onPointerDown);
    },
  };
}

function disposeScene(scene: THREE.Scene): void {
  const disposedMaterials = new Set<THREE.Material>();
  const disposedTextures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points)) {
      return;
    }
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!disposedMaterials.has(material)) {
        Object.values(material).forEach((value: unknown) => {
          if (value instanceof THREE.Texture && !disposedTextures.has(value)) {
            value.dispose();
            disposedTextures.add(value);
          }
        });
        material.dispose();
        disposedMaterials.add(material);
      }
    });
  });
}

export function createBattleScene(recipe: GameRecipeV0, container: HTMLElement): () => void {
  const spec = recipe.boss;
  const visualProfile = resolveBattleVisualProfile(recipe);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const generatedGarden = visualProfile.family === "generated"
    && visualProfile.arena === "obsidian_garden";
  scene.background = new THREE.Color(
    visualProfile.family === "fable"
      ? "#070609"
      : generatedGarden ? "#050a07" : "#050914",
  );
  scene.fog = new THREE.FogExp2(
    visualProfile.family === "fable"
      ? spec.arena.fog
      : generatedGarden ? "#102218" : "#111a38",
    visualProfile.family === "fable" ? 0.062 : 0.045,
  );

  const camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 70);
  const cameraBase = recipe.presentation.cameraMood === "watchful"
    ? new THREE.Vector3(0, 8.7, 10.8)
    : recipe.presentation.cameraMood === "ceremonial"
      ? new THREE.Vector3(0, 9.05, 9.55)
      : new THREE.Vector3(0, 8.35, 10.1);
  camera.position.copy(cameraBase);
  camera.lookAt(0, 0.75, 0);

  scene.add(new THREE.HemisphereLight(
    visualProfile.family === "fable" ? "#8b8b91" : generatedGarden ? "#82a875" : "#789bc9",
    visualProfile.family === "fable" ? "#09060b" : "#030609",
    visualProfile.family === "fable" ? 1.15 : 1.38,
  ));
  const moonlight = new THREE.DirectionalLight(
    visualProfile.family === "fable" ? "#c6ccd0" : generatedGarden ? "#d6ffb8" : "#b9d8ff",
    visualProfile.family === "fable" ? 2.6 : 3.15,
  );
  moonlight.position.set(-5, 9, 4);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(1024, 1024);
  moonlight.shadow.camera.left = -8;
  moonlight.shadow.camera.right = 8;
  moonlight.shadow.camera.top = 8;
  moonlight.shadow.camera.bottom = -8;
  scene.add(moonlight);

  const emberLight = new THREE.PointLight(
    visualProfile.family === "fable"
      ? spec.boss.palette[1]
      : generatedGarden ? "#a8e063" : "#9c7cff",
    visualProfile.family === "fable" ? 22 : 28,
    16,
    2,
  );
  emberLight.position.set(0, 1.2, -2.5);
  scene.add(emberLight);

  const controller = new BattleController(recipe);
  const visuals = createVisuals(scene, recipe, visualProfile);
  const ui = createInterface(container, spec);
  ui.root.dataset.archetype = recipe.archetype;
  ui.root.dataset.arenaRule = recipe.arena.rule;
  ui.root.dataset.visualFamily = visualProfile.family;
  if (visualProfile.family === "generated") {
    ui.root.dataset.arenaVisual = visualProfile.arena;
    ui.root.dataset.playerVisual = visualProfile.player;
    ui.root.dataset.bossVisual = visualProfile.boss;
  }
  const input = createInput(container);
  const battleMusic = createBattleMusicPlayer(
    visualProfile.family === "fable" ? FABLE_BOSS_MUSIC_URL : "",
    container,
  );
  const phaseVoice = createPhaseVoicePlayer(spec.voice.url, container, {
    onPlaybackStart: battleMusic.duckForVoice,
    onPlaybackEnd: battleMusic.restoreAfterVoice,
  });
  const timers: EffectTimers = {
    slash: 0,
    bossHit: 0,
    playerHit: 0,
    perfectDodge: 0,
    hitStop: 0,
    cameraShake: 0,
    eventCallout: 0,
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  container.tabIndex = 0;
  container.setAttribute(
    "aria-label",
    `${spec.boss.name}, ${spec.boss.title} boss fight. Use WASD or arrows to move, Space to roll, and J to strike.`,
  );
  ui.restartButton.addEventListener("click", input.requestRestart);

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1), MAX_PIXEL_RATIO));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  const clock = new THREE.Clock();
  let animationFrame = 0;
  let visualElapsed = 0;
  let introVisibleUntil = 2.35;
  let paused = false;
  let pendingStepSeconds = 0;
  let debugRenderRequested = false;
  let disposed = false;
  let uninstallDebugBridge = (): void => undefined;

  if (import.meta.env.DEV) {
    void import("../debugBridge").then(({ installDebugBridge }) => {
      if (disposed) {
        return;
      }

      uninstallDebugBridge = installDebugBridge({
        controller,
        spec,
        dispatch: (events) => handleEvents(
          events,
          ui,
          visuals,
          timers,
          spec,
          recipe,
          phaseVoice,
          battleMusic,
        ),
        getIntroVisible: () => visualElapsed <= introVisibleUntil,
        showIntro: () => {
          introVisibleUntil = visualElapsed + 2.35;
        },
        dismissIntro: () => {
          introVisibleUntil = visualElapsed - 0.001;
        },
        getPaused: () => paused,
        setPaused: (nextPaused) => {
          paused = nextPaused;
          pendingStepSeconds = 0;
        },
        step: (milliseconds) => {
          if (Number.isFinite(milliseconds) && milliseconds > 0) {
            paused = true;
            pendingStepSeconds += Math.min(milliseconds / 1_000, 10);
          }
        },
        requestRender: () => {
          debugRenderRequested = true;
        },
      });
    });
  }

  function render(): void {
    const clockDelta = Math.min(clock.getDelta(), 0.05);
    const delta = paused ? Math.min(pendingStepSeconds, 0.05) : clockDelta;
    pendingStepSeconds = Math.max(0, pendingStepSeconds - delta);
    if (paused && delta === 0 && !debugRenderRequested) {
      animationFrame = window.requestAnimationFrame(render);
      return;
    }
    debugRenderRequested = false;
    const simulationDelta = !paused && timers.hitStop > 0 ? 0 : delta;
    visualElapsed += simulationDelta;
    const elapsed = visualElapsed;
    const events = simulationDelta > 0 ? controller.update(simulationDelta, input.read()) : [];
    handleEvents(events, ui, visuals, timers, spec, recipe, phaseVoice, battleMusic);

    const { player, boss, outcome } = controller.state;
    visuals.player.position.set(player.position.x, 0, player.position.z);
    visuals.boss.position.set(boss.position.x, 0, boss.position.z);
    const playerFacing = Math.atan2(
      boss.position.x - player.position.x,
      boss.position.z - player.position.z,
    );
    const bossFacing = Math.atan2(
      player.position.x - boss.position.x,
      player.position.z - boss.position.z,
    );
    visuals.player.rotation.set(0, playerFacing, 0);
    visuals.boss.rotation.set(0, bossFacing, 0);
    visuals.boss.visible = outcome !== "victory";
    visuals.player.visible = outcome !== "defeat";

    visuals.arenaBoundary.scale.setScalar(
      recipe.arena.rule === "inner_sanctuary"
        ? 3.65
        : controller.state.arena.radius,
    );
    const attackFeedbackStage = updateAttackTelegraphs(
      visuals.telegraphs,
      boss.attack,
      boss.position,
      controller.state.phase,
      recipe,
    );
    ui.root.dataset.attackFeedbackStage = attackFeedbackStage;
    updatePlayerAnimation(visuals, controller, timers, elapsed, reducedMotion);
    updateBossAnimation(visuals, boss.attack, elapsed, controller.state.phase, reducedMotion);
    updateEnvironmentAnimation(visuals, elapsed, reducedMotion);
    updateEffects(paused ? delta : clockDelta, elapsed, controller, visuals, ui, timers);
    updateHud(ui, controller);

    const introComplete = elapsed > introVisibleUntil;
    ui.intro.classList.toggle("is-hidden", introComplete);
    ui.root.classList.toggle("is-intro", !introComplete);

    const shake = reducedMotion ? 0 : timers.cameraShake * 0.12;
    camera.position.set(
      cameraBase.x + (Math.random() - 0.5) * shake,
      cameraBase.y + (Math.random() - 0.5) * shake,
      cameraBase.z + (Math.random() - 0.5) * shake,
    );
    camera.lookAt(0, 0.7, 0);
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  }

  render();

  return () => {
    disposed = true;
    uninstallDebugBridge();
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    input.dispose();
    phaseVoice.dispose();
    battleMusic.dispose();
    ui.restartButton.removeEventListener("click", input.requestRestart);
    ui.root.remove();
    renderer.domElement.remove();
    renderer.dispose();
    disposeScene(scene);
  };
}
