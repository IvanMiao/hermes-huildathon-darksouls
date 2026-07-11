import Phaser from "phaser";
import type { BossSpec } from "../boss-spec/types";
import { BootScene } from "./BootScene";

export function createGame(spec: BossSpec): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 540,
    backgroundColor: spec.boss.palette[0],
    scene: [new BootScene(spec)],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  });
}
