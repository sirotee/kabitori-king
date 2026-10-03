// プレイヤー名とスコアランキング（この端末の localStorage に保存）。
// 店頭・イベントで1台を回してプレイする想定で、端末内の全プレイ記録を上位 KEEP 件まで残す。
import { storage } from "./storage.js";

const NAME_KEY = "kabi_player_name";
const RANKING_KEY = "kabi_ranking";
export const NAME_MAX = 10;       // 名前の最大文字数
export const SHOW = 10;           // Result に表示する件数
const KEEP = 100;                 // 保存する件数
const DEFAULT_NAME = "ななしのキング";

export function cleanName(raw) {
  const s = Array.from(String(raw || "").replace(/[\u0000-\u001f]/g, "").trim()).slice(0, NAME_MAX).join("");
  return s || DEFAULT_NAME;
}

export function getPlayerName() { return storage.get(NAME_KEY, ""); }
export function setPlayerName(name) { storage.set(NAME_KEY, cleanName(name)); }

export function loadRanking() {
  try {
    const list = JSON.parse(storage.get(RANKING_KEY, "[]"));
    return Array.isArray(list) ? list.filter((e) => e && typeof e.score === "number") : [];
  } catch (_) {
    return [];
  }
}

// スコア降順 → 距離降順 → 先に出した記録が上
function compare(a, b) {
  return (b.score - a.score) || ((b.dist || 0) - (a.dist || 0)) || ((a.t || 0) - (b.t || 0));
}

// 記録を追加し、{ list: 並べ替え済み全件, place: 今回の順位(1始まり), id: 今回の記録ID } を返す
export function addRecord({ name, score, dist, rank }) {
  const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: cleanName(name), score, dist, rank, t: Date.now() };
  const list = loadRanking();
  list.push(entry);
  list.sort(compare);
  const place = list.findIndex((e) => e.id === entry.id) + 1;
  storage.set(RANKING_KEY, JSON.stringify(list.slice(0, KEEP)));
  return { list, place, id: entry.id };
}
