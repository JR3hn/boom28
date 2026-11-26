// Sök i menyn. Söker i data/search.json (sidtitlar, rubriker, frågor), som byggs med
// tools/build-search.py. Indexet hämtas först när någon börjar söka.
// I WordPress ersätts detta av WP:s egen sökning.
import { SETTINGS } from './settings.js';

// "mat & cafe" ska hitta "Mat & café": små bokstäver, utan accenter. å/ä/ö behålls som de är.
const norm = s => s.toLowerCase().replace(/[éèêë]/g, 'e').replace(/[áàâ]/g, 'a').trim();

export function createSearch(form, { results, status, nav, index, href, fallback }) {
  const input = form.querySelector('input');
  let entries = null, loading = null;
  const load = () => (loading ||= fetch(index).then(r => r.json()).then(list => {
    entries = list.map(e => ({ ...e, key: norm(e.t) }));
  }).catch(() => { entries = []; }));

  input.addEventListener('focus', load, { once: true });
  input.addEventListener('input', update);

  async function update() {
    const q = norm(input.value);
    if (q.length < SETTINGS.search.minChars) return show(null);
    await load();
    if (norm(input.value) !== q) return; // användaren hann skriva mer
    const words = q.split(/\s+/);
    const hits = entries
      .filter(e => words.every(w => e.key.includes(w)))
      .map(e => ({ e, score: (e.key.startsWith(words[0]) ? 2 : 0) + (e.level === 1 ? 1 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SETTINGS.search.maxResults)
      .map(h => h.e);
    show(hits, input.value.trim());
  }

  function show(hits, q) {
    results.replaceChildren();
    results.hidden = !hits;
    nav.hidden = !!hits;                   // under sökning visas träffarna i menyns ställe
    if (!hits) { status.textContent = ''; return; }
    for (const h of hits) {
      const a = document.createElement('a');
      a.href = href(h.u);
      a.innerHTML = '<span class="menu__hit"></span><span class="menu__where"></span>';
      a.firstChild.textContent = h.t;
      a.lastChild.textContent = h.level === 1 ? 'Sida' : h.p;
      const li = document.createElement('li'); li.append(a); results.append(li);
    }
    if (!hits.length) {
      const li = document.createElement('li');
      li.className = 'menu__empty';
      li.append(`Inga träffar för ”${q}”. Kolla bland `);
      const a = document.createElement('a'); a.href = fallback.href; a.textContent = fallback.label.toLowerCase();
      li.append(a, ' eller sök med ett annat ord.');
      results.append(li);
    }
    status.textContent = hits.length ? `${hits.length} träffar` : 'Inga träffar';
  }

  // Enter = första träffen. Pil upp/ner flyttar mellan träffarna.
  form.addEventListener('submit', e => {
    e.preventDefault();
    results.querySelector('a')?.click();
  });
  form.parentElement.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [input, ...results.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (i < 0 || links.length < 2) return;
    e.preventDefault();
    links[(i + (e.key === 'ArrowDown' ? 1 : links.length - 1)) % links.length].focus();
  });
}
