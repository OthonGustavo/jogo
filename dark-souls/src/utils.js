// Funções utilitárias puras (sem estado).
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
export const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const rand = (a, b) => a + Math.random() * (b - a);
export const $ = id => document.getElementById(id);
