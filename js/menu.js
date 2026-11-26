// Menyarket: öppna, stänga och dra.
//
// Bred skärm: panel som glider in från höger. Smal skärm: ark nerifrån som går att dra ner för att stänga.
// Rörelsen är en fjäder (inte en CSS-transition) så att den alltid fortsätter från där arket
// faktiskt är och med den fart det faktiskt har. Man kan ta tag i arket mitt i en rörelse.
// Reducerad rörelse: bara en kort övertoning, ingenting glider.
import { SETTINGS } from './settings.js';

const S = SETTINGS.menu;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
// Motstånd förbi kanten: ju längre man drar, desto mindre följer arket med (som i iOS)
const rubberband = (over, size) => (over * size * S.rubber) / (size + S.rubber * Math.abs(over));
// Var ett snärt skulle stanna av sig självt (samma inbromsning som scroll), i px
const project = velocity => (velocity / 1000) * S.deceleration / (1 - S.deceleration);

export function createMenu(dialog, trigger) {
  const panel = dialog.querySelector('.menu__panel');
  const scrim = dialog.querySelector('.menu__scrim');
  const side = matchMedia(`(min-width: ${S.sideAt}px)`);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  // p = hur öppet arket är: 0 stängt, 1 öppet. v = fart i p per sekund.
  let p = 0, v = 0, target = 0, spring = S.open, raf = 0, last = 0;
  let size = 1;           // arkets längd i rörelseriktningen (px)
  let afterClose = null;  // t.ex. hoppa till #info när arket väl är stängt

  // ------------------------------------------------------------ rita
  function layout() {
    dialog.classList.toggle('is-side', side.matches);
    dialog.classList.toggle('is-reduced', reduce.matches);
    size = (side.matches ? panel.offsetWidth : panel.offsetHeight) || 1;
  }
  function paint() {
    if (reduce.matches) return; // övertoningen sköts av CSS-klassen is-open
    const off = (1 - p) * size;
    panel.style.transform = side.matches ? `translate3d(${off}px, 0, 0)` : `translate3d(0, ${off}px, 0)`;
    scrim.style.opacity = clamp(p);
  }

  // ------------------------------------------------------------ fjädern
  // Apples två parametrar: damping (studs) och response (snabbhet) → styvhet och dämpning (massa 1).
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const k = (2 * Math.PI / spring.response) ** 2;
    const c = 4 * Math.PI * spring.damping / spring.response;
    for (let i = 0; i < 4; i++) { // små delsteg håller fjädern stabil även vid låg bildfrekvens
      v += (-k * (p - target) - c * v) * dt / 4;
      p += v * dt / 4;
    }
    if (Math.abs(p - target) < 0.0005 && Math.abs(v) < 0.01) {
      p = target; v = 0; raf = 0; paint();
      if (target === 0) finishClose();
      return;
    }
    paint();
    raf = requestAnimationFrame(tick);
  }
  function animateTo(to, cfg, velocity = v) {
    target = to; spring = cfg; v = velocity;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  // ------------------------------------------------------------ öppna / stäng
  function open() {
    if (!dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('has-menu');
      trigger.setAttribute('aria-expanded', 'true');
      layout();
      paint();
    }
    if (reduce.matches) {
      requestAnimationFrame(() => dialog.classList.add('is-open'));
      target = 1;
    } else {
      animateTo(1, S.open); // om arket var på väg att stänga vänder det härifrån
    }
  }
  function close(then) {
    if (!dialog.open) return;
    afterClose = then || null;
    if (reduce.matches) {
      target = 0;
      dialog.classList.remove('is-open');
      setTimeout(() => target === 0 && finishClose(), S.reducedFade * 1000);
    } else {
      animateTo(0, S.open);
    }
  }
  function finishClose() {
    if (!dialog.open) return;
    dialog.close();
    document.documentElement.classList.remove('has-menu');
    trigger.setAttribute('aria-expanded', 'false');
    const next = afterClose; afterClose = null;
    if (next) next(); else trigger.focus({ preventScroll: true });
  }

  trigger.addEventListener('click', () => (dialog.open && target === 1 ? close() : open()));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); }); // Esc: stäng med samma rörelse
  dialog.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return close();
    // Länk till en plats på samma sida (t.ex. #info på startsidan): stäng först, hoppa sedan.
    const a = e.target.closest('a[href]');
    if (!a) return;
    const to = new URL(a.href);
    if (to.hash && to.pathname === location.pathname) {
      e.preventDefault();
      close(() => { history.pushState(null, '', to.hash); document.querySelector(to.hash)?.scrollIntoView(); });
    }
  });
  addEventListener('resize', () => { if (dialog.open) { layout(); paint(); } });

  // ------------------------------------------------------------ dra (bara arket nerifrån)
  let drag = null; // { y, p, moved, history: [{ y, t }] }
  function down(e) {
    if (side.matches || reduce.matches || e.button > 0) return;
    stop(); // ta tag mitt i en rörelse: arket stannar där det är
    drag = { y: e.clientY, p, moved: false, history: [{ y: e.clientY, t: e.timeStamp }] };
  }
  function move(e) {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < S.dragSlop) return;
    // Fånga pekaren först nu. Görs det redan vid pointerdown hamnar klicket på
    // headern i stället för på knappen, och stängknappen slutar fungera.
    if (!drag.moved) e.currentTarget.setPointerCapture(e.pointerId);
    drag.moved = true;
    let next = drag.p - dy / size;
    if (next > 1) next = 1 + rubberband((next - 1) * size, size) / size;
    p = next; paint();
    drag.history.push({ y: e.clientY, t: e.timeStamp });
    if (drag.history.length > 6) drag.history.shift();
  }
  function up(e) {
    if (!drag) return;
    const { moved, history } = drag;
    drag = null;
    if (!moved) { if (p !== target) animateTo(target, S.open, 0); return; }
    // farten de senaste rörelserna, i px/s (positiv = nedåt)
    const a = history[0], b = history[history.length - 1];
    const vy = b.t > a.t ? (b.y - a.y) / ((b.t - a.t) / 1000) : 0;
    const landing = p - project(vy) / size;          // var arket skulle hamna av egen kraft
    const to = landing < S.closeBelow ? 0 : 1;
    animateTo(to, S.flick, -vy / size);              // fortsätt med fingrets fart, ingen skarv
    // ett drag ska inte också räknas som klick på det man släppte över
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    dialog.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => dialog.removeEventListener('click', swallow, { capture: true }), 0);
  }
  for (const handle of dialog.querySelectorAll('[data-drag]')) {
    handle.addEventListener('pointerdown', down);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  return { open, close };
}
