import King, { KING_DISPLAY_H } from "../objects/King.js";
import Bolt from "../objects/Bolt.js";
import Mold from "../objects/Mold.js";
import { touch, DEBUG } from "../main.js";
import { SFX } from "../audio.js";
import { BGM } from "../bgm.js";
import { rankIndex, rankName, rankNameByIndex } from "../rank.js";

// === 速度（一定。スクロール速度はここで決まる）===
const BASE_SPEED = 360;   // 旧300の1.2倍
const MAX_SPEED = 580;
const DIFFICULTY_DIST = 14000;   // この距離で難易度MAX（旧22000。小さいほど難化が早い）
// 穴幅: 難易度で「最小→最大」まで成長。最大は1ジャンプの到達距離(speed×AIRTIME)の何割までかで決まる。
// AIRTIME≒実際の滞空(≈1.0s)なので、係数を1未満にしておけば「どんなに大きくても飛べる範囲」に収まる。
const PIT_MIN_W = 170;           // 穴の最小幅(px)
const PIT_MAX_FACTOR = 0.66;     // 到達距離に対する穴幅の最大割合（安全マージン込み。大きいほど穴が広い）
// 弾とカビの当たりは高さの重なりで判定。カビ中心が弾より HIT_TOP_MARGIN px 超えて上なら当たらない。
// （浮遊カビが下りてきて弾の高さに重なれば命中。高い位置のままなら要ジャンプ撃ち）
const HIT_TOP_MARGIN = 40;
const KING_X = 260;
const GROUND_TOP = 627;
const GROUND_MOLD_Y = 587;       // 地上カビ中心
const AIR_MOLD_Y = 477;          // 空中カビ中心
const BOLT_Y = 533;              // 弾の発射高さ
const ITEM_Y = 440;              // スプレーボトル（ジャンプで取る）
const STAR_DUR = 5000;           // 無敵時間(ms)
const AIRTIME = 1.0;             // おおよそのジャンプ滞空(s)。穴幅上限の算出に使用

// === 洗剤ゲージ（スプレー連射制限・すべて調整用変数）===
const DETERGENT_MAX = 100;       // ゲージ最大量
const DETERGENT_COST = 34;       // スプレー1発の消費量（≒3発で空）
const DETERGENT_REGEN = 24;      // 1秒あたりの回復量（撃たずにいると徐々に回復）

// === カビの動きパターン出現率（重み。difficulty 0→1 で min→max を線形補間）===
// 進むほど複雑なパターン(flyer/jumper/roller)の比率が上がるよう ground を減らす
const MOLD_PATTERNS = {
  ground:  { min: 0.70, max: 0.30 },  // 通常地上（既存）
  flyer:   { min: 0.18, max: 0.22 },  // 飛行（ふわふわ上下）
  jumper:  { min: 0.06, max: 0.20 },  // たまに飛びかかる（dist>2500で解禁）
  roller:  { min: 0.06, max: 0.20 },  // 高速で転がる（dist>3500で解禁）
  dropper: { min: 0.06, max: 0.20 },  // 上から落ちてくる（dist>3000で解禁）
};

