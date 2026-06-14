export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  init(data) {
    this.dist = data.dist || 0;
    this.score = data.score || 0;
    this.hi = data.hi || 0;
    this.best = !!data.best;
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.image(width / 2, height / 2, "bg_cathedral");
    bg.setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x401a2a, 0.55);

    this.add.text(width / 2, height * 0.18, "GAME OVER", {
      fontFamily: "sans-serif", fontSize: "78px", fontStyle: "bold",
      color: "#ff8a8a", stroke: "#2a1a50", strokeThickness: 9,
    }).setOrigin(0.5);

    const king = this.add.image(width / 2, height * 0.6, "king_tired").setScale(0.85);

    // 到達距離（メイン）
    this.add.text(width / 2, height * 0.34, `到達距離  ${this.dist} m`, {
      fontFamily: "sans-serif", fontSize: "40px", color: "#ffffff",
      fontStyle: "bold", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.43, `SCORE  ${this.score}`, {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffe27a",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    // ハイスコア
    const hiTxt = this.best ? `★ NEW BEST  ${this.hi} m ★` : `BEST  ${this.hi} m`;
    const hi = this.add.text(width / 2, height * 0.50, hiTxt, {
      fontFamily: "sans-serif", fontSize: "24px",
      color: this.best ? "#ffd24a" : "#cfd6ff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);
    if (this.best) this.tweens.add({ targets: hi, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });

    const retry = this.add.text(width / 2, height * 0.86, "▶ もう一度（タップ / Space）", {
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
