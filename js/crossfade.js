// Övertoning mellan två stillbilder av 3D-bilden (används vid reducerad rörelse).
// Den gamla bilden kopieras till en 2D-canvas ovanpå och tonas ut medan den nya redan
// syns under. Det blir aldrig en tom bild emellan, och ingenting flyttar sig.
import { SETTINGS } from './settings.js';
import { clamp, soft } from './util.js';

export function createCrossfade(glCanvas) {
  let snap = null, ctx = null;
  let left = 0; // sekunder kvar av övertoningen

  // Skapas först när den behövs, så sidan utan reducerad rörelse inte får en extra canvas
  function ensureSnap() {
    if (snap) return;
    snap = document.createElement('canvas');
    snap.className = 'tour__snapshot';
    snap.setAttribute('aria-hidden', 'true');
    glCanvas.after(snap); // under overlay, ovanpå 3D-bilden
    ctx = snap.getContext('2d');
  }

  return {
    /** render() ritar den GAMLA vyn. Den kopieras direkt, innan webbläsaren hinner tömma WebGL-bufferten. */
    capture(render) {
      ensureSnap();
      render();
      if (snap.width !== glCanvas.width || snap.height !== glCanvas.height) {
        snap.width = glCanvas.width; snap.height = glCanvas.height;
      }
      ctx.drawImage(glCanvas, 0, 0);
      left = SETTINGS.reduced.fade;
      snap.style.opacity = 1;
    },

    update(dt) {
      if (!snap || left <= 0) return;
      left = Math.max(0, left - dt);
      snap.style.opacity = soft(left / SETTINGS.reduced.fade).toFixed(3);
    },

    /** Avbryt direkt (t.ex. när besökaren slår av reducerad rörelse) */
    cancel() { left = 0; if (snap) snap.style.opacity = 0; },

    /** 0 = övertoningen har just börjat, 1 = klar */
    get progress() { return left > 0 ? clamp(1 - left / SETTINGS.reduced.fade) : 1; },
    get done() { return left <= 0; },
  };
}
