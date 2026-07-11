import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FABLE_PHASE_TWO_VOICE_URL } from "../boss-spec/defaultBossSpec";
import { createPhaseVoicePlayer } from "./createPhaseVoicePlayer";

class FakeAudio {
  static latest: FakeAudio | undefined;
  readonly load = vi.fn();
  readonly pause = vi.fn();
  readonly play = vi.fn(async () => undefined);
  readonly removeAttribute = vi.fn();
  preload = "";
  volume = 1;
  currentTime = 0;

  constructor(readonly src: string) {
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
    expect(audio?.src).toBe(FABLE_PHASE_TWO_VOICE_URL);
    expect(audio?.preload).toBe("auto");
    expect(audio?.load).toHaveBeenCalledOnce();

    player.playPhaseTwo();
    player.playPhaseTwo();
    await Promise.resolve();
    expect(audio?.play).toHaveBeenCalledOnce();

    player.reset();
    player.playPhaseTwo();
    await Promise.resolve();
    expect(audio?.play).toHaveBeenCalledTimes(2);
  });

  it("keeps unresolved relative placeholders silent", () => {
    const player = createPhaseVoicePlayer("/runs/missing/voice.mp3", new EventTarget() as HTMLElement);
    player.playPhaseTwo();
    expect(FakeAudio.latest).toBeUndefined();
  });
});
