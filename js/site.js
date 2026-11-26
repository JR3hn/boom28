// Det som finns på alla sidor: meny-knappen, menyarket, brödsmulor, föregående/nästa och sidfoten.
//
// Innehållet kommer från data/site.json. Precis som med tour.json är JSON:en kontraktet,
// så WordPress kan senare leverera samma format från en REST-endpoint.
// Bara TOMMA platser fylls. Ett tema som redan skrivit ut markupen server-side får behålla sin.
// Laddar inte three.js.
import { createMenu } from './menu.js';
import { createSearch } from './search.js';
import { SETTINGS } from './settings.js';

// Accentfärgen bestäms i settings.js och skickas till CSS här, så den ändras på ett enda ställe.
// Ljusare/svagare varianter (hover, streck, tonade bakgrunder) räknas fram i css/base.css.
document.documentElement.style.setProperty('--accent', SETTINGS.colors.accent);

const header = document.querySelector('[data-site-header]');
const base = header?.dataset.base || './';
// samma regel som turens url(): relativa sökvägar utgår från data-base
const url = p => (/^([a-z]+:|\/\/|\/|#)/i.test(p) ? p : base + p);
// jämför sidor på sökväg, så att "faq/", "faq/index.html" och "../faq/" blir samma
const pathOf = href => new URL(href, location.href).pathname.replace(/index\.html$/, '');
const here = pathOf(location.href);
const isHere = href => pathOf(url(href)) === here;

// Liten hjälpare: el('a', { class: 'x', href: '#' }, 'text', annatEl)
function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) node.setAttribute(k, v === true ? '' : v);
  node.append(...kids.flat().filter(k => k != null));
  return node;
}
const icon = d => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  return svg;
};
const ICON = { menu: 'M4 8h16M4 16h16', close: 'M6 6l12 12M18 6L6 18' };

if (header) {
  watchHeaderFade();
  init().catch(err => console.error('site.json kunde inte laddas', err));
}

// Startsidan: sidhuvudet får sin dimma först när vanlig text (data-header-fade) skrollar in under det.
// Över 3D-turen ska sidhuvudet vara helt genomskinligt.
function watchHeaderFade() {
  const targets = document.querySelectorAll('[data-header-fade]');
  if (!targets.length) return;
  const under = new Set();
  // rootMargin gör roten till en tunn remsa högst upp i fönstret, där sidhuvudet ligger
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? under.add(e.target) : under.delete(e.target);
    header.classList.toggle('has-fade', under.size > 0);
  }, { rootMargin: '0px 0px -95% 0px' });
  targets.forEach(t => io.observe(t));
}

async function init() {
  const site = await (await fetch(url(header.dataset.site || 'data/site.json'))).json();
  const trigger = renderHeader(site);
  const dialog = renderMenu(site);
  document.body.append(dialog);
  createMenu(dialog, trigger);
  createSearch(dialog.querySelector('.menu__search'), {
    results: dialog.querySelector('.menu__results'),
    status: dialog.querySelector('.menu__status'),
    nav: dialog.querySelector('.menu__nav'),
    index: url(site.search),
    href: url,
    fallback: { label: 'Vanliga frågor', href: url('faq/') },
  });
  renderCrumbs(site);
  renderPager(site);
  renderFooter(site);
}

// ---------------------------------------------------------------- sidhuvud
// Glaspillret uppe till höger: Anmälan + Meny. Samma på alla skärmstorlekar.
function renderHeader(site) {
  const trigger = el('button', {
    class: 'site-pill__menu', type: 'button',
    'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'site-menu',
  }, icon(ICON.menu), el('span', {}, 'Meny'));
  let pill = header.querySelector('.site-pill');
  if (!pill) {
    pill = el('div', { class: 'site-pill' },
      el('a', { class: 'site-pill__cta', href: url(site.cta.href), 'aria-current': isHere(site.cta.href) ? 'page' : null }, site.cta.label),
      trigger);
    header.append(pill);
  } else {
    pill.querySelector('.site-pill__menu')?.replaceWith(trigger);
  }
  return trigger;
}

