import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FABLE_PHASE_TWO_VOICE_URL } from "../boss-spec/defaultBossSpec";
import { createPhaseVoicePlayer } from "./createPhaseVoicePlayer";

class FakeAudio extends EventTarget {
  static latest: FakeAudio | undefined;
  readonly pause = vi.fn();
  readonly play = vi.fn(async () => undefined);
  readonly removeAttribute = vi.fn();
  preload = "";
  volume = 1;
  currentTime = 0;

  src = "";

  constructor() {
    super();
    FakeAudio.latest = this;
  }
}

describe("FABLE phase voice", () => {
  beforeEach(() => {
    FakeAudio.latest = undefined;
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preloads the generated ElevenLabs file and plays once per fight", async () => {
    const interactionTarget = new EventTarget() as HTMLElement;
    const player = createPhaseVoicePlayer(FABLE_PHASE_TWO_VOICE_URL, interactionTarget);
    const audio = FakeAudio.latest;
    expect(audio?.src).toBe("");
    expect(audio?.preload).toBe("none");

    player.playPhaseTwo();
    player.playPhaseTwo();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(audio?.src).toBe(FABLE_PHASE_TWO_VOICE_URL);
    expect(audio?.play).toHaveBeenCalledOnce();

    player.reset();
    player.playPhaseTwo();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(audio?.play).toHaveBeenCalledTimes(2);
  });

  it("keeps unresolved relative placeholders silent", () => {
    const player = createPhaseVoicePlayer("/runs/missing/voice.mp3", new EventTarget() as HTMLElement);
    player.playPhaseTwo();
    expect(FakeAudio.latest).toBeUndefined();
  });

  it("reports playback boundaries so battle music can duck", async () => {
    const onPlaybackStart = vi.fn();
    const onPlaybackEnd = vi.fn();
    const player = createPhaseVoicePlayer(
      FABLE_PHASE_TWO_VOICE_URL,
      new EventTarget() as HTMLElement,
      { onPlaybackStart, onPlaybackEnd },
    );

    player.playPhaseTwo();
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(onPlaybackStart).toHaveBeenCalledOnce();

    FakeAudio.latest?.dispatchEvent(new Event("ended"));
    expect(onPlaybackEnd).toHaveBeenCalledOnce();
  });
});
