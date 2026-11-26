// Reducerad rörelse: turen visas som en serie stillbilder i stället för kamerafärder.
//
//   startsida → inflygning → stopp 1 → flygning → stopp 2 → … → tillbaka → slut
//
// Varje segment i tidslinjen får en fast position (u) och kameran står alltid still.
// Bilderna byts med en övertoning (crossfade.js). Skonsamt för den som mår illa av
// rörelse, men berättelsen finns kvar.
// Värden: SETTINGS.reduced.
import { SETTINGS } from './settings.js';
import { locate } from './timeline.js';

export function createReduced(tl, crossfade) {
  const R = SETTINGS.reduced;
  let shown = null;     // u för stillbilden som visas nu
  let pending = null;   // stillbilden som scrollen pekar på
  let still = 0;        // hur länge scrollen har pekat på samma stillbild (sekunder)

  // Stillbilden för ett segment
  function frameOf(seg) {
    const at = seg.type === 'hero' ? 0
      : seg.type === 'end' ? 1
      : seg.type === 'flight' ? (seg.from < 0 ? R.diveAt : R.flightAt)
      : seg.type === 'return' ? R.returnAt
      : 0.5; // stopp: mitt i
    return seg.start + seg.len * at;
  }

  // Vilken stillbild hör till den här scroll-positionen?
  function target(goal) {
    const { seg, t } = locate(tl, goal);
    const isFlight = seg.type === 'flight' || seg.type === 'return';
    if (!isFlight || R.flightFrames) return frameOf(seg);
    // utan flygbilder: närmaste stopp (eller start/slut)
    const i = tl.segs.indexOf(seg);
    return frameOf(tl.segs[t < 0.5 ? i - 1 : i + 1]);
  }

  // Om besökaren slår av/på inställningen medan sidan är öppen: börja om utan övertoning
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    shown = null; pending = null; still = 0;
    crossfade.cancel();
  });

  return {
    // goal = scrollens u. Ger det u som ska visas.
    // render() ritar bilden som syns nu, så den gamla bilden kan fångas vid bytet.
    frameU(goal, dt, render) {
      const want = target(goal);
      if (shown === null) shown = want;

      still = want === pending ? still + dt : 0;
      pending = want;

      // byt först när scrollen vilat och förra övertoningen är klar, så blir det aldrig ryckigt
      if (want !== shown && still >= R.settle && crossfade.done) {
        crossfade.capture(render);
        shown = want;
      }
      crossfade.update(dt);
      return shown;
    },

    // 0..1: pinnar och linjer tonas in i takt med den nya bilden (de finns inte i den gamla bildkopian)
    get overlayIn() { return crossfade.progress; },
  };
}
