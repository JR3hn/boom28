// Alla justerbara värden. Ändra, spara, ladda om.
// ?tune i adressen ger reglage för de viktigaste.
//
// Enheter: ön är 10 enheter hög (1 enhet ≈ 250 m). Scroll i skärmhöjder.
// Vinklar i grader om inget annat står.

export const SETTINGS = {

  // ---------------------------------------------------------------- SCROLL
  // Hur mycket man skrollar för varje del (i skärmhöjder).
  scroll: {
    hero: 0.6,          // startsidan innan något händer
    dive: 3.2,          // inflygningen genom molnen ner till första stoppet
    hold: 1.0,          // hur länge boomerangen stannar vid varje stopp
    // mellan två stopp: legBase + vägens längd × legPerUnit, men minst legMin
    legBase: 0.3,
    legPerUnit: 0.65,
    legMin: 1.3,
    return: 2.6,        // tillbakaflygningen norrut upp till himlen på slutet
    end: 0.9,           // slutbilden ("Den kommer alltid tillbaka.")
    smoothing: 0.55,    // sekunder, hur mjukt bilden följer scrollen (lägre = mer direkt)
    snapToStops: true,  // snäpp mjukt till stoppen när man slutar skrolla
  },

  // ---------------------------------------------------------------- FLYGNING
  flight: {
    bow: 0.3,           // mellan stoppen: 0 = helt rak linje, 1 = böjer sig ut till vägens mitt
    height: 0.24,       // flyghöjd över ön mellan stoppen
    // Inflygningens bana [x, höjd, z] från himlen (söder om ön) ner över vattnet.
    // Sista punkten läggs automatiskt vid första stoppet.
    divePath: [
      [0, 7, 13],       // startpunkt = där boomerangen svävar på startsidan
      [0.25, 5.4, 11.3],
      [0.45, 3.6, 9.4], // ungefär här ligger molnen
      [0.55, 1.9, 7.2],
      [0.5, 1.0, 5.0],
    ],
    // punkt strax före första stoppet [öster, höjd, söder], ger bågen in
    diveApproach: [0.45, 0.7, 2.4],
    // Tillbakaflygningen: spegelbild av inflygningen, fortsätter norrut och båge upp i himlen.
    // punkt strax efter sista stoppet [öster, höjd, söder], ger bågen ut
    returnDepart: [0.1, 0.7, -2.4],
    // Bana [x, höjd, z] upp i himlen norr om ön. Sista punkten = där boomerangen svävar på slutet.
    returnPath: [
      [-0.5, 1.0, -5.0],
      [-0.55, 1.9, -7.2],
      [-0.45, 3.6, -9.4],
      [-0.25, 5.4, -11.3],
      [0, 7, -13],
    ],
  },

  // ---------------------------------------------------------------- KAMERA
  camera: {
    fov: 38,            // synfält på dator
    fovPortrait: 50,    // synfält på mobil (stående skärm)
    // Startsidan: kameran tittar på boomerangen i himlen
    hero: { distance: 4.4, pitch: -5.7 },
    // Vid ett stopp (kan överskridas per stopp med "camera" i tour.json)
    stop: { distance: 4.2, pitch: 48, mobileZoomOut: 1.3 },
    // Drönarkameran bakom boomerangen mellan stoppen.
    //   back  = avstånd bakom   up = höjd över   ahead = hur långt fram den tittar
    //   sway  = hur långt åt sidan den driver (byter sida en gång per sträcka)
    //   bob   = liten höjdbåge under sträckan
    chase:       { back: 1.2,  up: 0.45, ahead: 0.9, sway: 0.45, bob: 0.08 },
    chaseMobile: { back: 1.55, up: 0.65, ahead: 0.8, sway: 0.3,  bob: 0.08 },
    // Samma sak under inflygningen genom molnen
    dive:        { back: 1.7,  up: 0.5,  ahead: 1.2, sway: 0.55, bob: 0.1 },
    // Samma sak under tillbakaflygningen upp mot himlen
    climb:       { back: 1.7,  up: 0.5,  ahead: 1.2, sway: 0.55, bob: 0.1 },
    bank: 0.35,         // max lutning i kurvor (radianer)
    // Hur lång tid (i skärmhöjder) kameran tar på sig att zooma ut från och in till ett stopp.
    // Högre = mjukare. Aldrig mer än halva sträckan. Boomerangen bryr sig inte, den lyfter i tid ändå.
    // skyOut/skyIn: samma sak när den lämnar himlen i början och kommer tillbaka dit på slutet.
    zoom: { out: 0.65, in: 0.65, skyOut: 1.1, skyIn: 1.0 },
  },

  // ---------------------------------------------------------------- BOOMERANG
  boomerang: {
    scale: { hero: 1, stop: 0.38, flying: 0.28 }, // storlek på startsidan / vid stopp / i flykt
    tilt:  { hero: 1.15, stop: 0.32, flying: 0.12, diving: 0.25 }, // lutning mot kameran (radianer)
    atStop: { side: 0.3, up: 0.45 },              // var den svävar bredvid pinnen
    heroFloat: 0.05,                              // hur mycket den guppar på startsidan
  },

  // ---------------------------------------------------------------- SNURR
  // Snurret följer boomerangens faktiska fart: ett varv per `lengthsPerRev` boomeranglängder.
  // En riktig boomerang ≈ 5–6. Står den still, står snurret still.
  spin: {
    lengthsPerRev: 5.5,
    legBoost: 3.4,      // extra snurr mellan stoppen (där är den mindre i bild och långsammare)
    response: 3,        // hur fort snurret hinner ikapp farten (lägre = mer tröghet)
    max: 40,            // tak i radianer per sekund
  },

  // ---------------------------------------------------------------- KORT & PINNAR
  cards: {
    appearAt: 0.88,     // kortet börjar växa fram när flygningen är så här långt kommen (0–1)
    hideBy: 0.08,       // kortet är borta när nästa flygning kommit så här långt (0–1)
    speed: 12,          // hur snabbt kortet växer/krymper
  },
  pins: {
    height: 0.3,        // pinnens höjd över marken (storlek och färg på symbolen: se .pin i style.css)
    ring: [0.03, 0.042],// inner- och ytterradie på ringen på marken
  },

  // ---------------------------------------------------------------- SPÅR
  trail: {
    dash: 0.05, gap: 0.035, width: 0.022,
    aheadOpacity: 0.28, // hur synlig resten av rutten är i förväg (0 = osynlig)
  },

  // ---------------------------------------------------------------- MOLN
  clouds: {
    count: 16,
    height: [3.1, 5.0],   // från–till höjd
    south: [7.2, 12.7],   // från–till hur långt söder om ön (z)
    spread: 7,            // hur brett öst–väst
    size: [0.45, 1.2],    // från–till storlek
    parting: 0.9,         // hur långt molnen glider isär när boomerangen dyker igenom
    fadeNear: 0.9,        // molnen tonar bort när kameran är så här nära (så bilden aldrig blir grå)
    seed: 11,             // ändra för en annan slumpad molnformation
  },

  // ---------------------------------------------------------------- KARTA
  map: {
    fog: [12, 30],        // dimma från–till avstånd (havet tonar ut mot horisonten)
    soundings: 700,       // antal djupsiffror
    // Illustrativa djup: [avstånd från land i enheter, meter]. Följer djupkurvorna.
    depthCurve: [[0, 0.5], [0.09, 3], [0.2, 6], [0.35, 10], [0.6, 20], [0.97, 30], [2, 41], [5, 52], [12, 60]],
    labelSize: { water: 30, islet: 22, sounding: 26 }, // textstorlek på sjökortet (px i texturen)
    compass: [6.5, 9.2],  // kompassrosens position [x, z]
    roadWidth: 0.016, pathWidth: 0.006,
  },

  // ---------------------------------------------------------------- REDUCERAD RÖRELSE
  // När besökaren valt "minska rörelse" visas turen som stillbilder med övertoning
  // i stället för kamerafärder. Logiken finns i reduced.js och crossfade.js.
  reduced: {
    fade: 0.45,          // sekunder, övertoningen mellan två stillbilder
    settle: 0.12,        // sekunder scrollen måste vila innan bilden byts, så en snabb scroll blir en enda övertoning
    flightFrames: true,  // en stillbild för varje flygning (false = bara startsida, stopp och slut)
    // Var i segmentet stillbilden tas (0–1)
    flightAt: 0.5,       // mellan två stopp: boomerangen i luften, spåret halvritat
    diveAt: 0.8,         // inflygningen: över vattnet med ön i bild
    returnAt: 0.3,       // tillbakaflygningen: på väg ut från sista stoppet
  },

  // ---------------------------------------------------------------- INTRO
  intro: {
    fadeBy: 0.35,        // hint och "Hoppa till info" är borta när turen kommit så här långt (0–1)
    jumpTime: 0.8,       // sekunder "Hoppa till info" tar på sig att spola genom turen (reducerad rörelse: vanligt hopp)
    jumpGlide: 3,      // 1 = symmetrisk kurva; högre = toppfarten kommer tidigare och inbromsningen blir längre och mjukare
    jumpSpin: 10,        // tak för snurret (rad/s) under spolningen, så boomerangen inte går bananas av farten
  },

  // ---------------------------------------------------------------- MENY (alla sidor, js/menu.js)
  // Fjädrar anges som Apple gör: damping (1 = ingen studs, lägre = studs) och response (sekunder, lägre = snabbare).
  menu: {
    sideAt: 720,         // px: från den här fönsterbredden blir menyn en sidopanel, under den ett ark nerifrån
    open:  { damping: 1.0, response: 0.38 },  // öppna/stäng med knappen
    flick: { damping: 0.85, response: 0.32 }, // när man släpper arket efter ett drag
    closeBelow: 0.55,    // arket stängs om det skulle landa mindre öppet än så (farten räknas med)
    deceleration: 0.998, // hur långt ett snärt kastar arket, som när en scroll bromsar in
    dragSlop: 6,         // px rörelse innan ett drag räknas (annars är det ett klick)
    rubber: 0.55,        // motstånd när man drar arket uppåt förbi helt öppet
    reducedFade: 0.2,    // sekunder, övertoning i stället för glidning vid reducerad rörelse
  },

  // ---------------------------------------------------------------- SÖK (js/search.js)
  search: {
    minChars: 2,         // så många tecken innan sökningen börjar
    maxResults: 8,
  },

  // ---------------------------------------------------------------- UTSEENDE
  // De flesta färgerna finns också som CSS-variabler i css/base.css, så håll dem lika.
  // Accent är undantaget: ändra den bara här. js/site.js skickar den vidare till CSS (--accent),
  // och den färgar pinnar, spår, ringar, knappar, länkar, menyn och boomerangen (om tour.json inte säger annat).
  colors: {
    sea: '#F3F6F4', d20: '#E9F2F2', d10: '#DDEDF1', d6: '#C9E3EE', d3: '#AFD5E7',
    land: '#F2DC8A', ink: '#14202B', contour: '#7FA3B8', path: '#B39A62',
    accent: '#2a4c6c',  // accentfärgen för hela sajten, #14202B
    cloud: '#FFFFFF', cloudShade: '#D6E2E7',
  },

  // Höjder för platta lager. Två ytor på samma höjd flimrar.
  layers: { land: 0.018, coastTop: 0.002, road: 0.001, building: 0.002, trail: 0.008, ring: 0.012, shadow: 0.016 },
};
