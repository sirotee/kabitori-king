// WebAudio による簡易SE。画像素材のみのプロジェクトなので音は合成で鳴らす。
let ctx = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  // ユーザー操作後に resume が必要なブラウザ対策
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip({ freq = 440, freq2 = null, type = "square", dur = 0.12, vol = 0.2 }) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export const SFX = {
  unlock() { ac(); },
  fire()   { blip({ freq: 720, freq2: 1200, type: "triangle", dur: 0.12, vol: 0.18 }); },
  hit()    { blip({ freq: 320, freq2: 180, type: "square", dur: 0.08, vol: 0.15 }); },
  pop()    { blip({ freq: 900, freq2: 200, type: "sawtooth", dur: 0.16, vol: 0.2 }); },
  hurt()   { blip({ freq: 200, freq2: 60, type: "sawtooth", dur: 0.25, vol: 0.25 }); },
  jump()   { blip({ freq: 400, freq2: 760, type: "sine", dur: 0.12, vol: 0.18 }); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip({ freq: f, type: "triangle", dur: 0.18, vol: 0.2 }), i * 130)); },
  lose()   { [440, 330, 247, 165].forEach((f, i) => setTimeout(() => blip({ freq: f, type: "square", dur: 0.22, vol: 0.2 }), i * 150)); },
  star()   { [659, 784, 988, 1318, 1568].forEach((f, i) => setTimeout(() => blip({ freq: f, type: "triangle", dur: 0.12, vol: 0.18 }), i * 70)); },
  fall()   { blip({ freq: 600, freq2: 60, type: "sine", dur: 0.5, vol: 0.25 }); },
  levelup(){ [784, 988, 1318, 1568, 2093].forEach((f, i) => setTimeout(() => blip({ freq: f, type: "triangle", dur: 0.14, vol: 0.2 }), i * 80)); },
};
