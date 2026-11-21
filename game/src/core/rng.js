// Deterministic randomness and the small numeric helpers shared by every system.
// makeRng drives world generation; makeRngAt gives a stable stream for a grid cell.

export function makeRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRngAt(x, z) {
  const hashed = (Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663)) >>> 0;
  return makeRng(hashed);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, v) {
  const t = clamp((b - a) === 0 ? 0 : (v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}
