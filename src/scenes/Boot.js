// 素材ロード
export default class Boot extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1530);
    const txt = this.add.text(width / 2, height / 2, "Loading... 0%", {
      fontSize: "24px", color: "#ffffff",
    }).setOrigin(0.5);
    this.load.on("progress", (p) => txt.setText(`Loading... ${Math.round(p * 100)}%`));

    // キャッシュバスター: 素材更新後に古いPNGが使われ続けないようにする
    const V = "?v=10";

    // 背景
    this.load.image("bg_cathedral", "assets/bg/bg_cathedral.png" + V);
    // キング（静止ポーズ）
    ["idle", "jump", "cast", "tired"].forEach((k) =>
      this.load.image(`king_${k}`, `assets/sprites/king_${k}.png` + V));
    // 歩行アニメ9コマ
    for (let i = 0; i < 9; i++) this.load.image(`king_walk_${i}`, `assets/sprites/king_walk_${i}.png` + V);
    // BGM
    this.load.audio("bgm", "assets/audio/bgm.mp3");
    // カビ
    ["pink", "green", "purple", "yellow", "blue", "boss"].forEach((c) =>
      this.load.image(`mold_${c}`, `assets/sprites/mold_${c}.png` + V));
    // 無敵アイテム（カビ取りスプレー・透過済み素材）
    this.load.image("spray_item", "assets/sprites/item_spray.png" + V);

    // 魔法弾・パーティクル用の小さな光テクスチャを生成
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillCircle(16, 16, 16);
    g.generateTexture("spark", 32, 32);
    g.clear();
    g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 8);
    g.generateTexture("dot", 16, 16);

    // 泡（スプレーの霧/泡パーティクル）: 半透明の縁取り円
    g.clear();
    g.fillStyle(0xffffff, 0.95); g.fillCircle(12, 12, 11);
    g.fillStyle(0xddf4ff, 0.6); g.fillCircle(12, 12, 8);
    g.fillStyle(0xffffff, 0.95); g.fillCircle(8, 8, 3);
    g.generateTexture("bubble", 24, 24);

    // 金色のグロー（無敵オーラ用の柔らかい光）
    g.clear();
    for (let i = 10; i >= 1; i--) {
      g.fillStyle(0xffe14a, 0.06);
      g.fillCircle(64, 64, i * 6.2);
    }
    g.generateTexture("glow", 128, 128);

    g.destroy();
  }

  create() {
    this.scene.start("Title");
  }
}
