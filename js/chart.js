// Sjökortet (vatten, djupkurvor, siffror, namn, kompass) ritas på en canvas.
// Öarna är upphöjda plattor med vägar och hus ovanpå.
// Koordinater: x österut, z söderut. Ön är 10 enheter hög (1 enhet ≈ 250 m).
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { random } from './util.js';

const EXTENT = 28;   // hur stor yta sjökortet täcker (enheter)
const PX = 4096;     // sjökortets upplösning
const C = SETTINGS.colors, M = SETTINGS.map, LAYER = SETTINGS.layers;

export const CHART_EXTENT = EXTENT;

// ---------------------------------------------------------------- sjökortet (canvas)
export function drawChart(map, { skipLabels = [] } = {}) {
  const serif = 'Literata', sans = 'Hanken Grotesk';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PX;
  const ctx = canvas.getContext('2d');
  const k = PX / EXTENT;
  const toPx = (x, z) => [(x + EXTENT / 2) * k, (z + EXTENT / 2) * k];
  const pathOf = rings => {
    const p = new Path2D();
    rings.forEach(r => { r.forEach(([x, z], i) => (i ? p.lineTo : p.moveTo).call(p, ...toPx(x, z))); p.closePath(); });
    return p;
  };

  ctx.fillStyle = C.sea;
  ctx.fillRect(0, 0, PX, PX);

  // rutnät
  ctx.strokeStyle = 'rgba(20,32,43,0.07)';
  ctx.lineWidth = 2;
  for (let g = -EXTENT / 2; g <= EXTENT / 2; g += 2) {
    const [a] = toPx(g, 0), [, b] = toPx(0, g);
    ctx.beginPath(); ctx.moveTo(a, 0); ctx.lineTo(a, PX); ctx.moveTo(0, b); ctx.lineTo(PX, b); ctx.stroke();
  }

  // djupområden, djupast först
  const fills = { 20: C.d20, 10: C.d10, 6: C.d6, 3: C.d3 };
  for (const c of [...map.contours].sort((a, b) => b.depth - a.depth)) {
    const p = pathOf(c.rings);
    if (fills[c.depth]) { ctx.fillStyle = fills[c.depth]; ctx.fill(p, 'evenodd'); }
    ctx.strokeStyle = C.contour;
    ctx.lineWidth = c.depth <= 6 ? 2.2 : 1.6;
    ctx.setLineDash(c.depth >= 20 ? [10, 8] : []);
    ctx.stroke(p);
  }
  ctx.setLineDash([]);

  // land (syns bara på avstånd, nära täcks det av plattorna)
  const land = pathOf(map.land.flatMap(p => [p.outer, ...p.holes]));
  ctx.fillStyle = C.land;
  ctx.fill(land, 'evenodd');

  // avstånd till land, för att placera namn och djupsiffror i vattnet
  const field = distanceField(land, k);
  const inWater = (u0, v0, u1, v1, margin = 0.03) => {
    for (let v = v0; v <= v1; v += field.cellPx) for (let u = u0; u <= u1; u += field.cellPx) if (field.at(u, v) < margin) return false;
    return true;
  };
  const taken = [];
  const isFree = b => !taken.some(t => b[0] < t[2] && b[2] > t[0] && b[1] < t[3] && b[3] > t[1]);

  // namn på vikar, sund och skär, flyttade till närmaste plats där hela namnet ligger i vattnet
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const skip = new Set(skipLabels);
  for (const l of map.labels || []) {
    if (skip.has(l.name)) continue;
    const water = l.kind === 'water';
    ctx.font = water ? `italic 400 ${M.labelSize.water}px ${serif}` : `500 ${M.labelSize.islet}px ${sans}`;
    ctx.fillStyle = water ? 'rgba(52,93,120,0.85)' : 'rgba(20,32,43,0.7)';
    const w = ctx.measureText(l.name).width, h = (water ? M.labelSize.water : M.labelSize.islet) * 1.15;
    const [u0, v0] = toPx(...l.at);
    const spot = spiralSearch(u0, v0, water ? 0 : Math.PI / 2, (u, v) => {
      const box = [u - w / 2 - 6, v - h / 2, u + w / 2 + 6, v + h / 2];
      return inWater(...box) && isFree(box) ? box : null;
    });
    if (!spot) continue; // hellre inget namn än ett namn på land
    ctx.fillText(l.name, (spot[0] + spot[2]) / 2, (spot[1] + spot[3]) / 2);
    taken.push(spot);
  }

  // djupsiffror (påhittade): ökar med avståndet från land enligt map.depthCurve
  const rand = random(7);
  ctx.fillStyle = 'rgba(20,32,43,0.6)';
  for (let tries = 0, placed = 0; tries < M.soundings * 4 && placed < M.soundings; tries++) {
    const [u, v] = toPx((rand() - 0.5) * EXTENT * 0.92, (rand() - 0.5) * EXTENT * 0.92);
    const fromLand = field.at(u, v);
    if (fromLand < 0.05) continue;                    // inte i strandkanten
    if (fromLand > 1.5 && rand() < 0.6) continue;     // glesare långt ut
    const box = [u - 32, v - 20, u + 32, v + 20];
    if (!isFree(box)) continue;
    const m = depthAt(fromLand) * (0.9 + rand() * 0.2);
    ctx.font = `italic 400 ${fromLand < 0.4 ? M.labelSize.sounding - 6 : M.labelSize.sounding}px ${serif}`;
    ctx.fillText(m < 10 ? m.toFixed(1).replace('.0', '').replace('.', ',') : String(Math.round(m)), u, v);
    taken.push(box);
    placed++;
  }

  drawCompass(ctx, ...toPx(...M.compass), 300, sans);
  return canvas;
}

