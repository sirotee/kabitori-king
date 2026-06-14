import { SFX } from "../audio.js";

export const KING_DISPLAY_H = 160;   // 表示高さ(720p)
const GRAVITY = 1733;                 // 手動重力(px/s^2)
const JUMP_V = -880;
const FIRE_CD = 320;                 // 魔法クールダウン(ms)
const HURT_INVULN = 1100;            // 被弾後の無敵(ms)

// 歩行: フレームとバウンドを単一の位相から駆動して完全同期させる
const WALK_SEQ = [8, 7, 2, 3, 0, 1];  // 新シート: 前足到達が滑らかに変化する順(昇順)＋三角波で往復
const STRIDE_HZ = 1.1;                // 1秒あたりの歩数サイクル
const BOB_AMP = 0;                    // 上下バウンド振幅(px)。0=完全フラット（胴体静止・脚だけ動く）

// ランナー型プレイヤー。左寄り固定、操作はジャンプと魔法のみ。常に右向き。
// 垂直運動は手動制御（重力ボディに任せると接地判定のチラつきで上下にガタつくため）。
export default class King extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "king_walk_0");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.fixedX = x;
    this.groundY = y;
    this.vy = 0;
    this.airborne = false;
    this.hp = 5;
    this.lastFire = -9999;
    this.invulnUntil = 0;
    this.invincibleUntil = 0;
    this.castUntil = 0;
    this.hurtUntil = 0;
    this.dead = false;

    const scale = KING_DISPLAY_H / this.height;
    this.setScale(scale);
    this.setOrigin(0.5, 1);

    const fw = this.width, fh = this.height;
    const bw = fw * 0.42, bh = fh * 0.84;
    this.body.setSize(bw, bh);
    this.body.setOffset((fw - bw) / 2, fh - bh - fh * 0.02);
    this.body.setAllowGravity(false);   // 垂直は手動
    this.setCollideWorldBounds(false);
  }

  makeInvincible(time, dur) { this.invincibleUntil = time + dur; }
  isInvincible(time) { return time < this.invincibleUntil; }

  muzzle() {
    return { x: this.x + this.displayWidth * 0.30, y: this.y - this.displayHeight * 0.60 };
  }

  setStaticTex(key) {
    if (this.texture.key !== key) this.setTexture(key);
  }

  /**
   * @param dt          秒
   * @param groundUnder キングの足元に地面があるか（シーンが判定）
   */
  handle(input, time, dt, groundUnder) {
    if (this.dead) return;
    this.setVelocityX(0);
    this.x = this.fixedX;
    this.body.velocity.y = 0;   // 垂直は手動制御するので物理速度は使わない

    // 歩行位相（フレームとバウンドを同じ位相から算出＝完全同期）
    const cyc = (time / 1000) * STRIDE_HZ;
    const t = cyc - Math.floor(cyc);
    const tri = t < 0.5 ? t * 2 : (1 - t) * 2;       // 0→1→0
    const bob = -Math.sin(tri * Math.PI) * BOB_AMP;  // 接地で0、パッシングで最大持上げ（滑らか）
    this.walkIdx = Math.round(tri * (WALK_SEQ.length - 1));

    // ジャンプ
    if (input.jumpJust && !this.airborne) {
      this.vy = JUMP_V; this.airborne = true; SFX.jump();
    }

    // 垂直運動（手動）
    if (this.airborne) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.vy > 0 && this.y >= this.groundY && groundUnder) {
        this.y = this.groundY; this.vy = 0; this.airborne = false;   // 着地
      }
    } else if (!groundUnder) {
      this.airborne = true; this.vy = 0;          // 穴に踏み出した → 落下開始
    } else {
      this.y = this.groundY + bob;                // 接地中: 滑らかなバウンドのみ
    }

    // 魔法（スプレー）。無敵中は入力に関係なく自動連射。
    // 通常時は洗剤ゲージが1発分あるときだけ発射（scene.canSprayで判定）
    const wantFire = input.fireJust || input.fire || this.isInvincible(time);
    if (wantFire && time - this.lastFire >= FIRE_CD && this.scene.canSpray(time)) {
      this.lastFire = time;
      this.castUntil = time + 200;
      this.scene.fireBolt(this);
      SFX.fire();
    }

    // ポーズ（被弾 > 詠唱 > 空中 > 走行）
    if (time < this.hurtUntil) {
      this.setStaticTex("king_tired");
    } else if (time < this.castUntil) {
      this.setStaticTex("king_cast");
    } else if (this.airborne) {
      this.setStaticTex("king_jump");
    } else {
      this.setStaticTex(`king_walk_${WALK_SEQ[this.walkIdx]}`);
    }

    // 表示エフェクト（無敵 > 被弾点滅 > 通常）
    if (this.isInvincible(time)) {
      const rem = this.invincibleUntil - time;
      const period = rem < 2000 ? 55 : 140;
      this.setTint(Math.floor(time / period) % 2 ? 0xffe14a : 0xffc227);
      this.setAlpha(rem < 2000 ? (Math.floor(time / period) % 2 ? 0.55 : 1) : 1);
    } else {
      this.clearTint();
      this.setAlpha(time < this.invulnUntil ? (Math.floor(time / 80) % 2 ? 0.35 : 1) : 1);
    }
  }

  hurt(time) {
    if (this.dead || time < this.invulnUntil) return false;
    this.hp -= 1;
    this.invulnUntil = time + HURT_INVULN;
    this.hurtUntil = time + 400;
    this.vy = -320; this.airborne = true;
    SFX.hurt();
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
    return true;
  }
}
