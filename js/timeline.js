// Scroll-tidslinjen: hero → [flygning → stopp] × antal stopp → tillbaka → slut.
// Längderna (i skärmhöjder) kommer från SETTINGS.scroll.
import { SETTINGS } from './settings.js';

/** routeLength(i) = vägens längd till stopp i (för att räkna ut hur mycket scroll sträckan får) */
export function buildTimeline(stops, routeLength) {
  const L = SETTINGS.scroll;
  const segs = [];
  let t = 0;
  const push = (seg, len) => { segs.push({ ...seg, start: t, len }); t += len; };

  push({ type: 'hero' }, L.hero);
  stops.forEach((_, i) => {
    const len = i === 0 ? L.dive : Math.max(L.legMin, L.legBase + routeLength(i) * L.legPerUnit);
    push({ type: 'flight', from: i - 1, to: i }, len); // from -1 = från himlen
    push({ type: 'hold', stop: i }, L.hold);
  });
  push({ type: 'return', from: stops.length - 1 }, L.return);
  push({ type: 'end' }, L.end);
  return { segs, total: t };
}

/** Var på tidslinjen är vi? Ger segmentet och hur långt in i det (t = 0..1). */
export function locate(tl, u) {
  for (const seg of tl.segs) if (u < seg.start + seg.len) return { seg, t: Math.max(0, (u - seg.start) / seg.len) };
  return { seg: tl.segs[tl.segs.length - 1], t: 1 };
}

/** Punkter att snäppa till och hoppa till från platslistan. */
export function anchors(tl) {
  return tl.segs
    .filter(s => s.type === 'hold' || s.type === 'hero' || s.type === 'end')
    .map(s => ({ type: s.type, stop: s.stop, u: s.type === 'hero' ? 0 : s.type === 'end' ? s.start + s.len : s.start + s.len / 2 }));
}
