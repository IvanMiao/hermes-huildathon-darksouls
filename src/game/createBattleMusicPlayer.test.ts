import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FABLE_BOSS_MUSIC_URL } from "../boss-spec/defaultBossSpec";
import { createBattleMusicPlayer } from "./createBattleMusicPlayer";

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

describe("FABLE battle music", () => {
  beforeEach(() => {
    FakeAudio.latest = undefined;
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("window", new EventTarget());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts from interaction and follows the combat sections", async () => {
    const interactionTarget = new EventTarget() as HTMLElement;
    const player = createBattleMusicPlayer(FABLE_BOSS_MUSIC_URL, interactionTarget);
    const audio = FakeAudio.latest;
    expect(audio?.src).toBe("");
    expect(audio?.preload).toBe("none");
    expect(audio?.volume).toBe(0.32);

    interactionTarget.dispatchEvent(new Event("pointerdown"));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    expect(audio?.src).toBe(FABLE_BOSS_MUSIC_URL);
    expect(audio?.play).toHaveBeenCalledOnce();

    if (!audio) throw new Error("Missing fake battle music audio.");
    audio.currentTime = 30;
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audio.currentTime).toBe(6);

    player.enterPhaseTwo();
    expect(audio.currentTime).toBe(30);
    audio.currentTime = 58;
    audio.dispatchEvent(new Event("timeupdate"));
    expect(audio.currentTime).toBe(34);

    player.playAftermath();
    expect(audio.currentTime).toBe(58);
    player.reset();
    expect(audio.currentTime).toBe(0);
    expect(audio.play).toHaveBeenCalledTimes(2);
  });

  it("ducks beneath the phase voice and releases audio resources", () => {
    const player = createBattleMusicPlayer(
      FABLE_BOSS_MUSIC_URL,
      new EventTarget() as HTMLElement,
    );
    const audio = FakeAudio.latest;

    player.duckForVoice();
    expect(audio?.volume).toBe(0.11);
    player.restoreAfterVoice();
    expect(audio?.volume).toBe(0.32);

    player.dispose();
    expect(audio?.pause).toHaveBeenCalledOnce();
    expect(audio?.removeAttribute).toHaveBeenCalledWith("src");
  });

  it("keeps non-release music URLs silent", () => {
    const player = createBattleMusicPlayer(
      "/audio/cached-house-track.mp3",
      new EventTarget() as HTMLElement,
    );
    player.enterPhaseTwo();
    expect(FakeAudio.latest).toBeUndefined();
  });
});
