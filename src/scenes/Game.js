import King, { KING_DISPLAY_H } from "../objects/King.js";
import Bolt from "../objects/Bolt.js";
import Mold from "../objects/Mold.js";
import { touch, DEBUG } from "../main.js";
import { SFX } from "../audio.js";
import { BGM } from "../bgm.js";

// === 速度（一定。スクロール速度はここで決まる）===
const BASE_SPEED = 360;   // 旧300の1.2倍
const MAX_SPEED = 580;
const KING_X = 260;
const GROUND_TOP = 627;
const GROUND_MOLD_Y = 587;       // 地上カビ中心
const AIR_MOLD_Y = 477;          // 空中カビ中心
const BOLT_Y = 533;              // 弾の発射高さ
const ITEM_Y = 440;              // スプレーボトル（ジャンプで取る）
const STAR_DUR = 8000;           // 無敵時間(ms)
const AIRTIME = 1.0;             // おおよそのジャンプ滞空(s)。穴幅上限の算出に使用

const HISCORE_KEY = "kabi_hiscore_dist";

export default class Game extends Phaser.Scene {
  constructor() { super("Game"); }

  create() {
    const { width, height } = this.scale;
    this.score = 0;
    this.dist = 0;
    this.speed = BASE_SPEED;
    this.ended = false;
    this.nextSpawnDist = 700;
    this.nextItemDist = 1800;
    this.aura = null;

    // --- 背景 ---
    this.bg = this.add.tileSprite(0, 0, width, height, "bg_cathedral")
      .setOrigin(0, 0).setScrollFactor(0).setDepth(0);
    this.bgScale = height / 1536;
    this.bg.tileScaleX = this.bgScale;
    this.bg.tileScaleY = this.bgScale;
    this.add.rectangle(0, 0, width, height, 0x1a1540, 0.18).setOrigin(0, 0).setDepth(1);

    // --- 奈落（穴）---
    this.add.rectangle(0, GROUND_TOP, width, height - GROUND_TOP, 0x070512, 1)
      .setOrigin(0, 0).setDepth(2);

    // --- 地面（スクロールするセグメント。隙間=穴）---
    this.groundGroup = this.add.group();
    this.spawnEdge = 0;
    this.sinceLastPit = 99999;
    this.fillGround();

    // --- プレイヤー（垂直は手動制御。地面の有無は groundUnder で判定）---
    this.king = new King(this, KING_X, GROUND_TOP);
    this.king.setDepth(8);

    // --- グループ ---
    this.bolts = this.add.group({ classType: Bolt, maxSize: 24, runChildUpdate: true });
    this.molds = this.add.group();
    this.items = this.add.group();

    // --- 当たり判定 ---
    this.physics.add.overlap(this.bolts, this.molds, this.onBoltHit, null, this);
    this.physics.add.overlap(this.king, this.molds, this.onKingHit, null, this);
    this.physics.add.overlap(this.king, this.items, this.onItem, null, this);

    // --- 入力 ---
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = this.input.keyboard.addKeys({ up: K.UP, space: K.SPACE, w: K.W, x: K.X, z: K.Z, esc: K.ESC });

    this.hiscore = parseInt(localStorage.getItem(HISCORE_KEY) || "0", 10) || 0;
    BGM.init(this); BGM.play();   // タイトルから継続（再生中なら二重再生しない）
    this.createHUD();
  }

  difficulty() { return Phaser.Math.Clamp(this.dist / 22000, 0, 1); }

  goTitle() {
    this.destroyAura();
    this.scene.start("Title");
  }

  // キングの足元に地面セグメントがあるか（穴判定）
  groundUnderKing() {
    const x = this.king.x;
    const segs = this.groundGroup.getChildren();
    for (let i = 0; i < segs.length; i++) {
      const g = segs[i];
      if (g.active && x >= g.x && x <= g.x + g.width) return true;
    }
    return false;
  }

