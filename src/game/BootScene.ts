import Phaser from "phaser";
import type { BossSpec } from "../boss-spec/types";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

export class BootScene extends Phaser.Scene {
  constructor(private readonly spec: BossSpec) {
    super("boot");
  }

  create(): void {
    const [shadow, ember, ivory] = this.spec.boss.palette;
    const graphics = this.add.graphics();

    graphics.fillStyle(Phaser.Display.Color.HexStringToColor(shadow).color, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawArena(graphics, ember, ivory);
    this.drawPlayer(graphics);
    this.drawBoss(graphics, ember, ivory);
    this.drawInterface(ember, ivory);
  }

  private drawArena(
    graphics: Phaser.GameObjects.Graphics,
    ember: string,
    ivory: string,
  ): void {
    const fog = Phaser.Display.Color.HexStringToColor(this.spec.arena.fog).color;
    const emberColor = Phaser.Display.Color.HexStringToColor(ember).color;
    const ivoryColor = Phaser.Display.Color.HexStringToColor(ivory).color;

    graphics.fillStyle(fog, 0.22);
    graphics.fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT - 65, 820, 250);
    graphics.lineStyle(1, ivoryColor, 0.08);

    for (let x = 100; x < GAME_WIDTH; x += 95) {
      graphics.lineBetween(GAME_WIDTH / 2, 180, x, GAME_HEIGHT - 46);
    }

    for (let y = 292; y < GAME_HEIGHT - 35; y += 54) {
      graphics.strokeEllipse(GAME_WIDTH / 2, 330, 780 - y, (y - 230) * 1.45);
    }

    graphics.lineStyle(2, emberColor, 0.34);
    graphics.strokeEllipse(GAME_WIDTH / 2, 350, 650, 230);
    graphics.lineStyle(1, emberColor, 0.16);
    graphics.strokeEllipse(GAME_WIDTH / 2, 350, 710, 270);
  }

  private drawPlayer(graphics: Phaser.GameObjects.Graphics): void {
    const playerColor = 0x78dce8;
    const x = 480;
    const y = 430;

    graphics.lineStyle(2, playerColor, 0.25);
    graphics.strokeCircle(x, y, 24);
    graphics.fillStyle(playerColor, 1);
    graphics.fillTriangle(x, y - 14, x + 11, y + 11, x - 11, y + 11);

    this.add
      .text(x, y + 32, "YOU", {
        color: "#a9f3fa",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: "12px",
        letterSpacing: 3,
      })
      .setOrigin(0.5, 0);
  }

  private drawBoss(
    graphics: Phaser.GameObjects.Graphics,
    ember: string,
    ivory: string,
  ): void {
    const emberColor = Phaser.Display.Color.HexStringToColor(ember).color;
    const ivoryColor = Phaser.Display.Color.HexStringToColor(ivory).color;
    const x = 480;
    const y = 275;

    graphics.lineStyle(3, emberColor, 0.3);
    graphics.strokeCircle(x, y - 30, 68);
    graphics.lineStyle(1, ivoryColor, 0.3);
    graphics.strokeCircle(x, y - 30, 55);
    graphics.fillStyle(0x09070d, 1);
    graphics.fillTriangle(x, y - 92, x + 49, y + 55, x - 49, y + 55);
    graphics.fillStyle(ivoryColor, 1);
    graphics.fillTriangle(x, y - 71, x + 17, y - 31, x - 17, y - 31);
    graphics.fillStyle(emberColor, 1);
    graphics.fillRect(x - 17, y - 22, 34, 3);
  }

  private drawInterface(ember: string, ivory: string): void {
    const titleStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: ivory,
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: "28px",
      fontStyle: "bold",
      letterSpacing: 5,
      align: "center",
    };
    const monoStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      color: "#b9b0bf",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: "12px",
      letterSpacing: 2,
      align: "center",
    };

    this.add.text(480, 34, this.spec.title, titleStyle).setOrigin(0.5, 0);
    this.add
      .text(
        480,
        78,
        `${this.spec.boss.name}, ${this.spec.boss.title}`,
        { ...monoStyle, color: ember, fontSize: "14px" },
      )
      .setOrigin(0.5, 0);

    this.add
      .text(480, 116, this.spec.boss.lines.intro, {
        ...titleStyle,
        color: "#d6ced8",
        fontSize: "17px",
        fontStyle: "italic",
        letterSpacing: 1,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(480, 500, "WASD / ARROWS  MOVE    SPACE  DODGE    J  STRIKE", monoStyle)
      .setOrigin(0.5, 0);
    this.add
      .text(24, 510, "BOOT SMOKE · COMBAT OFFLINE", {
        ...monoStyle,
        color: "#77707d",
        fontSize: "10px",
      })
      .setOrigin(0, 0.5);
  }
}
