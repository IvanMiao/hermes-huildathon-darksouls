import { describe, expect, it } from "vitest";
import { resolveBattleVisualProfile } from "./resolveBattleVisualProfile";

function recipe(runId: string, bossName: string) {
  return { runId, boss: { boss: { name: bossName } } };
}

describe("battle visual profile", () => {
  it("keeps every FABLE recipe on the polished fixed presentation", () => {
    expect(resolveBattleVisualProfile(recipe("default-i-smell-fear", "FABLE")))
      .toEqual({ family: "fable" });
    expect(resolveBattleVisualProfile(recipe("another-fable-route", " fable ")))
      .toEqual({ family: "fable" });
  });

  it("assigns replay-stable visual choices without changing a generated boss name", () => {
    const generated = recipe("20260711t143940z-b0dd03e6", "VESPER");
    const first = resolveBattleVisualProfile(generated);

    expect(first.family).toBe("generated");
    expect(resolveBattleVisualProfile(generated)).toEqual(first);
    expect(generated.boss.boss.name).toBe("VESPER");
  });

  it("varies scene, player, and enemy silhouettes across generated runs", () => {
    const profiles = Array.from({ length: 256 }, (_, index) => (
      resolveBattleVisualProfile(recipe(`generated-run-${index}`, `BOSS-${index}`))
    )).filter((profile) => profile.family === "generated");

    expect(new Set(profiles.map(({ arena }) => arena)).size).toBeGreaterThan(1);
    expect(new Set(profiles.map(({ player }) => player)).size).toBeGreaterThan(1);
    expect(new Set(profiles.map(({ boss }) => boss)).size).toBeGreaterThan(1);
    expect(new Set(profiles.map(({ arena, player, boss }) => (
      `${arena}/${player}/${boss}`
    ))).size).toBe(8);
  });
});
