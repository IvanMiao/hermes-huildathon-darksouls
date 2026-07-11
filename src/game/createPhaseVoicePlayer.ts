export interface PhaseVoicePlayer {
  playPhaseTwo(): void;
  reset(): void;
  dispose(): void;
}

const silentPlayer: PhaseVoicePlayer = {
  playPhaseTwo: () => undefined,
  reset: () => undefined,
  dispose: () => undefined,
};

/** Plays only release-hosted audio. Local placeholder paths remain silent. */
export function createPhaseVoicePlayer(
  voiceUrl: string,
  interactionTarget: HTMLElement,
): PhaseVoicePlayer {
  if (!voiceUrl.startsWith("https://")) {
    return silentPlayer;
  }

  const audio = new Audio(voiceUrl);
  audio.preload = "auto";
  let played = false;
  let disposed = false;

  const primeAudio = () => {
    if (disposed) return;
    audio.volume = 0;
    void audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 1;
    }).catch(() => {
      audio.volume = 1;
    });
  };
  interactionTarget.addEventListener("pointerdown", primeAudio, { once: true });
  window.addEventListener("keydown", primeAudio, { once: true });
  audio.load();

  return {
    playPhaseTwo() {
      if (played || disposed) return;
      played = true;
      audio.volume = 1;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    },
    reset() {
      played = false;
      audio.pause();
      audio.currentTime = 0;
    },
    dispose() {
      disposed = true;
      audio.pause();
      audio.removeAttribute("src");
      interactionTarget.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    },
  };
}