  // ---------------- 地面ストリーム ----------------
  fillGround() {
    const width = this.scale.width;
    const f = this.difficulty();
    while (this.spawnEdge < width + 400) {
      const eligible = this.dist > 2800 && this.sinceLastPit > 1900;
      const pitChance = Phaser.Math.Linear(0.3, 0.65, f);
      if (eligible && Math.random() < pitChance) {
        // 穴幅: 難易度で広げるが「現在速度で1ジャンプ越え可能」を上限に
        const maxJump = this.speed * AIRTIME * 0.58;
        const w = Math.min(Phaser.Math.Linear(190, 320, f), maxJump);
        this.spawnEdge += w;
        this.sinceLastPit = 0;
      } else {
        const segW = Phaser.Math.Between(360, 660);
        this.createGroundPiece(this.spawnEdge, segW);
        this.spawnEdge += segW;
        this.sinceLastPit += segW;
      }
    }
  }

  createGroundPiece(x0, w) {
    const { height } = this.scale;
    const seg = this.add.rectangle(x0, GROUND_TOP, w, height - GROUND_TOP, 0x55557a)
      .setOrigin(0, 0).setDepth(3);
    seg.setStrokeStyle(2, 0x8a8ab0, 0.8);
    this.physics.add.existing(seg);
    seg.body.setAllowGravity(false);
    seg.body.setImmovable(true);
    seg.body.setVelocityX(-this.speed);
    this.groundGroup.add(seg);
  }

  // ---------------- 出現 ----------------
  spawnMold() {
    const f = this.difficulty();
    const air = Math.random() < 0.42;
    const y = air ? AIR_MOLD_Y : GROUND_MOLD_Y;
    let kind = "normal", hp = null;
    const r = Math.random();
    if (f > 0.6 && r < 0.06) kind = "boss";
    else if (this.dist > 4000 && r < 0.16) kind = "big";
    else if (this.dist > 2500 && r < 0.16 + f * 0.45) hp = Phaser.Math.Between(2, 3);
    this.addMold(this.scale.width + 100, kind === "boss" ? AIR_MOLD_Y - 14 : y, kind, hp);
  }

  addMold(x, y, kind, hp) {
    const m = new Mold(this, x, y, kind, this.speed, hp);
    this.molds.add(m);
    m.setDepth(kind === "boss" ? 9 : 7);
    return m;
  }

