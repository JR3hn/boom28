// Hjälpfunktioner.
import * as THREE from '../vendor/three.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t * t * t * (t * (t * 6 - 15) + 10); // mjuk start och stopp (smootherstep)
export const soft = t => t * t * (3 - 2 * t);                  // mjukare variant (smoothstep)
export const DEG = Math.PI / 180;
export const UP = new THREE.Vector3(0, 1, 0);
export const vec = ([x, y, z]) => new THREE.Vector3(x, y, z);

// Seedad slump (LCG), samma frö ger samma sekvens
export function random(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
