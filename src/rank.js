// スコアに応じた称号（レベル）。しきい値は RANK_STEP 刻みで、後から変えやすいよう集約。
export const RANK_STEP = 2000;             // 称号が上がるスコア間隔
export const RANKS = [
  "カビ取り見習い",      // 0〜1999
  "カビ取り職人",        // 2000〜3999
  "カビ取りマイスター",  // 4000〜5999
  "カビ取り隊長",        // 6000〜7999
  "カビ取りマスター",    // 8000〜9999
  "伝説のカビ取りキング", // 10000以上
];

// スコア→称号インデックス（最大で最後の称号に丸める）
export function rankIndex(score) {
  return Math.min(RANKS.length - 1, Math.max(0, Math.floor(score / RANK_STEP)));
}
export function rankName(score) {
  return RANKS[rankIndex(score)];
}
export function rankNameByIndex(i) {
  return RANKS[Math.min(RANKS.length - 1, Math.max(0, i))];
}
