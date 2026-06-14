// BGM管理（シングルトン）。Phaserのグローバルサウンドマネージャ上に1つだけ生成し、
// シーンをまたいでも同じインスタンスを使う＝二重再生しない。
let snd = null;
const MUTE_KEY = "kabi_bgm_mute";
const VOLUME = 0.14;

export const BGM = {
  // どのシーンからでも安全に呼べる（既に生成済みなら何もしない）
  init(scene) {
    if (!snd) {
      snd = scene.sound.add("bgm", { loop: true, volume: VOLUME });
      snd.setMute(localStorage.getItem(MUTE_KEY) === "1");
    }
    return snd;
  },
  // 最初のユーザー操作後に呼ぶ。再生中なら何もしない（二重再生防止）
  play() {
    if (snd && !snd.isPlaying) snd.play();
  },
  toggleMute() {
    if (!snd) return false;
    const m = !snd.mute;
    snd.setMute(m);
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    return m;
  },
  isMuted() {
    return localStorage.getItem(MUTE_KEY) === "1";
  },
};
