// カビ（敵）。ランナー型: 全カビが基準速度で左へ流れてくる。
// 物理ボディは重力OFF・速度のみで動かし、見た目と当たり判定がズレないようにする。
const COLORS = ["pink", "green", "purple", "yellow", "blue"];

export default class Mold extends Phaser.Physics.Arcade.Sprite {
  /**
   * @param {number} speed 基準速度(px/s)。全カビ共通で渡す。
   * @param {number} [hp]  耐久の上書き（難易度で硬いカビを混ぜる用）
   */
  constructor(scene, x, y, kind, speed, hp) {
    const tex = kind === "boss" ? "mold_boss"
      : `mold_${Phaser.Utils.Array.GetRandom(COLORS)}`;
    super(scene, x, y, tex);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.kind = kind;
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

    this.setVelocityX(-speed);
    this.phase = Phaser.Math.FloatBetween(0, Math.PI * 2);
  }

  preUpdate(t, d) {
    super.preUpdate(t, d);
    // 当たり判定に影響しない演出（回転ゆらぎ）
    this.rotation = Math.sin(t * 0.005 + this.phase) * 0.09;
  }

  /** 被弾。撃破ならtrue */
  damage(n = 1) {
    this.hp -= n;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { if (this.active) this.clearTint(); });
    return this.hp <= 0;
  }
}
