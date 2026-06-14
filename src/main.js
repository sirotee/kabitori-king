import Boot from "./scenes/Boot.js";
import Title from "./scenes/Title.js";
import Game from "./scenes/Game.js";
import Result from "./scenes/Result.js";

// 解像度を上げて描画をくっきりさせる（720p基準）
export const GAME_W = 1280;
export const GAME_H = 720;

// タッチ端末判定 → タッチUI表示
const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add("touch");

// タッチUIの入力状態（Gameシーンが参照）。ランナー型なのでジャンプと魔法のみ。
export const touch = { jump: false, jumpEdge: false, fire: false, fireEdge: false };

// physics debug 表示（検証時 true）
export const DEBUG = false;

function bindBtn(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  const down = (e) => { e.preventDefault(); onDown(); };
  const up = (e) => { e.preventDefault(); onUp && onUp(); };
  el.addEventListener("touchstart", down, { passive: false });
  el.addEventListener("touchend", up, { passive: false });
  el.addEventListener("touchcancel", up, { passive: false });
  el.addEventListener("mousedown", down);
  el.addEventListener("mouseup", up);
  el.addEventListener("mouseleave", up);
}
bindBtn("btn-jump",  () => { touch.jump = true; touch.jumpEdge = true; }, () => touch.jump = false);
bindBtn("btn-fire",  () => { touch.fire = true; touch.fireEdge = true; }, () => touch.fire = false);

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  parent: "game-wrap",
  backgroundColor: "#2a2440",
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },   // 丸めると小さな上下動が階段状になるためOFF
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 1733 }, debug: DEBUG },
  },
  scene: [Boot, Title, Game, Result],
};

const game = new Phaser.Game(config);
window.game = game;   // デバッグ用
export default game;