const HISCORE_KEY = "kabi_hiscore_dist";
const RANK_BEST_KEY = "kabi_best_rank";   // 最高到達称号インデックス

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
    this.detergent = DETERGENT_MAX;   // 洗剤ゲージ残量
    this.rankIdx = 0;                 // 現在の称号インデックス

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

  // 難易度0→1。DIFFICULTY_DIST の距離で最大に到達（小さいほど難化が早い）
  difficulty() { return Phaser.Math.Clamp(this.dist / DIFFICULTY_DIST, 0, 1); }

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
        // 穴幅: 難易度で PIT_MIN_W → 最大まで成長。最大は1ジャンプ到達距離の PIT_MAX_FACTOR 倍で頭打ち
        const maxJump = this.speed * AIRTIME * PIT_MAX_FACTOR;
        const w = Math.min(Phaser.Math.Linear(PIT_MIN_W, maxJump, f), maxJump);
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
    // 塗りは枠線なし。隣接セグメント間に縦の継ぎ目（チラつき）が出ないようにする。
    // 物理ボディは持たせず、背景と同じ delta 方式で手動スクロールする（カクつき防止）。
    // 当たり判定(穴判定)は groundUnderKing が g.x/g.width で行うのでボディ不要。
    const seg = this.add.rectangle(x0, GROUND_TOP, w, height - GROUND_TOP, 0x55557a)
      .setOrigin(0, 0).setDepth(3);
    // 上辺ハイライト（全幅・横線のみ）。縦の継ぎ目を作らず、穴のフチだけ目立たせる
    seg.top = this.add.rectangle(x0, GROUND_TOP, w, 4, 0x8a8ab0, 0.85)
      .setOrigin(0, 0).setDepth(4);
    this.groundGroup.add(seg);
  }

  // ---------------- 出現 ----------------
  // difficulty に応じた重みでカビの動きパターンを選ぶ
  pickBehavior() {
    const f = this.difficulty();
    const L = (p) => Phaser.Math.Linear(p.min, p.max, f);
    const w = {
      ground: L(MOLD_PATTERNS.ground),
      flyer: L(MOLD_PATTERNS.flyer),
      jumper: this.dist > 2500 ? L(MOLD_PATTERNS.jumper) : 0,
      roller: this.dist > 3500 ? L(MOLD_PATTERNS.roller) : 0,
      dropper: this.dist > 3000 ? L(MOLD_PATTERNS.dropper) : 0,
    };
    const keys = ["ground", "flyer", "jumper", "roller", "dropper"];
    let total = keys.reduce((s, k) => s + w[k], 0);
    let r = Math.random() * total;
    for (const key of keys) {
      if ((r -= w[key]) < 0) return key;
    }
    return "ground";
  }

  spawnMold() {
    const f = this.difficulty();
    const behavior = this.pickBehavior();
    // 動きパターンで初期高さを決める（飛行=空中、それ以外=地上）
    let y = behavior === "flyer" ? AIR_MOLD_Y : GROUND_MOLD_Y;

    // 硬さ/大型/ボスは地上・飛行の通常パターンにのみ付与（jumper/rollerは素早い1耐久）
    let kind = "normal", hp = null;
    if (behavior === "ground" || behavior === "flyer") {
      const r = Math.random();
      if (f > 0.6 && r < 0.06) { kind = "boss"; y = AIR_MOLD_Y - 14; }
      else if (this.dist > 4000 && r < 0.16) kind = "big";
      else if (this.dist > 2500 && r < 0.16 + f * 0.45) hp = Phaser.Math.Between(2, 3);
    }
    this.addMold(this.scale.width + 100, y, kind, hp, behavior);
  }

  addMold(x, y, kind, hp, behavior) {
    const m = new Mold(this, x, y, kind, this.speed, hp, behavior);
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
  // 撃てるか: 無敵中は消費なしで撃ち放題。通常は洗剤が1発分あること
  canSpray(time) {
    return this.king.isInvincible(time) || this.detergent >= DETERGENT_COST;
  }

  fireBolt(king) {
    const bolt = this.bolts.get();
    if (!bolt) return;
    // 無敵中は消費なし。通常はゲージを消費
    if (!king.isInvincible(this.time.now)) {
      this.detergent = Math.max(0, this.detergent - DETERGENT_COST);
    }
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
    // 高さの重なりで判定: カビ中心が弾よりかなり上にある時だけ当たらない。
    // 浮遊カビが下りてきて弾の高さに重なれば命中、ジャンプして撃てば高い位置にも当たる。
    // ただしボス(一番大きいピンクの浮遊カビ)は高さに関係なく常に当たる。
    if (mold.kind !== "boss" && mold.y < bolt.y - HIT_TOP_MARGIN) return;
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

    // 最高到達称号を記録（今回が更新ならtrue）
    const curRank = rankIndex(this.score);
    const prevBestRank = parseInt(localStorage.getItem(RANK_BEST_KEY) || "0", 10) || 0;
    const bestRank = Math.max(prevBestRank, curRank);
    localStorage.setItem(RANK_BEST_KEY, String(bestRank));

    this.time.delayedCall(1000, () =>
      this.scene.start("Result", {
        dist: meters, score: this.score, hi: newHi, best: meters >= this.hiscore,
        rank: curRank, bestRank, newRank: curRank > prevBestRank,
      }));
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
    // 現在の称号（右上・スコアの下に小さく）
    this.rankText = this.add.text(width - 18, 88, "", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#ffe27a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 3,
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

    // --- マジックポイント（左上・MENUの下）---
    const gx = 18, gy = 82, gw = 220, gh = 22;
    // アイコンは無敵アイテム（スプレー杖）の画像を流用
    this.add.image(gx + 9, gy - 12, "spray_item").setOrigin(0.5)
      .setScale(26 / this.textures.get("spray_item").getSourceImage().height)
      .setScrollFactor(0).setDepth(31);
    this.add.text(gx + 22, gy - 27, "マジックポイント", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#dff3ff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 3,
    }).setScrollFactor(0).setDepth(31);
    this.add.rectangle(gx, gy, gw, gh, 0x000000, 0.5).setOrigin(0, 0)
      .setScrollFactor(0).setDepth(30).setStrokeStyle(2, 0xffffff, 0.7);
    this.gaugeMaxW = gw - 6;
    this.gaugeFill = this.add.rectangle(gx + 3, gy + 3, this.gaugeMaxW, gh - 6, 0x5ad1ff)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(31);

    this.updateHUD();
  }

  updateHUD() {
    this.distText.setText(`${Math.floor(this.dist / 10)} m`);
    this.scoreText.setText("SCORE " + this.score);
    const rem = this.king.invincibleUntil - this.time.now;
    this.starText.setText(rem > 0 ? `⭐ カビ取りモード ${Math.ceil(rem / 1000)}` : "");

    // 洗剤ゲージ更新（無敵中=金で撃ち放題、残量わずか=赤、通常=水色）
    const ratio = Phaser.Math.Clamp(this.detergent / DETERGENT_MAX, 0, 1);
    this.gaugeFill.width = Math.max(0, this.gaugeMaxW * ratio);
    const low = this.detergent < DETERGENT_COST;   // 1発分未満＝撃てない
    this.gaugeFill.fillColor = rem > 0 ? 0xffe14a : (low ? 0xff5a5a : 0x5ad1ff);

    // 現在の称号表示
    this.rankText.setText("称号: " + rankName(this.score));
  }

  // 昇格演出（画面中央に大きくポップ＋SE）
  promote(idx) {
    SFX.levelup();
    const { width, height } = this.scale;
    const cx = width / 2, cy = height * 0.38;
    const wrap = this.add.container(cx, cy).setDepth(40).setScrollFactor(0);
    const sub = this.add.text(0, -34, "ランクアップ！", {
      fontFamily: "sans-serif", fontSize: "34px", color: "#fff2a8", fontStyle: "bold",
      stroke: "#7a4a00", strokeThickness: 6,
    }).setOrigin(0.5);
    const name = this.add.text(0, 14, rankNameByIndex(idx), {
      fontFamily: "sans-serif", fontSize: "52px", color: "#ffffff", fontStyle: "bold",
      stroke: "#c08000", strokeThickness: 8,
    }).setOrigin(0.5);
    wrap.add([sub, name]);
    // きらめき
    this.add.particles(cx, cy, "dot", {
      speed: { min: 120, max: 380 }, scale: { start: 1.1, end: 0 },
      lifespan: 700, quantity: 28, tint: [0xffe14a, 0xffffff, 0xffc227],
      blendMode: "ADD", emitting: false,
    }).setScrollFactor(0).setDepth(39).explode();
    this.cameras.main.flash(220, 255, 230, 150);
    // ポップ→保持→上へフェード
    wrap.setScale(0.2); wrap.setAlpha(0);
    this.tweens.add({ targets: wrap, scale: 1, alpha: 1, duration: 260, ease: "Back.out" });
    this.tweens.add({
      targets: wrap, y: cy - 70, alpha: 0, delay: 1100, duration: 600,
      onComplete: () => wrap.destroy(),
    });
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

      // スクロール物体の速度を同期。カビは自分の preUpdate で動きパターンを反映するので除外
      const v = -this.speed;
      this.items.getChildren().forEach((s) => { if (s.active) { s.body.velocity.x = v; if (s.glow) s.glow.x = s.x; } });
      // 床は背景と同じ delta で手動移動（物理の固定刻みと混ざらないようにしてカクつきを防ぐ）。
      // 塗りとハイライトを同一フレームで動かすので1フレームのズレも出ない。
      const gd = this.speed * dt;
      this.groundGroup.getChildren().forEach((g) => { if (g.active) { g.x -= gd; if (g.top) g.top.x = g.x; } });

      // 洗剤ゲージ: 無敵中は満タン維持（撃ち放題）、通常は徐々に回復
      if (this.king.isInvincible(time)) this.detergent = DETERGENT_MAX;
      else this.detergent = Math.min(DETERGENT_MAX, this.detergent + DETERGENT_REGEN * dt);

      // 称号アップ判定（スコアがしきい値を越えた瞬間に昇格演出）
      const idx = rankIndex(this.score);
      if (idx > this.rankIdx) { this.rankIdx = idx; this.promote(idx); }

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
    this.groundGroup.getChildren().slice().forEach((g) => { if (g.active && g.x + g.width < -80) { if (g.top) g.top.destroy(); g.destroy(); } });

    this.updateHUD();
  }
}