// ---------------------------------------------------------------- menyarket
// <dialog> ger fokusfälla, Esc och "inert" på resten av sidan gratis. Rörelsen sköter menu.js.
function renderMenu(site) {
  const link = (item, cls) => el('a', { class: cls, href: url(item.href), 'aria-current': isHere(item.href) ? 'page' : null }, item.label);
  const groups = site.menu.map(item => el('li', {
    class: 'menu__group' + ([item, ...(item.children || [])].some(i => isHere(i.href)) ? ' is-here' : ''),
  },
    link(item, 'menu__link'),
    item.children?.length ? el('ul', { class: 'menu__sub' }, item.children.map(c => el('li', {}, link(c, 'menu__sublink')))) : null,
  ));

  return el('dialog', { class: 'menu', id: 'site-menu', 'aria-label': 'Meny' },
    el('div', { class: 'menu__scrim', 'data-close': true }),
    el('div', { class: 'menu__panel' },
      el('div', { class: 'menu__grab', 'data-drag': true, 'aria-hidden': 'true' }),
      el('div', { class: 'menu__head', 'data-drag': true },
        el('a', { class: 'menu__home', href: url(site.home.href), 'aria-current': isHere(site.home.href) ? 'page' : null }, site.name),
        el('button', { class: 'menu__close', type: 'button', 'data-close': true, 'aria-label': 'Stäng menyn', autofocus: true }, icon(ICON.close)),
      ),
      el('form', { class: 'menu__search', role: 'search' },
        el('label', { class: 'visually-hidden', for: 'menu-q' }, 'Sök på webbplatsen'),
        el('input', { id: 'menu-q', type: 'search', placeholder: 'Sök, t.ex. mat eller båt', autocomplete: 'off', enterkeyhint: 'search' }),
      ),
      el('p', { class: 'menu__status visually-hidden', 'aria-live': 'polite' }),
      el('ul', { class: 'menu__results', hidden: true }),
      el('nav', { class: 'menu__nav', 'aria-label': 'Huvudmeny' },
        el('ol', { class: 'menu__groups' }, groups),
        el('a', { class: 'menu__info', href: url(site.info.href) }, site.info.label),
      ),
      el('div', { class: 'menu__foot' }, site.footer.groups.find(g => /kontakt/i.test(g.title))?.links.map(l => el('a', { href: l.href }, l.label))),
    ),
  );
}

// ---------------------------------------------------------------- brödsmulor
// Startsida / Grupp / Sida. Hittas genom att leta upp sidan i menyn.
function renderCrumbs(site) {
  const mount = document.querySelector('[data-site-crumbs]');
  if (!mount || mount.children.length) return;
  for (const group of site.menu) {
    const child = group.children?.find(c => isHere(c.href));
    const trail = child ? [site.home, group, child] : isHere(group.href) ? [site.home, group] : null;
    if (!trail) continue;
    mount.append(el('ol', {}, trail.map((t, i) => el('li', {},
      i === trail.length - 1 ? el('span', { 'aria-current': 'page' }, t.label) : el('a', { href: url(t.href) }, t.label)))));
    return;
  }
}

// ---------------------------------------------------------------- föregående / nästa
// Ordningen är menyns ordning, så man kan läsa sig igenom hela webbplatsen.
function renderPager(site) {
  const mount = document.querySelector('[data-site-pager]');
  if (!mount || mount.children.length) return;
  const pages = [];
  for (const g of site.menu) for (const p of [g, ...(g.children || [])]) if (!pages.some(x => x.href === p.href)) pages.push(p);
  const i = pages.findIndex(p => isHere(p.href));
  if (i < 0) return;
  const side = (p, rel, label) => p && el('a', { class: `pager__${rel}`, href: url(p.href), rel },
    el('span', { class: 'pager__dir' }, label), el('span', { class: 'pager__title' }, p.label));
  mount.append(side(pages[i - 1], 'prev', 'Föregående'), side(pages[i + 1], 'next', 'Nästa'));
}

// ---------------------------------------------------------------- sidfot
function renderFooter(site) {
  const mount = document.querySelector('[data-site-footer]');
  if (!mount || mount.children.length) return;
  const f = site.footer;
  const legal = el('p', { class: 'site-footer__legal' });
  legal.innerHTML = f.legal; // betrodd text från site.json (i WordPress: kör den genom wp_kses)
  mount.append(el('div', { class: 'site-footer__inner' },
    el('div', { class: 'site-footer__about' },
      el('a', { class: 'wordmark', href: url(site.home.href) }, site.name.toUpperCase()),
      el('p', {}, f.text)),
    f.groups.map(g => el('section', { class: 'site-footer__group' },
      el('h2', {}, g.title),
      el('ul', {}, g.links.map(l => el('li', {}, el('a', { href: l.href }, l.label)))))),
    legal,
  ));
}
