// カビ（敵）。基準速度で左へ流れつつ、behavior ごとに動きが変わる。
// 物理ボディは重力OFF・速度のみで動かし、見た目と当たり判定がズレないようにする。
const COLORS = ["pink", "green", "purple", "yellow", "blue"];

// === 動きパターンのパラメータ（調整しやすいよう集約）===
const MOVE = {
  flyer:   { bobAmp: 60, bobHz: 0.8 },                                  // 飛行: 上下振幅(px)・周期(Hz)
  jumper:  { strength: 760, gravity: 1900, intervalMin: 800, intervalMax: 1500 }, // 飛びかかり: 初速・重力・間隔(ms)
  roller:  { extraSpeed: 260, spin: 12 },                              // 転がり: スクロールへの加算速度・回転(rad/s)
  dropper: { gravity: 1500, startY: 80 },                             // 落下: 重力・出現する高さ(px)
};

export default class Mold extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {number} speed     基準スクロール速度(px/s)。全カビ共通で渡す。
   * @param {number} [hp]      耐久の上書き（難易度で硬いカビを混ぜる用）
   * @param {string} [behavior] "ground"|"flyer"|"jumper"|"roller"
   */
  constructor(scene, x, y, kind, speed, hp, behavior = "ground") {
    const tex = kind === "boss" ? "mold_boss"
      : `mold_${Phaser.Utils.Array.GetRandom(COLORS)}`;
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
    this.behavior = behavior;
    const isBoss = kind === "boss";
    const isBig = kind === "big";
    this.hp = hp != null ? hp : (isBoss ? 8 : isBig ? 3 : 1);
    this.maxHp = this.hp;
    this.score = isBoss ? 1200 : isBig ? 300 : (this.hp > 1 ? 200 : 100);

    // 表示サイズ(720p)。硬いカビは少し大きく見せる
    const base = isBoss ? 200 : isBig ? 124 : 84;
    const dispH = base + (this.hp > 1 && !isBig && !isBoss ? 14 : 0);
    this.setScale(dispH / this.height);
    this.setOrigin(0.5, 0.5);

    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    const r = this.width * 0.40;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);

    // 動きパターン用の状態
    this.scrollSpeed = speed;
    this.baseY = y;                                              // 基準の高さ（dropperでは着地点）
    this.vy = 0;
    this.grounded = true;
    this.landed = false;
    this.extraSpeed = behavior === "roller" ? MOVE.roller.extraSpeed : 0;
    this.jumpTimer = Phaser.Math.Between(MOVE.jumper.intervalMin, MOVE.jumper.intervalMax);
    this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // dropper: 画面上部から出現して落下し、baseY(地上)で着地
    if (behavior === "dropper") {
      this.body.reset(x, MOVE.dropper.startY);
      this.setPosition(x, MOVE.dropper.startY);
    }

    this.setVelocityX(-(speed + this.extraSpeed));
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    const dt = d / 1000;

    // 水平: 常にスクロール（roller は加算ぶん速い）
    this.body.velocity.x = -(this.scrollSpeed + this.extraSpeed);

    // 垂直: behavior ごと（既定は0）
    let vy = 0;
    if (this.behavior === "flyer") {
      // ふわふわ上下（y = baseY + A*sin(w t) を速度で表現）
      const w = MOVE.flyer.bobHz * Math.PI * 2;
      vy = Math.cos((t / 1000) * w + this.phase) * MOVE.flyer.bobAmp * w;
    } else if (this.behavior === "jumper") {
      // 地上で待機 → 間隔ごとに飛びかかる
      if (this.grounded) {
        this.jumpTimer -= d;
        if (this.jumpTimer <= 0) { this.vy = -MOVE.jumper.strength; this.grounded = false; }
      } else {
        this.vy += MOVE.jumper.gravity * dt;
        // 着地（前フレームのyで判定）→ 1フレームでちょうど baseY に戻す
        if (this.vy >= 0 && this.y >= this.baseY) {
          this.grounded = true;
          this.jumpTimer = Phaser.Math.Between(MOVE.jumper.intervalMin, MOVE.jumper.intervalMax);
          this.vy = 0;
          this.body.velocity.y = (this.baseY - this.y) / dt;
          this.rotation = 0;
          return;
        }
      }
      vy = this.vy;
    } else if (this.behavior === "dropper") {
      // 上から落下 → baseY(地上)で着地して以降は地上カビ扱い
      if (!this.landed) {
        this.vy += MOVE.dropper.gravity * dt;
        if (this.y >= this.baseY) {
          this.landed = true; this.vy = 0;
          vy = (this.baseY - this.y) / dt;   // 1フレームでちょうど着地
        } else {
          vy = this.vy;
        }
      }
    }
    this.body.velocity.y = vy;

    // 回転演出（当たり判定に影響なし）
    if (this.behavior === "roller") {
      this.rotation -= MOVE.roller.spin * dt;            // 転がり
    } else {
      this.rotation = Math.sin(t * 0.005 + this.phase) * 0.09;
    }
  }

  /** 被弾。撃破ならtrue */
  damage(n = 1) {
    this.hp -= n;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { if (this.active) this.clearTint(); });
    return this.hp <= 0;
  }
}
