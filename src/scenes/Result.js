import { rankNameByIndex } from "../rank.js";
import { SFX } from "../audio.js";

export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  init(data) {
    this.dist = data.dist || 0;
    this.score = data.score || 0;
    this.hi = data.hi || 0;
    this.hiScore = data.hiScore || 0;
    this.best = !!data.best;
    this.rank = data.rank || 0;
    this.bestRank = data.bestRank || 0;
    this.newRank = !!data.newRank;
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.image(width / 2, height / 2, "bg_cathedral");
    bg.setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x401a2a, 0.55);

    this.add.text(width / 2, height * 0.13, "GAME OVER", {
      fontFamily: "sans-serif", fontSize: "72px", fontStyle: "bold",
      color: "#ff8a8a", stroke: "#2a1a50", strokeThickness: 9,
    }).setOrigin(0.5);

    // キング（背面・控えめ）
    this.add.image(width / 2, height * 0.70, "king_tired").setScale(0.5).setAlpha(0.85);

    // 到達距離・スコア
    this.add.text(width / 2, height * 0.24, `${this.dist} m  (BEST ${this.hi}m)`, {
      fontFamily: "sans-serif", fontSize: "36px", color: "#ffffff",
      fontStyle: "bold", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.31, `SCORE  ${this.score}  (BEST ${this.hiScore})`, {
      fontFamily: "sans-serif", fontSize: "30px", color: "#ffe27a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    // ===== 称号パネル（映える装飾つき）=====
    const py = height * 0.47;
    const glow = this.add.image(width / 2, py, "glow").setBlendMode("ADD")
      .setScale(5.2).setTint(0xffe14a).setAlpha(0.9);
    this.tweens.add({ targets: glow, alpha: 0.5, scale: 4.6, duration: 900, yoyo: true, repeat: -1 });
    const panel = this.add.rectangle(width / 2, py, 620, 132, 0x2a1d4a, 0.85)
      .setStrokeStyle(4, 0xffd24a, 0.95);
    this.add.text(width / 2, py - 38, "★  称  号  ★", {
      fontFamily: "sans-serif", fontSize: "20px", color: "#ffd24a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5);
    const rankName = this.add.text(width / 2, py + 14, rankNameByIndex(this.rank), {
      fontFamily: "sans-serif", fontSize: "46px", color: "#ffffff", fontStyle: "bold",
      stroke: "#c08000", strokeThickness: 8,
    }).setOrigin(0.5);
    // 称号名はサイズ固定（拡縮アニメなし）。パネルのみ登場アニメ、名前はフェードインのみ
    panel.setScale(0.6); panel.setAlpha(0);
    rankName.setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 320, ease: "Back.out" });
    this.tweens.add({ targets: rankName, alpha: 1, duration: 320,
      onComplete: () => SFX.levelup && SFX.levelup() });

    // 最高到達称号 / 距離ベスト
    const newBadge = this.newRank ? "  ★最高更新！" : "";
    this.add.text(width / 2, height * 0.60, `BEST: ${rankNameByIndex(this.bestRank)}${newBadge}`, {
      fontFamily: "sans-serif", fontSize: "22px",
      color: this.newRank ? "#ffd24a" : "#cfd6ff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    const retry = this.add.text(width / 2, height * 0.86, "もう一度（タップ / Space）", {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff",
      backgroundColor: "#5b4bd6", padding: { x: 20, y: 12 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: retry, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    const again = () => this.scene.start("Game");
    this.input.keyboard.once("keydown-SPACE", again);
    this.input.keyboard.once("keydown-ENTER", again);
    this.input.once("pointerdown", again);
  }
}
