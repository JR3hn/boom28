// Streckat spår på vägarna. Svagt i förväg, fylls i bakom boomerangen.
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { UP } from './util.js';

export function buildTrail(routes) {
  const S = SETTINGS.trail;
  const y = SETTINGS.layers.land + SETTINGS.layers.trail;

  // streckens positioner längs varje sträcka (leg = vilket stopp sträckan går till)
  const dashes = [];
  routes.forEach((route, leg) => {
    if (!route) return;
    const len = route.getLength();
    for (let s = 0.04; s + S.dash < len - 0.04; s += S.dash + S.gap) {
      const f = (s + S.dash / 2) / len;
      dashes.push({ leg, f, p: route.getPointAt(f), tan: route.getTangentAt(f) });
    }
  });

  const geo = new THREE.PlaneGeometry(S.dash, S.width).rotateX(-Math.PI / 2);
  const layer = (opacity, lift) => {
    const mat = new THREE.MeshBasicMaterial({ color: SETTINGS.colors.accent, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, dashes.length));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    dashes.forEach((d, i) => {
      q.setFromAxisAngle(UP, Math.atan2(-d.tan.z, d.tan.x));
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(d.p.x, y + lift, d.p.z), q, one));
    });
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
  };
  const ahead = layer(S.aheadOpacity, 0), drawn = layer(1, 0.001);
  drawn.renderOrder = 3;
  ahead.count = dashes.length;
  drawn.count = 0;

  return {
    meshes: [ahead, drawn],
    // Visa spåret fram till: alla sträckor t.o.m. `doneLeg`, plus `s` (0..1) av sträckan `leg`
    reveal(doneLeg, leg, s, showAhead) {
      let n = 0;
      for (const d of dashes) { if (d.leg <= doneLeg || (d.leg === leg && d.f <= s)) n++; else break; }
      drawn.count = n;
      ahead.visible = showAhead;
    },
  };
}
