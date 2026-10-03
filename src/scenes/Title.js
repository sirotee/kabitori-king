import { SFX } from "../audio.js";
import { BGM } from "../bgm.js";
import { getPlayerName, setPlayerName, getRecentNames } from "../ranking.js";

export default class Title extends Phaser.Scene {
  constructor() { super("Title"); }

  // Result の「＋新しい人」から来た時は名前入力をすぐ開く
  init(data) { this.autoEntry = !!(data && data.entry); }

  create() {
    const { width, height } = this.scale;
    BGM.ensureLoaded(this);   // タイトル表示中に裏でBGMを読み込む（初回操作までに間に合う）

    const bg = this.add.image(width / 2, height / 2, "bg_cathedral");
    bg.setDisplaySize(width, height);
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1540, 0.35);

    const king = this.add.image(width / 2, height * 0.6 - 60, "king_cast").setScale(0.95);
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
      this.add.text(width / 2, height * 0.76 + 30, "JUMP: ↑     Magic: Space", {
        fontFamily: "sans-serif", fontSize: "20px", color: "#dfe4ff",
        stroke: "#2a1a50", strokeThickness: 3,
      }).setOrigin(0.5);
    }

    const start = this.add.text(width / 2, height * 0.88, "Tap / Space", {
      fontFamily: "sans-serif", fontSize: "26px", color: "#ffffff",
      backgroundColor: "#5b4bd6", padding: { x: 20, y: 12 },
    }).setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });

    // Space とタップが同フレームに来ても二重に処理しない。
    // 1回目の入力で名前入力を出し、送信でゲーム開始
    let opened = false;
    const openEntry = () => {
      if (opened) return;
      opened = true;
      SFX.unlock(); BGM.play();   // 音の解禁はユーザー操作の中で行う
      this.showNameEntry();
    };
    this.input.keyboard.once("keydown-SPACE", openEntry);
    this.input.keyboard.once("keydown-ENTER", openEntry);
    this.input.keyboard.on("keydown-M", () => BGM.toggleMute());   // ミュートは画面ボタン廃止・Mキーのみ
    this.input.once("pointerdown", openEntry);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.hideNameEntry());
    if (this.autoEntry) openEntry();
  }

  // ---------------- 名前入力（index.html の #name-entry） ----------------
  showNameEntry() {
    const box = document.getElementById("name-entry");
    const form = document.getElementById("name-form");
    const input = document.getElementById("name-input");
    if (!box || !form || !input) { this.scene.start("Game"); return; }

    // Game で SPACE/W/X/Z をキャプチャ済みだと入力欄に文字が打てないので、表示中は解除
    this.input.keyboard.enabled = false;
    this.input.keyboard.disableGlobalCapture();

    let started = false;
    const begin = (name) => {
      if (started) return;
      started = true;
      setPlayerName(name);
      input.blur();
      this.scene.start("Game");
    };

    // 直近プレイヤーはワンタップで開始
    const recent = getRecentNames();
    const wrap = document.getElementById("recent-names");
    const chips = document.getElementById("recent-chips");
    if (wrap && chips) {
      chips.replaceChildren(...recent.map((n) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = n;
        b.addEventListener("click", () => begin(n));
        return b;
      }));
      wrap.classList.toggle("show", recent.length > 0);
    }

    input.value = recent.length ? "" : getPlayerName();
    box.classList.add("show");
    this.onNameSubmit = (e) => { e.preventDefault(); begin(input.value); };
    form.addEventListener("submit", this.onNameSubmit);
    // 直近プレイヤーがいる時は選びやすいようキーボードを開かない。いない時は同じタップの中で focus（スマホでもキーボードが開く）
    if (!recent.length) {
      input.focus();
      if (input.value) input.select();
    }
  }

  hideNameEntry() {
    const box = document.getElementById("name-entry");
    const form = document.getElementById("name-form");
    if (form && this.onNameSubmit) form.removeEventListener("submit", this.onNameSubmit);
    this.onNameSubmit = null;
    if (box) box.classList.remove("show");
    this.input.keyboard.enableGlobalCapture();
    this.input.keyboard.enabled = true;
  }
}