function depthAt(dist) {
  const curve = M.depthCurve;
  for (let i = 1; i < curve.length; i++) {
    const [d0, m0] = curve[i - 1], [d1, m1] = curve[i];
    if (dist <= d1) return m0 + ((dist - d0) / (d1 - d0)) * (m1 - m0);
  }
  return curve[curve.length - 1][1];
}

// Söker utåt i en spiral från (u, v) tills test() godkänner en plats. Ger tillbaka testets svar.
function spiralSearch(u0, v0, startAngle, test) {
  for (let r = 0; r <= 260; r += 14) {
    const steps = r === 0 ? 1 : Math.max(8, Math.round(r / 6));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 + startAngle;
      const hit = test(u0 + Math.cos(a) * r, v0 + Math.sin(a) * r);
      if (hit) return hit;
    }
  }
  return null;
}

// Grovt avståndsfält: hur långt (i enheter) varje punkt ligger från närmaste land
function distanceField(landPath, pxPerUnit) {
  const N = 512, cellPx = PX / N;
  const mask = document.createElement('canvas');
  mask.width = mask.height = N;
  const mctx = mask.getContext('2d');
  mctx.scale(N / PX, N / PX);
  mctx.fill(landPath, 'evenodd');
  const alpha = mctx.getImageData(0, 0, N, N).data;
  const d = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) d[i] = alpha[i * 4 + 3] > 127 ? 0 : 1e9;
  const pass = (y0, y1, dy, x0, x1, dx) => {
    for (let y = y0; y !== y1; y += dy) for (let x = x0; x !== x1; x += dx) {
      const i = y * N + x;
      const px = x - dx, py = y - dy;
      if (px >= 0 && px < N) d[i] = Math.min(d[i], d[y * N + px] + 1);
      if (py >= 0 && py < N) {
        d[i] = Math.min(d[i], d[py * N + x] + 1);
        if (px >= 0 && px < N) d[i] = Math.min(d[i], d[py * N + px] + 1.414);
        const qx = x + dx;
        if (qx >= 0 && qx < N) d[i] = Math.min(d[i], d[py * N + qx] + 1.414);
      }
    }
  };
  pass(0, N, 1, 0, N, 1);
  pass(N - 1, -1, -1, N - 1, -1, -1);
  const unitsPerCell = cellPx / pxPerUnit;
  return {
    cellPx,
    at(u, v) {
      const x = Math.floor(u / cellPx), y = Math.floor(v / cellPx);
      return x < 0 || y < 0 || x >= N || y >= N ? 0 : d[y * N + x] * unitsPerCell;
    },
  };
}

