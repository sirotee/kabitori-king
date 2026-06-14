// カビ取りスプレーの泡弾。前方(右)へ直進。泡/水しぶきの束で表現。
// 当たり判定は縦長にして地上カビ/空中カビ両方を狙える。
const BOLT_SPEED = 900;
const LIFE = 1500;

export default class Bolt extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    super(scene, x, y, "bubble");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.setDepth(6);
    this.setTint(0xeafaff);
    this.setAlpha(0.9);
    // 弾本体は控えめ。当たり判定は縦長に。
    this.setDisplaySize(30, 30);
    this.body.setSize(40, 190);

    // 泡の束（洗剤の霧）が弾について流れる
    this.emitter = scene.add.particles(0, 0, "bubble", {
      follow: this,
      followOffset: { x: -6, y: 0 },
      speedX: { min: -40, max: 30 },
      speedY: { min: -70, max: 70 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.85, end: 0 },
      lifespan: 320, frequency: 16, quantity: 2,
      tint: [0xffffff, 0xd6f3ff, 0xb8ecff],
    });
    this.emitter.setDepth(5);
  }

  fire() {
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.setVelocity(BOLT_SPEED, 0);
    this.bornAt = this.scene.time.now;
    this.emitter.start();
    this.scene.tweens.add({ targets: this, scale: 1.4, duration: 120, yoyo: true, repeat: -1 });
    return this;
  }

  kill() {
    this.scene.tweens.killTweensOf(this);
    this.emitter.stop();
    this.setActive(false).setVisible(false);
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  update(t) {
    if (!this.active) return;
    if (t - this.bornAt > LIFE) this.kill();
    if (this.x > this.scene.scale.width + 80) this.kill();
  }
}
