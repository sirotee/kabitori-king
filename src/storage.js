// localStorage の安全ラッパー。
// Safari のプライベートモード / 外部サイトへの iframe 埋め込み / ストレージ無効設定では
// localStorage へのアクセス自体が例外を投げ、シーンの create が途中で落ちて画面が真っ黒になる。
// 例外時はメモリ上のフォールバックに切り替え、ゲーム進行を止めない。
const mem = new Map();

export const storage = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (_) {
      return mem.has(key) ? mem.get(key) : fallback;
    }
  },
  set(key, value) {
    const v = String(value);
    mem.set(key, v);
    try { localStorage.setItem(key, v); } catch (_) { /* 保存不可でも続行 */ }
  },
  getInt(key, fallback = 0) {
    const n = parseInt(storage.get(key, ""), 10);
    return Number.isFinite(n) ? n : fallback;
  },
};