function drawCompass(ctx, cx, cy, r, font) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ctx.fillStyle = C.magenta;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2.5;
  [1, 0.86].forEach(f => { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, Math.PI * 2); ctx.stroke(); });
  ctx.lineWidth = 2;
  for (let deg = 0; deg < 360; deg += 5) {
    const a = deg * Math.PI / 180, l = deg % 30 ? 0.05 : 0.1;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r * 0.86, -Math.cos(a) * r * 0.86);
    ctx.lineTo(Math.sin(a) * r * (0.86 - l), -Math.cos(a) * r * (0.86 - l));
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(r * 0.09, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(-r * 0.09, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.font = `600 54px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', 0, -r * 1.16);
  ctx.restore();
}

// ---------------------------------------------------------------- 3D: hav, öar, vägar, hus
export function buildMap(map, chartCanvas, renderer) {
  const group = new THREE.Group();
  const H = LAYER.land;
  const flat = (geo, color, order, extra = {}) => {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthWrite: false, side: THREE.DoubleSide, ...extra }));
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };

  // havet (sjökortet)
  const tex = new THREE.CanvasTexture(chartCanvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  flat(new THREE.PlaneGeometry(EXTENT, EXTENT).rotateX(-Math.PI / 2), 0xffffff, -4, { map: tex, side: THREE.FrontSide });

  // öarnas ovansida
  const top = new THREE.ShapeGeometry(map.land.map(toShape)).rotateX(-Math.PI / 2).translate(0, H, 0);
  flat(top, C.land, -3);

  // stigar, vägar och hus
  const lines = (type, width) => (map.roads || []).filter(r => r.type === type).map(r => ribbon(r.points, width, H + LAYER.road));
  const paths = lines('path', M.pathWidth), roads = lines('road', M.roadWidth);
  if (paths.length) flat(merge(paths), C.path, -2);
  if (roads.length) flat(merge(roads), C.ink, -1, { transparent: true, opacity: 0.5 });
  if (map.buildings?.length) {
    const houses = map.buildings.map(b => new THREE.ShapeGeometry(toShape({ outer: b })).rotateX(-Math.PI / 2).translate(0, H + LAYER.building, 0));
    flat(merge(houses), C.ink, -1, { transparent: true, opacity: 0.85 });
  }

  // svart kant runt öarna (gör dem till upphöjda plattor)
  const coast = new THREE.ExtrudeGeometry(map.coast.map(toShape), { depth: H + LAYER.coastTop, bevelEnabled: false, curveSegments: 1 });
  const edge = new THREE.Mesh(coast.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: C.ink }));
  edge.castShadow = true;
  group.add(edge);

  // skuggplan som tar emot boomerangens skugga
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(EXTENT, EXTENT).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.2, depthWrite: false }));
  shadow.position.y = H + LAYER.shadow;
  shadow.receiveShadow = true;
  group.add(shadow);
  return group;
}

function toShape({ outer, holes = [] }) {
  const v = ([x, z]) => new THREE.Vector2(x, -z);
  const shape = new THREE.Shape(outer.map(v));
  holes.forEach(h => shape.holes.push(new THREE.Path(h.map(v))));
  return shape;
}

/** Platt band längs en linje [[x, z], …], för vägar */
function ribbon(points, width, y) {
  const pos = [], idx = [];
  points.forEach(([x, z], i) => {
    const [px, pz] = points[Math.max(0, i - 1)], [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(nx - px, nz - pz) || 1;
    const ox = (-(nz - pz) / len) * width / 2, oz = ((nx - px) / len) * width / 2;
    pos.push(x + ox, y, z + oz, x - ox, y, z - oz);
    if (i < points.length - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function merge(geos) {
  const parts = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const arr = new Float32Array(parts.reduce((n, g) => n + g.attributes.position.array.length, 0));
  let o = 0;
  parts.forEach(g => { arr.set(g.attributes.position.array, o); o += g.attributes.position.array.length; });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return out;
}
