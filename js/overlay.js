// HTML ovanpå 3D-bilden: kort, pinnar, etiketter, platslista, intro, outro.
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { clamp } from './util.js';

const LAND = SETTINGS.layers.land;

export function createOverlay(root, tour, stops, anchorList, scrollToU) {
  const overlay = root.querySelector('.tour__overlay');
  const hint = root.querySelector('.tour__hint');
  const jump = root.querySelector('.tour__jump');
  const outro = root.querySelector('.tour__outro');
  const rail = root.querySelector('.tour__rail ol');
  const track = root.querySelector('.tour__track');
  const html = (tag, cls, text) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  };

  // intro och outro
  if (hint) hint.textContent = tour.intro?.hint ?? '';
  if (outro) {
    outro.querySelector('h2').textContent = tour.outro.title;
    outro.querySelector('p').textContent = tour.outro.text;
    const a = outro.querySelector('a');
    if (tour.outro.link) Object.assign(a, { textContent: tour.outro.link.label, href: tour.outro.link.href }); else a.remove();
  }

  // pinnar (platta symboler + tunn linje ner till marken) och kort
  const lines = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  lines.setAttribute('class', 'pin-lines');
  lines.setAttribute('aria-hidden', 'true');
  overlay.appendChild(lines);

  const items = stops.map(s => {
    const line = lines.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line'));
    const pin = overlay.appendChild(html('span', 'pin'));
    const label = overlay.appendChild(html('span', 'pin-label', s.title));
    pin.setAttribute('aria-hidden', 'true'); label.setAttribute('aria-hidden', 'true');

    const card = overlay.appendChild(html('article', 'card'));
    card.id = `stopp-${s.id}`;
    card.setAttribute('aria-hidden', 'true');
    card.append(html('h2', 'card__title', s.title));
    if (s.coords) card.append(html('p', 'card__coords', s.coords));
    card.append(html('p', 'card__text', s.text));
    if (s.link) card.append(Object.assign(html('a', 'card__link', s.link.label), { href: s.link.href }));
    return { line, pin, label, card, vis: 0, w: 0, h: 0 };
  });

  // platslistan och snäpp-punkter
  const railButtons = [];
  for (const a of anchorList) {
    if (SETTINGS.scroll.snapToStops) track.appendChild(html('div', 'tour__snap')).dataset.u = a.u;
    if (a.type !== 'hold' || !rail) continue;
    const b = html('button');
    b.type = 'button';
    b.append(html('span', 'rail__dot'), html('span', 'rail__name', stops[a.stop].title));
    b.addEventListener('click', () => scrollToU(a.u));
    rail.appendChild(html('li')).appendChild(b);
    railButtons.push({ b, stop: a.stop });
  }

  // Målsynlighet 0..1 för kortet till stopp i
  const C = SETTINGS.cards;
  function cardTarget(i, seg, t) {
    if (seg.type === 'hold') return seg.stop === i ? 1 : 0;
    if (seg.type === 'flight' && seg.to === i) return clamp((t - C.appearAt) / (1 - C.appearAt));
    if ((seg.type === 'flight' || seg.type === 'return') && seg.from === i) return clamp(1 - t / C.hideBy);
    return 0;
  }

  const head = new THREE.Vector3(), foot = new THREE.Vector3();
  return {
    layout(vh) { track.querySelectorAll('.tour__snap').forEach(m => (m.style.top = `${m.dataset.u * vh}px`)); },
    resize(W, H) { lines.setAttribute('viewBox', `0 0 ${W} ${H}`); items.forEach(it => (it.w = 0)); },

    update({ camera, seg, t, u, dt, reduce, W, H, mapVisible }) {
      const narrow = W < 640;
      items.forEach((it, i) => {
        // reducerad rörelse: kortet tonas in i takt med den nya stillbilden (mapVisible), och växer inte
        const goal = cardTarget(i, seg, t) * (reduce ? mapVisible : 1);
        it.vis += (goal - it.vis) * (1 - Math.exp(-dt * C.speed));
        const grow = reduce ? 1 : it.vis; // 1 = full storlek direkt, bara opacity ändras
        if (it.vis < 0.002) it.vis = 0;

        // pinnens huvud och fot på skärmen (foten i samma höjd som ringen på marken)
        const [x, z] = stops[i].position;
        head.set(x, LAND + SETTINGS.pins.height, z).project(camera);
        foot.set(x, LAND + SETTINGS.layers.ring, z).project(camera);
        const sx = (head.x + 1) / 2 * W, sy = (1 - head.y) / 2 * H;
        const fx = (foot.x + 1) / 2 * W, fy = (1 - foot.y) / 2 * H;
        const onScreen = head.z < 1 && foot.z < 1 && sx > -60 && sx < W + 60 && sy > -60 && sy < H + 60;
        const opacity = onScreen ? mapVisible : 0;

        it.pin.style.opacity = it.line.style.opacity = opacity;
        it.pin.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${1 + 0.3 * (reduce ? 0 : it.vis)})`;
        it.pin.classList.toggle('is-active', it.vis > 0.5);
        it.line.setAttribute('x1', sx); it.line.setAttribute('y1', sy);
        it.line.setAttribute('x2', fx); it.line.setAttribute('y2', fy);
        it.label.style.opacity = opacity * (1 - it.vis);
        it.label.style.transform = `translate(${sx + 14}px, ${sy - 9}px)`;

        // kortet växer fram ur pinnen
        const card = it.card;
        card.style.visibility = it.vis > 0 ? 'visible' : 'hidden';
        card.setAttribute('aria-hidden', String(it.vis <= 0.5));
        card.classList.toggle('is-active', it.vis > 0.5);
        if (!it.vis) return;
        if (!it.w) { it.w = card.offsetWidth; it.h = card.offsetHeight; }
        let cx, cy, ox, oy;
        if (narrow) {             // mobil: dockat längst ner, ovanför OSM-krediten
          cx = 12; cy = H - it.h - 44;
          ox = clamp(sx - cx, 20, it.w - 20); oy = 0;
        } else {                  // dator: bredvid pinnen, till höger om det får plats
          const right = sx + 30 + it.w < W - 24;
          cx = right ? sx + 30 : sx - 30 - it.w;
          cy = clamp(sy - it.h * 0.35, 24, H - it.h - 24);
          ox = right ? 0 : it.w; oy = clamp(sy - cy, 0, it.h);
        }
        card.style.transformOrigin = `${ox}px ${oy}px`;
        card.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${0.82 + 0.18 * grow})`;
        card.style.opacity = it.vis;
      });

      railButtons.forEach(r => r.b.classList.toggle('is-current', seg.type === 'hold' && seg.stop === r.stop));
      const intro = clamp(1 - u / SETTINGS.intro.fadeBy);
      if (hint) hint.style.opacity = intro;
      if (jump) { // genvägen tonas med hinten och går inte att träffa när den är borta
        jump.style.opacity = intro;
        jump.style.visibility = intro > 0 ? 'visible' : 'hidden';
      }
      if (outro) {
        const o = seg.type === 'end' ? 1 : seg.type === 'return' ? clamp((t - 0.78) / 0.22) : 0;
        outro.style.opacity = o;
        outro.style.visibility = o > 0 ? 'visible' : 'hidden';
      }
      root.style.setProperty('--map-visible', mapVisible.toFixed(3));
    },
  };
}
