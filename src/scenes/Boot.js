// 素材ロード
export default class Boot extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    const { width, height } = this.scale;
    const cx = width / 2, cy = height / 2;

    // --- ローディング画面（進捗バー＋％。止まって見えないように）---
    this.add.rectangle(cx, cy, width, height, 0x1a1530);
    this.add.text(cx, cy - 70, "カビ取りキング", {
      fontFamily: "sans-serif", fontSize: "40px", fontStyle: "bold",
      color: "#ffffff", stroke: "#3a2a80", strokeThickness: 7,
    }).setOrigin(0.5);
    const barW = Math.min(440, width * 0.6), barH = 26;
    const barX = cx - barW / 2, barY = cy + 6;
    this.add.rectangle(barX, barY, barW, barH, 0x000000, 0.45)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff, 0.6);
    const fill = this.add.rectangle(barX + 3, barY, 1, barH - 6, 0x5ad1ff)
      .setOrigin(0, 0.5);
    const fillMaxW = barW - 6;
    const txt = this.add.text(cx, cy + 44, "Loading... 0%", {
      fontFamily: "sans-serif", fontSize: "20px", color: "#dff3ff",
    }).setOrigin(0.5);
    this.load.on("progress", (p) => {
      fill.width = Math.max(1, fillMaxW * p);
      txt.setText(`Loading... ${Math.round(p * 100)}%`);
    });

    // キャッシュバスター: 素材更新後に古い画像が使われ続けないようにする
    const V = "?v=11";

    // 背景（WebP化・縮小済み）
    this.load.image("bg_cathedral", "assets/bg/bg_cathedral.webp" + V);
    // キング（静止ポーズ）
    ["idle", "jump", "cast", "tired"].forEach((k) =>
      this.load.image(`king_${k}`, `assets/sprites/king_${k}.webp` + V));
    // 歩行アニメ9コマ
    for (let i = 0; i < 9; i++) this.load.image(`king_walk_${i}`, `assets/sprites/king_walk_${i}.webp` + V);
    // BGM はサイズが大きいのでここでは読まない（Title到達後に遅延ロード＝ローディングを速くする）
    // カビ
    ["pink", "green", "purple", "yellow", "blue", "boss"].forEach((c) =>
      this.load.image(`mold_${c}`, `assets/sprites/mold_${c}.webp` + V));
    // 無敵アイテム（カビ取りスプレー・透過済み素材）
    this.load.image("spray_item", "assets/sprites/item_spray.webp" + V);

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
