// Áudio sintetizado (WebAudio).
let actx = null;
function audio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; }
function tone(freq, dur, type = 'sine', vol = 0.2, slide = null) {
  if (!actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.2, freq = 1000, q = 1) {
  if (!actx) return;
  const t = actx.currentTime, len = Math.ceil(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = actx.createBufferSource(); s.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(actx.destination); s.start(t);
}
const sfx = {
  swing: () => noise(0.18, 0.25, 1800, 2),
  heavy: () => noise(0.3, 0.3, 900, 1.5),
  hit: () => { noise(0.12, 0.4, 400); tone(90, 0.15, 'square', 0.12, 50); },
  block: () => { tone(900, 0.25, 'square', 0.08, 600); tone(1350, 0.2, 'triangle', 0.06); },
  hurt: () => { tone(160, 0.25, 'sawtooth', 0.15, 70); noise(0.15, 0.3, 300); },
  roll: () => noise(0.3, 0.12, 400, 0.7),
  drink: () => { tone(500, 0.4, 'sine', 0.1, 800); tone(750, 0.5, 'sine', 0.08, 1100); },
  souls: () => { tone(880, 0.6, 'sine', 0.1); tone(1320, 0.8, 'sine', 0.07); },
  bonfire: () => { noise(1.2, 0.3, 500, 0.5); tone(220, 1.5, 'sine', 0.08, 330); },
  death: () => { tone(110, 2.5, 'sawtooth', 0.12, 40); tone(82, 3, 'sine', 0.15, 41); },
  roar: () => { tone(70, 1.4, 'sawtooth', 0.25, 45); noise(1.2, 0.3, 200, 0.6); },
  slam: () => { tone(55, 0.6, 'sine', 0.4, 30); noise(0.5, 0.4, 150, 0.5); },
  victory: () => { [440, 554, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'triangle', 0.08), i * 180)); },
  arrow: () => noise(0.1, 0.15, 3000, 3),
};
export { audio, tone, noise, sfx };
