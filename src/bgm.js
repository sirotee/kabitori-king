// BGM管理（シングルトン）。Phaserのグローバルサウンドマネージャ上に1つだけ生成し、
// シーンをまたいでも同じインスタンスを使う＝二重再生しない。
// BGMはサイズが大きいので Boot ではロードせず、Title/Game 到達後に遅延ロードして
// 初期ローディング（ローディング画面）をブロックしないようにする。
let snd = null;
let wantPlay = false;             // ユーザー操作で再生要求済みか（ロード完了後に自動再生する）
const MUTE_KEY = "kabi_bgm_mute";
const VOLUME = 0.14;
const SRC = "assets/audio/bgm.mp3?v=11";

export const BGM = {
  // キャッシュにbgmがあればインスタンス化する。無ければ何もしない（ensureLoaded後に有効化）。
  init(scene) {
    if (snd) return snd;
    if (!scene.cache.audio.exists("bgm")) return null;   // まだ読み込まれていない
    snd = scene.sound.add("bgm", { loop: true, volume: VOLUME });
    snd.setMute(localStorage.getItem(MUTE_KEY) === "1");
    if (wantPlay && !snd.isPlaying) snd.play();           // 既に再生要求済みなら鳴らす
    return snd;
  },

  // BGMを遅延ロードする。呼ばれたシーンのローダーで読み込み、完了時に init する。
  // どのシーンから呼ばれても、生きているシーンのローダーが読み切ればOK（途中遷移にも強い）。
  ensureLoaded(scene) {
    if (snd) return;
    if (scene.cache.audio.exists("bgm")) { BGM.init(scene); return; }
    scene.load.audio("bgm", SRC);
    scene.load.once("complete", () => BGM.init(scene));
    if (!scene.load.isLoading()) scene.load.start();
  },

  // 最初のユーザー操作後に呼ぶ。未ロードでも要求を記録し、ロード完了時に自動再生する。
  play() {
    wantPlay = true;
    if (snd && !snd.isPlaying) snd.play();
  },

  // ミュートはローカル保存に基づいて切替（未ロードでも設定だけ保持し、ロード後に反映）
  toggleMute() {
    const m = !(localStorage.getItem(MUTE_KEY) === "1");
    if (snd) snd.setMute(m);
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    return m;
  },
  isMuted() {
    return localStorage.getItem(MUTE_KEY) === "1";
  },
};