  spawnItem() {
    const it = this.physics.add.image(this.scale.width + 90, ITEM_Y, "spray_item");
    it.body.setAllowGravity(false);
    it.body.setVelocityX(-this.speed);
    it.body.setCircle(26, 6, 6);
    it.setDepth(7).setScale(0.66);
    this.tweens.add({ targets: it, y: ITEM_Y - 16, duration: 700, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    this.tweens.add({ targets: it, scale: 0.75, duration: 500, yoyo: true, repeat: -1 });
    // 光って目立たせる
    const glow = this.add.image(it.x, it.y, "glow").setBlendMode("ADD").setDepth(6).setScale(1.1).setTint(0x9fe8ff);
    it.glow = glow;
    this.items.add(it);
  }

  // ---------------- 魔法（スプレー）----------------
  fireBolt(king) {
    const bolt = this.bolts.get();
    if (!bolt) return;
    const m = king.muzzle();          // キング実座標から発射（ジャンプ/落下中も体から出る）
    bolt.setPosition(m.x, m.y);
    bolt.fire();
    // 噴射: 前方に霧/泡を勢いよく
    this.add.particles(m.x - 10, m.y, "bubble", {
      angle: { min: -26, max: 26 },
      speed: { min: 180, max: 460 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.95, end: 0 },
      lifespan: 300, quantity: 16,
      tint: [0xffffff, 0xd6f3ff, 0xb8ecff],
      emitting: false,
    }).explode();
  }

  onBoltHit(bolt, mold) {
    if (!bolt.active || !mold.active) return;
    if (DEBUG) console.log("[HIT] bolt->mold", mold.kind, "hp", mold.hp);
    bolt.kill();
    SFX.hit();
    // はじける泡
    this.add.particles(mold.x, mold.y, "bubble", {
      speed: { min: 60, max: 200 }, scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 }, lifespan: 300, quantity: 8,
      tint: [0xffffff, 0xd6f3ff], emitting: false,
    }).explode();
    if (mold.damage(1)) this.popMold(mold);
  }

  popMold(mold) {
    this.score += mold.score;
    SFX.pop();
    const tint = mold.kind === "boss" ? [0xff7ab0, 0xffffff]
      : [0xff9ed1, 0xa8f0c0, 0xc9a8ff, 0xfff0a0, 0x9fd8ff];
    this.add.particles(mold.x, mold.y, "dot", {
      speed: { min: 80, max: 300 }, scale: { start: 1.2, end: 0 },
      lifespan: 450, quantity: mold.kind === "boss" ? 44 : 18,
      tint, blendMode: "ADD", emitting: false,
    }).explode();
    const txt = this.add.text(mold.x, mold.y, `+${mold.score}`, {
      fontSize: "26px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: txt, y: txt.y - 50, alpha: 0, duration: 700, onComplete: () => txt.destroy() });
    mold.destroy();
  }

  onKingHit(king, mold) {
    if (this.ended || !mold.active) return;
    if (king.isInvincible(this.time.now)) { this.popMold(mold); return; }
    // 一撃即死
    king.dead = true;
    king.setStaticTex("king_tired");
    this.cameras.main.shake(220, 0.016);
    this.cameras.main.flash(150, 150, 30, 30);
    this.endGame("hp");
  }

  onItem(king, it) {
    if (this.ended) return;
    if (it.glow) it.glow.destroy();
    it.destroy();
    king.makeInvincible(this.time.now, STAR_DUR);
    SFX.star();
    this.cameras.main.flash(180, 255, 220, 120);
  }

  // ---------------- 無敵オーラ ----------------
  makeAura() {
    const glow = this.add.image(this.king.x, this.king.y - KING_DISPLAY_H * 0.5, "glow")
      .setBlendMode("ADD").setDepth(7).setScale(2.4).setTint(0xffe14a);
    const sparkle = this.add.particles(0, 0, "dot", {
      follow: this.king, followOffset: { x: 0, y: -KING_DISPLAY_H * 0.5 },
      speed: { min: 40, max: 150 }, scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 }, lifespan: 520, frequency: 35, quantity: 2,
      emitZone: { type: "random", source: new Phaser.Geom.Circle(0, 0, KING_DISPLAY_H * 0.45) },
      tint: [0xffe14a, 0xffffff, 0xffc227], blendMode: "ADD",
    }).setDepth(9);
    return { glow, sparkle };
  }
  destroyAura() {
    if (!this.aura) return;
    this.aura.glow.destroy();
    this.aura.sparkle.destroy();
    this.aura = null;
  }

  // ---------------- 終了 ----------------
  endGame(cause) {
    this.ended = true;
    this.destroyAura();
    this.king.setStaticTex("king_tired");
    if (cause === "pit") SFX.fall();
    else { this.king.setVelocity(0, 0); SFX.lose(); }

    const meters = Math.floor(this.dist / 10);
    const newHi = Math.max(this.hiscore, meters);
    localStorage.setItem(HISCORE_KEY, String(newHi));

    this.time.delayedCall(1000, () =>
      this.scene.start("Result", { dist: meters, score: this.score, hi: newHi, best: meters >= this.hiscore }));
  }

  // ---------------- HUD ----------------
  createHUD() {
    const { width } = this.scale;
    // メニュー(タイトルへ戻る)。PCクリック/スマホタップ両対応
    const menu = this.add.text(18, 14, "≡ MENU", {
      fontFamily: "sans-serif", fontSize: "22px", color: "#ffffff",
      backgroundColor: "#00000066", padding: { x: 12, y: 7 },
    }).setScrollFactor(0).setDepth(31).setInteractive({ useHandCursor: true });
    menu.on("pointerdown", () => this.goTitle());

    this.distText = this.add.text(width / 2, 16, "0 m", {
      fontFamily: "sans-serif", fontSize: "34px", color: "#ffffff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
    this.scoreText = this.add.text(width - 18, 56, "SCORE 0", {
      fontSize: "26px", color: "#ffffff", fontStyle: "bold", stroke: "#000", strokeThickness: 3,
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);

    // ミュートボタン（右上）
    this.muteBtn = this.add.text(width - 18, 14, BGM.isMuted() ? "🔇" : "🔊", {
      fontSize: "28px", backgroundColor: "#00000055", padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(31).setInteractive({ useHandCursor: true });
    const toggleMute = () => { BGM.toggleMute(); this.muteBtn.setText(BGM.isMuted() ? "🔇" : "🔊"); };
    this.muteBtn.on("pointerdown", toggleMute);
    this.input.keyboard.on("keydown-M", toggleMute);
    this.starText = this.add.text(width / 2, 58, "", {
      fontSize: "22px", color: "#ffe14a", fontStyle: "bold", stroke: "#5a3a10", strokeThickness: 4,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);
    this.updateHUD();
  }

  updateHUD() {
    this.distText.setText(`${Math.floor(this.dist / 10)} m`);
    this.scoreText.setText("SCORE " + this.score);
    const rem = this.king.invincibleUntil - this.time.now;
    this.starText.setText(rem > 0 ? `🧴 無敵 ${Math.ceil(rem / 1000)}` : "");
  }

  // ---------------- ループ ----------------
  update(time, delta) {
    const dt = delta / 1000;

    // ESCでタイトルへ（プレイ途中でも即時。状態はcreateで再初期化される）
    if (Phaser.Input.Keyboard.JustDown(this.keys.esc)) { this.goTitle(); return; }

    if (!this.ended) {
      const k = this.keys;
      const JD = Phaser.Input.Keyboard.JustDown;
      const tJump = touch.jumpEdge; touch.jumpEdge = false;
      const tFire = touch.fireEdge; touch.fireEdge = false;
      this.king.handle({
        fire: k.x.isDown || k.z.isDown || touch.fire,
        jumpJust: JD(k.up) || JD(k.space) || JD(k.w) || tJump,
        fireJust: JD(k.x) || JD(k.z) || tFire,
      }, time, dt, this.groundUnderKing());

      // スクロール速度は一定（距離による上昇なし）
      this.speed = BASE_SPEED;
      this.dist += this.speed * dt;
      this.bg.tilePositionX += (this.speed * dt) / this.bgScale;

      // 全スクロール物体の速度を現在速度に同期（バラつき防止）
      const v = -this.speed;
      this.molds.getChildren().forEach((m) => { if (m.active) m.body.velocity.x = v; });
      this.items.getChildren().forEach((s) => { if (s.active) { s.body.velocity.x = v; if (s.glow) s.glow.x = s.x; } });
      this.groundGroup.getChildren().forEach((g) => { if (g.active) g.body.velocity.x = v; });

      // 地面補充
      this.spawnEdge -= this.speed * dt;
      this.fillGround();

      // カビ出現（密度を難易度で上げる）
      if (this.dist >= this.nextSpawnDist) {
        this.spawnMold();
        const f = this.difficulty();
        this.nextSpawnDist += Phaser.Math.Between(
          Math.round(Phaser.Math.Linear(780, 440, f)),
          Math.round(Phaser.Math.Linear(1120, 640, f)));
      }

      // アイテム出現
      if (this.dist >= this.nextItemDist) {
        this.spawnItem();
        this.nextItemDist += Phaser.Math.Between(3000, 4200);
      }

      // 無敵オーラの生成/破棄
      const inv = this.king.isInvincible(time);
      if (inv && !this.aura) this.aura = this.makeAura();
      if (!inv && this.aura) this.destroyAura();
      if (this.aura) this.aura.glow.setPosition(this.king.x, this.king.y - KING_DISPLAY_H * 0.5);

      // 穴落下 → 即ゲームオーバー（無敵を貫通）
      if (!this.king.dead && this.king.y > GROUND_TOP + 90) {
        this.king.dead = true;
        this.endGame("pit");
      }
    }

    // 画面外破棄（コピー走査）
    this.molds.getChildren().slice().forEach((m) => { if (m.active && m.x < -180) m.destroy(); });
    this.items.getChildren().slice().forEach((s) => { if (s.active && s.x < -140) { if (s.glow) s.glow.destroy(); s.destroy(); } });
    this.groundGroup.getChildren().slice().forEach((g) => { if (g.active && g.x + g.width < -80) g.destroy(); });

    this.updateHUD();
  }
}
