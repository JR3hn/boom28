// Vanliga frågor: filtrera frågorna och öppna den fråga som adressen pekar på (faq/#fraga-id).
// Frågorna är vanliga <details>-block (WordPress: blocket "Detaljer"), så sidan fungerar utan JS.
const content = document.querySelector('.page__content');
const filter = document.querySelector('[data-faq-filter]');
const status = document.querySelector('[data-faq-status]');
const items = [...content.querySelectorAll('details')];

// ---------------------------------------------------------------- djuplänkar
function openFromHash() {
  if (!location.hash) return;
  const details = document.getElementById(decodeURIComponent(location.hash.slice(1)))?.closest('details');
  if (!details) return;
  details.open = true;
  details.scrollIntoView({ block: 'start' });
  details.querySelector('summary').focus({ preventScroll: true });
}
addEventListener('hashchange', openFromHash);
openFromHash();

// ---------------------------------------------------------------- filter
if (filter) {
  filter.hidden = false; // syns bara när JS finns
  const norm = s => s.toLowerCase().trim();
  filter.querySelector('input').addEventListener('input', e => {
    const q = norm(e.target.value);
    let shown = 0;
    for (const d of items) {
      const hit = !q || norm(d.textContent).includes(q);
      d.hidden = !hit;
      if (q && hit) d.open = true;
      if (hit) shown++;
    }
    // dölj rubriker vars alla frågor är borta
    for (const h of content.querySelectorAll('h2')) {
      let n = h.nextElementSibling, any = false;
      while (n && n.tagName !== 'H2') { if (n.matches('details') && !n.hidden) any = true; n = n.nextElementSibling; }
      h.hidden = !!q && !any;
    }
    status.textContent = q ? (shown ? `${shown} frågor matchar` : `Ingen fråga matchar ”${e.target.value.trim()}”.`) : '';
  });
}
