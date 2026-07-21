import type { BattleMusicSpec } from "../game-recipe/types";

export interface BattleMusicPlayer {
  enterPhaseTwo(): void;
  playAftermath(): void;
  duckForVoice(): void;
  restoreAfterVoice(): void;
  reset(): void;
  dispose(): void;
}

type MusicSection = "phase_one" | "phase_two" | "aftermath";

const BASE_VOLUME = 0.32;
const DUCKED_VOLUME = 0.11;
const silentPlayer: BattleMusicPlayer = {
  enterPhaseTwo: () => undefined,
  playAftermath: () => undefined,
  duckForVoice: () => undefined,
  restoreAfterVoice: () => undefined,
  reset: () => undefined,
  dispose: () => undefined,
};

function isReleaseHostedAudio(url: string): boolean {
  return url.startsWith("https://")
    || url.startsWith("/api/evidence/artifacts/");
}

/** Keeps the generated score aligned with combat state without blocking play. */
export function createBattleMusicPlayer(
  music: BattleMusicSpec,
  interactionTarget: HTMLElement,
): BattleMusicPlayer {
  if (!isReleaseHostedAudio(music.url)) {
    return silentPlayer;
  }
  const phaseOneLoopStartSeconds = music.sections.phaseOneLoopStartMs / 1_000;
  const phaseTwoStartSeconds = music.sections.phaseTwoStartMs / 1_000;
  const phaseTwoLoopStartSeconds = music.sections.phaseTwoLoopStartMs / 1_000;
  const aftermathStartSeconds = music.sections.aftermathStartMs / 1_000;

  const audio = new Audio();
  audio.preload = "none";
  audio.volume = BASE_VOLUME;
  let section: MusicSection = "phase_one";
  let started = false;
  let startRequested = false;
  let disposed = false;
  let ducked = false;
  let pendingSeekSeconds = 0;

  const seek = (seconds: number) => {
    pendingSeekSeconds = seconds;
    if (!audio.src) return;
    try {
      audio.currentTime = seconds;
    } catch {
      // Metadata may not be available yet; loadedmetadata applies the pending seek.
    }
  };

  const applyPendingSeek = () => {
    seek(pendingSeekSeconds);
  };

  const removeStartListeners = () => {
    interactionTarget.removeEventListener("pointerdown", startFromInteraction);
    window.removeEventListener("keydown", startFromInteraction);
  };

  const startFromInteraction = () => {
    if (started || startRequested || disposed) return;
    startRequested = true;
    globalThis.setTimeout(() => {
      if (disposed) return;
      audio.src = music.url;
      applyPendingSeek();
      void audio.play().then(() => {
        started = true;
        startRequested = false;
        removeStartListeners();
      }).catch(() => {
        startRequested = false;
      });
    }, 0);
  };

  const keepCurrentSectionLooping = () => {
    if (section === "phase_one" && audio.currentTime >= phaseTwoStartSeconds) {
      seek(phaseOneLoopStartSeconds);
    } else if (section === "phase_two" && audio.currentTime >= aftermathStartSeconds) {
      seek(phaseTwoLoopStartSeconds);
    }
  };

  interactionTarget.addEventListener("pointerdown", startFromInteraction);
  window.addEventListener("keydown", startFromInteraction);
  audio.addEventListener("loadedmetadata", applyPendingSeek);
  audio.addEventListener("timeupdate", keepCurrentSectionLooping);

  return {
    enterPhaseTwo() {
      if (disposed) return;
      section = "phase_two";
      seek(phaseTwoStartSeconds);
    },
    playAftermath() {
      if (disposed) return;
      section = "aftermath";
      seek(aftermathStartSeconds);
    },
    duckForVoice() {
      if (disposed) return;
      ducked = true;
      audio.volume = DUCKED_VOLUME;
    },
    restoreAfterVoice() {
      if (disposed) return;
      ducked = false;
      audio.volume = BASE_VOLUME;
    },
    reset() {
      if (disposed) return;
      section = "phase_one";
      seek(0);
      audio.volume = ducked ? DUCKED_VOLUME : BASE_VOLUME;
      if (started) {
        void audio.play().catch(() => undefined);
      }
    },
    dispose() {
      disposed = true;
      removeStartListeners();
      audio.removeEventListener("loadedmetadata", applyPendingSeek);
      audio.removeEventListener("timeupdate", keepCurrentSectionLooping);
      audio.pause();
      audio.removeAttribute("src");
    },
  };
}
