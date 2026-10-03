import { rankNameByIndex } from "../rank.js";
import { SFX } from "../audio.js";
import { addRecord, getPlayerName, setPlayerName, getRecentNames, SHOW } from "../ranking.js";

export default class Result extends Phaser.Scene {
  constructor() { super("Result"); }

  init(data) {
    this.dist = data.dist || 0;
    this.score = data.score || 0;
    this.hi = data.hi || 0;
    this.hiScore = data.hiScore || 0;
    this.best = !!data.best;
    this.rank = data.rank || 0;
    this.bestRank = data.bestRank || 0;
    this.newRank = !!data.newRank;
  }

  create() {
    const { width, height } = this.scale;
    const bg = this.add.image(width / 2, height / 2, "bg_cathedral");
    bg.setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x401a2a, 0.55);

    // 今回の記録をランキングに登録
    const name = getPlayerName();
    const { list, place, id } = addRecord({ name, score: this.score, dist: this.dist, rank: this.rank });

    // 左: 今回の結果 / 右: ランキング
    const lx = width * 0.3;
    this.add.text(lx, height * 0.11, "GAME OVER", {
      fontFamily: "sans-serif", fontSize: "64px", fontStyle: "bold",
      color: "#ff8a8a", stroke: "#2a1a50", strokeThickness: 9,
    }).setOrigin(0.5);

    // キング（背面・控えめ）
    this.add.image(lx, height * 0.75, "king_tired").setScale(0.5).setAlpha(0.85);

