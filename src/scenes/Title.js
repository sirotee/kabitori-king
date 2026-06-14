import { SFX } from "../audio.js";
import { BGM } from "../bgm.js";

export default class Title extends Phaser.Scene {
  constructor() { super("Title"); }

  create() {
    const { width, height } = this.scale;
    BGM.ensureLoaded(this);   // タイトル表示中に裏でBGMを読み込む（初回操作までに間に合う）

    const bg = this.add.image(width / 2, height / 2, "bg_cathedral");
    bg.setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1540, 0.35);

    const king = this.add.image(width / 2, height * 0.6, "king_cast").setScale(0.95);
    this.tweens.add({ targets: king, y: king.y - 16, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    this.add.text(width / 2, height * 0.16, "カビ取りキング", {
      fontFamily: "sans-serif", fontSize: "62px", fontStyle: "bold",
      color: "#ffffff", stroke: "#3a2a80", strokeThickness: 9,
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.28, "～ 魔法の大聖堂 ～", {
      fontFamily: "sans-serif", fontSize: "30px", color: "#ffe27a",
      stroke: "#5a3a20", strokeThickness: 5,
    }).setOrigin(0.5);

    // 操作説明はPC(キーボード)のみ表示。スマホ(タッチ)では非表示
    if (!document.body.classList.contains("touch")) {
      this.add.text(width / 2, height * 0.76, "JUMP: ↑     Magic: Space", {
        fontFamily: "sans-serif", fontSize: "20px", color: "#dfe4ff",
        stroke: "#2a1a50", strokeThickness: 3,
      }).setOrigin(0.5);
    }

    const start = this.add.text(width / 2, height * 0.88, "Tap / Space", {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff",
      backgroundColor: "#5b4bd6", padding: { x: 20, y: 12 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    const startGame = () => { SFX.unlock(); BGM.play(); this.scene.start("Game"); };
    this.input.keyboard.once("keydown-SPACE", startGame);
    this.input.keyboard.once("keydown-ENTER", startGame);
    this.input.keyboard.on("keydown-M", () => BGM.toggleMute());   // ミュートは画面ボタン廃止・Mキーのみ
    // タップでスタート
    this.input.on("pointerdown", startGame);
  }
}
