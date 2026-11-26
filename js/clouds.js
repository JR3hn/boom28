// Platta moln söder om ön. Glider isär när boomerangen dyker igenom och
// tonar bort när kameran är nära, annars blir bilden grå.
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { clamp, ease, random } from './util.js';

export function buildClouds(divePath) {
  const S = SETTINGS.clouds;
  const rand = random(S.seed);
  const between = ([a, b]) => a + rand() * (b - a);
  const group = new THREE.Group();

  const clouds = Array.from({ length: S.count }, (_, i) => {
    const size = between(S.size);
    const shape = cloudShape(size, rand);
    const top = new THREE.MeshBasicMaterial({ color: SETTINGS.colors.cloud, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const shade = top.clone();
    shade.color.set(SETTINGS.colors.cloudShade);
    const layer = mat => new THREE.Mesh(new THREE.ShapeGeometry(shape, 24).rotateX(-Math.PI / 2), mat);
    const a = layer(top), b = layer(shade);
    b.position.set(0.05, -0.07, 0.06); b.scale.setScalar(1.03); // skuggkant under, som papper
    b.renderOrder = 10 + i * 2; a.renderOrder = 11 + i * 2;

    const base = new THREE.Vector3((rand() - 0.5) * S.spread, between(S.height), between(S.south));
    const g = new THREE.Group();
    g.add(b, a);
    g.rotation.y = (rand() - 0.5) * 0.8;
    group.add(g);

    // molnet glider bort från närmaste punkt på dykbanan i ungefär samma höjd
    let nearest = null, best = Infinity;
    for (let k = 0; k <= 60; k++) {
      const p = divePath.getPointAt(k / 60);
      const d = Math.abs(p.y - base.y) + 0.2 * Math.hypot(p.x - base.x, p.z - base.z);
      if (d < best) { best = d; nearest = p; }
    }
    const away = new THREE.Vector3(base.x - nearest.x, 0, base.z - nearest.z);
    const dist = away.length();
    away.normalize().multiplyScalar(Math.max(0, 2.2 - dist) * S.parting); // närmare banan = glider längre
    return { g, base, away, top, shade, size };
  });

  return {
    group,
    // open = 0..1 hur isärglidna molnen är
    update(open, camera) {
      for (const c of clouds) {
        c.g.position.copy(c.base).addScaledVector(c.away, ease(open));
        const dy = Math.abs(camera.position.y - c.g.position.y);
        const dxz = Math.hypot(camera.position.x - c.g.position.x, camera.position.z - c.g.position.z);
        const fade = dxz < c.size * 1.6 ? clamp((dy - 0.15) / SETTINGS.clouds.fadeNear) : 1;
        c.top.opacity = 0.97 * fade;
        c.shade.opacity = 0.9 * fade;
        c.g.visible = fade > 0.01;
      }
    },
  };
}

// En bubblig molnform: en cirkel med några överlagrade vågor
function cloudShape(size, rand) {
  const a = rand() * 6, b = rand() * 6, c = rand() * 6;
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const th = (i / 64) * Math.PI * 2;
    const r = size * (1 + 0.16 * Math.sin(3 * th + a) + 0.1 * Math.sin(5 * th + b) + 0.05 * Math.sin(9 * th + c));
    pts.push(new THREE.Vector2(Math.cos(th) * r * 1.35, Math.sin(th) * r * 0.85));
  }
  return new THREE.Shape(pts);
}
