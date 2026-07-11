export interface PhaseVoicePlayer {
  playPhaseTwo(): void;
  reset(): void;
  dispose(): void;
}

export interface PhaseVoicePlaybackCallbacks {
  onPlaybackStart?(): void;
  onPlaybackEnd?(): void;
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
  callbacks: PhaseVoicePlaybackCallbacks = {},
): PhaseVoicePlayer {
  if (!voiceUrl.startsWith("https://")) {
    return silentPlayer;
  }

  const audio = new Audio();
  audio.preload = "none";
  let played = false;
  let playing = false;
  let priming = false;
  let disposed = false;
  let playbackGeneration = 0;

  const ensureSource = () => {
    if (!audio.src) {
      audio.src = voiceUrl;
    }
  };

  const finishPlayback = () => {
    if (!playing) return;
    playing = false;
    callbacks.onPlaybackEnd?.();
  };

  const primeAudio = () => {
    if (disposed || priming) return;
    priming = true;
    globalThis.setTimeout(() => {
      if (disposed || playing) return;
      ensureSource();
      audio.volume = 0;
      void audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
      }).catch(() => {
        audio.volume = 1;
      });
    }, 0);
  };
  interactionTarget.addEventListener("pointerdown", primeAudio, { once: true });
  window.addEventListener("keydown", primeAudio, { once: true });
  audio.addEventListener("ended", finishPlayback);
  audio.addEventListener("error", finishPlayback);

  return {
    playPhaseTwo() {
      if (played || disposed) return;
      played = true;
      playing = true;
      const generation = ++playbackGeneration;
      callbacks.onPlaybackStart?.();
      globalThis.setTimeout(() => {
        if (disposed || generation !== playbackGeneration) return;
        ensureSource();
        audio.volume = 1;
        audio.currentTime = 0;
        void audio.play().catch(finishPlayback);
      }, 0);
    },
    reset() {
      played = false;
      playbackGeneration += 1;
      finishPlayback();
      audio.pause();
      audio.currentTime = 0;
    },
    dispose() {
      disposed = true;
      playbackGeneration += 1;
      finishPlayback();
      audio.pause();
      audio.removeEventListener("ended", finishPlayback);
      audio.removeEventListener("error", finishPlayback);
      audio.removeAttribute("src");
      interactionTarget.removeEventListener("pointerdown", primeAudio);
      window.removeEventListener("keydown", primeAudio);
    },
  };
}