    this.add.text(lx, height * 0.205, `${name || "ななしのキング"} の記録`, {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);

    // 到達距離・スコア
    this.add.text(lx, height * 0.275, `${this.dist} m  (BEST ${this.hi}m)`, {
      fontFamily: "sans-serif", fontSize: "32px", color: "#ffffff",
      fontStyle: "bold", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);
    this.add.text(lx, height * 0.34, `SCORE  ${this.score}  (BEST ${this.hiScore})`, {
      fontFamily: "sans-serif", fontSize: "28px", color: "#ffe27a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    // ===== 称号パネル（映える装飾つき）=====
    const py = height * 0.49;
    const glow = this.add.image(lx, py, "glow").setBlendMode("ADD")
      .setScale(4.6).setTint(0xffe14a).setAlpha(0.9);
    this.tweens.add({ targets: glow, alpha: 0.5, scale: 4.1, duration: 900, yoyo: true, repeat: -1 });
    const panel = this.add.rectangle(lx, py, 540, 126, 0x2a1d4a, 0.85)
      .setStrokeStyle(4, 0xffd24a, 0.95);
    this.add.text(lx, py - 36, "★  称  号  ★", {
      fontFamily: "sans-serif", fontSize: "20px", color: "#ffd24a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 3,
    }).setOrigin(0.5);
    const rankName = this.add.text(lx, py + 14, rankNameByIndex(this.rank), {
      fontFamily: "sans-serif", fontSize: "42px", color: "#ffffff", fontStyle: "bold",
      stroke: "#c08000", strokeThickness: 8,
    }).setOrigin(0.5);
    // 称号名はサイズ固定（拡縮アニメなし）。パネルのみ登場アニメ、名前はフェードインのみ
    panel.setScale(0.6); panel.setAlpha(0);
    rankName.setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 320, ease: "Back.out" });
    this.tweens.add({ targets: rankName, alpha: 1, duration: 320,
      onComplete: () => SFX.levelup && SFX.levelup() });

    // 最高到達称号
    const newBadge = this.newRank ? "  ★最高更新！" : "";
    this.add.text(lx, height * 0.62, `BEST: ${rankNameByIndex(this.bestRank)}${newBadge}`, {
      fontFamily: "sans-serif", fontSize: "22px",
      color: this.newRank ? "#ffd24a" : "#cfd6ff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    this.drawRanking(list, place, id);

    const retry = this.add.text(lx, height * 0.9, "もう一度（タップ / Space）", {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff",
      backgroundColor: "#5b4bd6", padding: { x: 20, y: 12 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: retry, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    // 次のプレイヤー: 直近の人はタップでその名前のまま開始、「＋新しい人」はタイトルで名前入力
    const { buttons, pick } = this.drawNextPlayers(name);

    let started = false;
    const go = (key) => { if (started) return; started = true; this.scene.start(key); };
    this.input.keyboard.once("keydown-SPACE", () => go("Game"));
    this.input.keyboard.once("keydown-ENTER", () => go("Game"));
    // 名前ボタン以外のタップはもう一度（同じ人で）
    this.input.on("pointerdown", (_p, over) => {
      const hit = buttons.find((b) => over.includes(b));
      if (!hit) return go("Game");
      if (started) return;
      started = true;
      pick(hit);
    });
  }

  drawNextPlayers(current) {
    const { width, height } = this.scale;
    const y = height * 0.9;
    const left = width * 0.75 - 260, right = width * 0.75 + 260;
    this.add.text(left, height * 0.835, "次のプレイヤー（タップで選ぶ）", {
      fontFamily: "sans-serif", fontSize: "18px", color: "#cfd6ff", fontStyle: "bold",
      stroke: "#000", strokeThickness: 3,
    }).setOrigin(0, 0.5);

    const short = (n) => { const a = Array.from(n); return a.length > 5 ? a.slice(0, 5).join("") + "…" : n; };
    const items = getRecentNames().map((n) => ({ label: short(n), name: n, mine: n === current }));
    items.push({ label: "＋新しい人", name: null });
    const buttons = items.map((it) => {
      const b = this.add.text(0, y, it.label, {
        fontFamily: "sans-serif", fontSize: "20px", fontStyle: "bold",
        color: it.name === null ? "#ffffff" : "#2a1d4a",
        backgroundColor: it.name === null ? "#3a2f6a" : (it.mine ? "#ffd24a" : "#ffe9a8"),
        padding: { x: 12, y: 10 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
      b.item = it;
      return b;
    });
    // 横に詰めて並べ、右端に収まらなければ縮める
    const gap = 10;
    const total = buttons.reduce((s, b) => s + b.width, 0) + gap * (buttons.length - 1);
    const scale = Math.min(1, (right - left) / total);
    let x = left;
    buttons.forEach((b) => { b.setScale(scale); b.x = x; x += b.width * scale + gap; });

    const pick = (b) => {
      if (b.item.name === null) { this.scene.start("Title", { entry: true }); return; }
      setPlayerName(b.item.name);
      this.scene.start("Game");
    };
    return { buttons, pick };
  }

  // ---------------- ランキング（右側パネル） ----------------
  drawRanking(list, place, id) {
    const { width, height } = this.scale;
    const cx = width * 0.75, pw = 520;
    const top = height * 0.09, bottom = height * 0.8;
    this.add.rectangle(cx, (top + bottom) / 2, pw, bottom - top, 0x1c1438, 0.88)
      .setStrokeStyle(3, 0xffd24a, 0.9);
    this.add.text(cx, top + 34, "🏆  ランキング  🏆", {
      fontFamily: "sans-serif", fontSize: "30px", color: "#ffd24a", fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);

    const left = cx - pw / 2 + 26, right = cx + pw / 2 - 26;
    const rowH = 38, y0 = top + 86;
    const medal = ["#ffd24a", "#dfe6f0", "#e0a060"];
    list.slice(0, SHOW).forEach((e, i) => {
      const y = y0 + i * rowH;
      const mine = e.id === id;
      if (mine) {
        const hl = this.add.rectangle(cx, y, pw - 20, rowH - 4, 0xffd24a, 0.32).setStrokeStyle(2, 0xffd24a, 1);
        this.tweens.add({ targets: hl, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
      }
      const color = mine ? "#ffffff" : (medal[i] || "#cfd6ff");
      const st = { fontFamily: "sans-serif", fontSize: "22px", color, fontStyle: "bold", stroke: "#000", strokeThickness: 3 };
      this.add.text(left, y, `${i + 1}位`, st).setOrigin(0, 0.5);
      this.add.text(left + 72, y, e.name, st).setOrigin(0, 0.5);
      this.add.text(right, y, e.score.toLocaleString(), st).setOrigin(1, 0.5);
    });

    // 今回の順位（TOP外でも分かるように）
    const msg = place === 1 ? "★ 1位！ おめでとう！ ★"
      : place <= SHOW ? `今回は ${place}位 にランクイン！`
      : `今回は ${place}位（${list.length}件中）`;
    this.add.text(cx, bottom - 26, msg, {
      fontFamily: "sans-serif", fontSize: "22px", color: place <= 3 ? "#ffd24a" : "#ffffff",
      fontStyle: "bold", stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5);
  }
}
