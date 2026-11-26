# Flytt till WordPress (block-tema)

Målet: allt som redaktörer behöver ändra går att ändra i WordPress utan kod. Den statiska sajten är byggd så att flytten mest blir kopiering.

## Vad blir vad

| Statiskt nu | I WordPress | Redigeras i |
| --- | --- | --- |
| `<slug>/index.html`, innehållet i `.page__content` | En WP-sida med samma slug (`anmalan`, `under-lagret/mat` …). Innehållet är redan core-block-HTML. Klistra in i kodredigeraren eller kör "Konvertera till block". | Sidor › redigera |
| `<h1 class="page__title">` + `.page__lead` | Sidans titel + utdrag (eller ett stycke-block överst). | Sidor |
| Sidhuvud (`.site-header`) | Template part `header.html` med samma markup och `data-site` som pekar på REST (se nedan). | Utseende › Redigerare |
| Meny (`data/site.json` → `menu`) | `register_nav_menus(['primary'])` i temat. En REST-route `/wp-json/vassaro/v1/site` returnerar samma JSON-format som `site.json`, byggt från `wp_get_nav_menu_items()` (föräldrar → `children`). `js/site.js` behöver då inte ändras. | Utseende › Menyer |
| Sidfot (`site.json` → `footer`) | Antingen samma REST-route (fält på en inställningssida), eller en template part `footer.html` med vanliga block. Då är `[data-site-footer]` inte tom och `site.js` låter den vara. | Inställningar › Boomerang, eller Utseende › Redigerare |
| `footer.legal` (OSM/ODbL) | Måste finnas kvar, se CLAUDE.md. Kör genom `wp_kses_post`. | — |
| Startsidans `#info` | Block-mönster (pattern) direkt under tur-blocket på startsidan. Rubrik, stycken, knappar, tidslinje och tabell är vanliga block. | Sidor › Startsida |
| Tidslinjen (`is-style-timeline`) | `register_block_style('core/list', ['name' => 'timeline', 'label' => 'Tidslinje'])` | väljs i blockets stilar |
| Faktaruta (`is-style-notice`, `is-urgent`) | `register_block_style('core/group', …)` för "Notis" och "Viktig notis" | blockets stilar |
| Knapp `is-style-cta` | `register_block_style('core/button', …)` "Anmälan" | blockets stilar |
| Frågor (`wp-block-details`) | Core-blocket Detaljer. `js/faq.js` köas bara på FAQ-sidan. | Sidor › Vanliga frågor |
| Lägerbrev (`wp-block-file`) | Core-blocket Fil, ladda upp PDF:en. | Sidor › Lägerbrev |
| Funk-formuläret | Ett formulärtillägg (t.ex. Gravity Forms, som 2025). Den statiska layouten är bara en platshållare. | tillägget |
| Sök (`data/search.json`, `tools/build-search.py`) | Utgår. Använd WP:s sökning: `js/search.js` byts mot ett formulär som skickar `?s=`. | — |
| Brödsmulor, föregående/nästa | Fylls av `site.js` från menyn, fungerar oförändrat. | Menyer |
| Turen | Pluginet `vassaro-tour`, se CLAUDE.md "Nästa steg". | CPT Stopp |

## CSS och JS i temat

Köa `css/base.css`, `css/site.css`, `css/content.css` på alla sidor. På startsidan även `css/style.css` och `css/reduced-motion.css` (från pluginet). `content.css` stylar core-blockens egna klasser, så samma fil fungerar i block-editorn: lägg den också i `add_editor_style()` så redaktörer ser samma utseende när de skriver.

`js/site.js` (modul) på alla sidor med `wp_enqueue_script_module`. Sätt `data-base` till temats URL och `data-site` till REST-routen.
