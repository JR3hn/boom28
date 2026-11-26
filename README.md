# Vässarö boomerangtur

Scroll-styrd 3D-tur över Vässarö, gjord för vassaro.se. En boomerang svävar på startsidan. När man skrollar dyker den ner genom molnen söder om ön och flyger sedan mellan platserna. Vid varje plats visas ett kort. På slutet flyger den tillbaka upp.

Snurret följer farten (ungefär 1 varv per 5,5 boomeranglängder), så den snurrar inte när den står still.

Bara statiska filer, inget byggsteg. Funkar direkt på GitHub Pages.

## Kör lokalt

```bash
python3 -m http.server 8000
```

Öppna http://localhost:8000. Det går inte via `file://` eftersom sidan hämtar JSON och .glb.

## GitHub Pages

Settings → Pages → Deploy from a branch → `main`, `/ (root)`.

## Lägga till en plats

Lägg till ett objekt i `stops` i `data/tour.json`. Boomerangen flyger i listans ordning. Rutt, pinne, kort, spår och rad i platslistan skapas automatiskt.

Platsen anges på ett av tre sätt:

```json
{ "id": "kapellet", "title": "Kapellet", "place": "Vässarö Kapell", "text": "…" }
{ "id": "badet",    "title": "Badet",    "latlon": [60.2523, 18.6871], "text": "…" }
{ "id": "x",        "title": "X",        "position": [0.31, 2.10], "text": "…" }
```

- `place`: ett namn från OSM-datan, t.ex. `Tunet`, `Djuphamn`, `Storgårn`. Alla namn finns under `places` i `data/vassaro-map.json`.
- `latlon`: koordinater. Öppna sidan med `?edit` och klicka på kartan, då kopieras `"latlon": [...]` till urklipp.
- `position`: interna kartenheter.

Valfria fält:

| Fält | Betydelse |
| --- | --- |
| `coords` | Text i magenta under rubriken |
| `link` | `{ "label": "…", "href": "…" }` |
| `camera` | `{ "distance": 4.2, "pitch": 48, "yaw": 0 }`. Utan den räknas vyn ut från riktningen man kommer in från. |
| `via` | `[[x, z], …]`, mellanpunkter om rutten ska gå en annan väg än den kortaste |

## Justera känslan

Alla värden ligger i `js/settings.js`, grupperade:

| Grupp | Styr |
| --- | --- |
| `scroll` | Hur långt man skrollar för varje del, mjukhet, snäppning |
| `flight` | Hur rakt den flyger mellan stoppen (`bow`), flyghöjd, inflygningens bana |
| `camera` | Synfält, vy vid stopp, drönarkameran, lutning i kurvor |
| `boomerang` | Storlek och lutning i olika lägen |
| `spin` | Varv per boomeranglängd, extra snurr mellan stoppen, tröghet |
| `cards`, `pins` | När korten visas och försvinner, pinnhöjd, ringstorlek |
| `trail` | Strecklängd, mellanrum, hur synlig rutten är i förväg |
| `clouds` | Antal, höjd, placering, storlek, hur långt de glider isär |
| `map` | Dimma, djupsiffror, djupkurva, textstorlekar, kompass |
| `colors` | Färger (samma som CSS-variablerna i `css/style.css`) |
| `layers` | Höjder för platta lager. Ändra bara om något flimrar. |

`?tune` (eller `#tune`) i adressen ger reglage för snurr, drönarkamera och inflygning. "Kopiera inställningar" kopierar värdena så de kan klistras in i `settings.js`.

Pinnarnas och kortens utseende styrs i `css/style.css` (`.pin`, `.card`).

## Byta boomerang

Exportera som .glb (Blender: File → Export → glTF 2.0, glTF Binary). Modellen ska ligga platt med ovansidan uppåt. Lägg den i `assets/` och peka på den i `data/tour.json`:

```json
"boomerang": { "src": "assets/min.glb", "size": 1.0, "rotation": [0, 0, 0], "style": "symbol", "color": "#B0287D", "outline": 0.018 }
```

- `"style": "symbol"` ger platt magenta med svart kontur. `"original"` behåller modellens egna material.
- Modellen skalas och centreras automatiskt. `rotation` (grader) behövs bara om den ligger fel.

## Karta och OpenStreetMap

Kust, vägar, stigar, hus och ortnamn kommer från OpenStreetMap:

```bash
pip install shapely
python3 tools/osm2map.py tools/map.osm data/vassaro-map.json
```

Ny export: openstreetmap.org → Exportera, välj ett område som täcker ön.

Djupsiffrorna är påhittade. De räknas från avståndet till land (`map.depthCurve`) och följer djupkurvorna, men är inte uppmätta. Riktiga djup kräver tillstånd från Sjöfartsverket, därför står det "inte för navigation" i krediten.

### Licens (ODbL)

- Sidan måste visa "© OpenStreetMap-bidragsgivare" med länk till openstreetmap.org/copyright och ange att datan är under ODbL. Det gör `.tour__credit` i `index.html`. Ta inte bort den.
- `data/vassaro-map.json` är härledd från OSM och ska också vara tillgänglig under ODbL, se `data/LICENSE-ODbL.md`.

## Filer

```
index.html            markup (samma som WordPress ska rendera)
css/style.css         stil, färger överst
css/reduced-motion.css stil för reducerad rörelse
data/tour.json        innehåll: stopp, texter, boomerang
data/vassaro-map.json kartdata (ODbL)
js/settings.js        alla justerbara värden
js/main.js            laddar data, bygger scenen, kör loopen
js/poses.js           kamera och boomerang per scroll-position
js/timeline.js        hur scrollen delas upp
js/route.js           rutter på vägarna + flyglinjen
js/chart.js           sjökortet och öarna
js/boomerang.js       laddar modellen
js/clouds.js          molnen
js/trail.js           streckade spåret
js/overlay.js         kort, pinnar, platslista, intro, outro
js/tools.js           ?edit och ?tune
js/reduced.js         reducerad rörelse: stillbilder i stället för kamerafärd
js/crossfade.js       övertoning mellan stillbilderna
js/util.js            hjälpfunktioner
assets/boomerang.glb  placeholder
vendor/three.js       three.js r187 + GLTFLoader
fonts/                Literata, Hanken Grotesk (OFL)
tools/                osm2map.py, map.osm, make-boomerang.py, vendor-entry.js
```

## Tillgänglighet

- `prefers-reduced-motion`: inget snurr, ingen kameraflygning, bara fasta vyer.
- `prefers-reduced-transparency` och `prefers-contrast`: solida kort.
- Utan WebGL visas korten som en lista.
- "Hoppa över turen"-länk för tangentbord.
