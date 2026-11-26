// Egen scroll-återställning för startsidan.
// Webbläsaren återställer scrollen (vid omladdning, bakåt, eller #info i adressen) innan main.js har gett
// spåret sin längd. Sidan är då bara en skärm hög, så positionen kläms och man hamnar fel.
// Därför stänger vi av webbläsarens variant, sparar positionen själva och återställer när längden finns.

const KEY = 'vassaro-scroll:' + location.pathname;
const navType = performance.getEntriesByType('navigation')[0]?.type;
const saved = navType === 'reload' || navType === 'back_forward' ? read() : null;

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
addEventListener('pagehide', () => { try { sessionStorage.setItem(KEY, String(scrollY)); } catch {} });

// Anropas när sidan har sin rätta höjd. Sparad position först, annars #hash, annars ingenting (toppen).
export function restoreScroll() {
  if (saved !== null) return scrollTo(0, saved);
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView();
}

function read() {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === null ? null : Number(v);
  } catch { return null; } // sessionStorage kan vara avstängd (privat läge m.m.)
}
