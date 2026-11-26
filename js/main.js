// Startpunkt: laddar data, bygger scenen, kör loopen.
// Värden i settings.js, innehåll i data/tour.json.
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { clamp, lerp } from './util.js';
import { buildTimeline, locate, anchors } from './timeline.js';
import { buildRoadGraph, planRoute, gentleFlight } from './route.js';
import { drawChart, buildMap } from './chart.js';
import { loadBoomerang } from './boomerang.js';
import { buildClouds } from './clouds.js';
import { buildTrail } from './trail.js';
import { createPoses } from './poses.js';
import { createOverlay } from './overlay.js';
import { setupEdit, setupTune } from './tools.js';

const root = document.querySelector('[data-vassaro-tour]');
const base = root.dataset.base || './';
const url = p => (/^(https?:)?\/\//.test(p) || p.startsWith('/') || p.startsWith('data:') ? p : base + p);
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LAND = SETTINGS.layers.land;

init().catch(err => {
  console.error(err);
  root.classList.add('is-static'); // utan WebGL: visa korten som en vanlig lista
});

async function init() {
  // ---------------------------------------------------------------- data
  const tour = await (await fetch(url(root.dataset.tour || 'data/tour.json'))).json();
  const map = await (await fetch(url(tour.map))).json();

  // stoppens position: "position" [x, z], "latlon" [lat, lon] eller "place" (ett namn i OSM-datan)
  const g = map.geo;
  const fromLatLon = ([lat, lon]) => [(lon - g.lon0) * g.mx / g.metersPerUnit, -(lat - g.lat0) * g.mz / g.metersPerUnit];
  const toLatLon = (x, z) => [g.lat0 - z * g.metersPerUnit / g.mz, g.lon0 + x * g.metersPerUnit / g.mx];
  const stops = tour.stops.map(s => {
    const position = s.position || (s.latlon && fromLatLon(s.latlon)) || map.places?.[s.place];
    if (!position) throw new Error(`Stoppet "${s.id}" saknar position, latlon eller place`);
    return { ...s, position };
  });

  // spåret går på vägarna, boomerangen flyger en nästan rak linje ovanför
  const graph = buildRoadGraph(map.roads);
  const roads = stops.map((s, i) => (i ? planRoute(graph, stops[i - 1].position, s.position, s.via) : null));
  const flights = roads.map(r => r && gentleFlight(r, LAND + SETTINGS.flight.height, SETTINGS.flight.bow));
  const tl = buildTimeline(stops, i => roads[i].getLength());

  // ---------------------------------------------------------------- scen
  const stage = root.querySelector('.tour__stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SETTINGS.colors.sea);
  scene.fog = new THREE.Fog(SETTINGS.colors.sea, ...SETTINGS.map.fog);
  const camera = new THREE.PerspectiveCamera(SETTINGS.camera.fov, 1, 0.02, 120);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c9a8, 1.7));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2); // följer boomerangen så skuggan alltid syns
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  await document.fonts.ready; // sjökortets text ritas med sidans typsnitt
  scene.add(buildMap(map, drawChart(map, { skipLabels: stops.map(s => s.title) }), renderer));

  const ringGeo = new THREE.RingGeometry(...SETTINGS.pins.ring, 40).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: SETTINGS.colors.magenta, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  for (const s of stops) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(s.position[0], LAND + SETTINGS.layers.ring, s.position[1]);
    ring.renderOrder = 5;
    scene.add(ring);
  }

  const trail = buildTrail(roads);
  scene.add(...trail.meshes);

  const boomerang = await loadBoomerang(tour.boomerang, url);
  scene.add(boomerang.pivot);

  let portrait = false;
  const poses = createPoses({ stops, flights, tl, isPortrait: () => portrait });
  const { pose } = poses;
  const clouds = buildClouds(poses.divePath());
  scene.add(clouds.group);

  // ---------------------------------------------------------------- scroll
  let vh = innerHeight, vw = innerWidth;
  const track = root.querySelector('.tour__track');
  const tourTop = () => root.getBoundingClientRect().top + scrollY;
  const scrollU = () => clamp((scrollY - tourTop()) / vh, 0, tl.total);
  const scrollToU = u => scrollTo({ top: tourTop() + u * vh, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  const overlay = createOverlay(root, tour, stops, anchors(tl), scrollToU);

  function resize() {
    if (innerWidth !== vw || Math.abs(innerHeight - vh) > 120) { // ignorera mobilens adressfält
      vw = innerWidth; vh = innerHeight;
    }
    track.style.height = `${(tl.total + 1) * vh}px`;
    overlay.layout(vh);
    const W = stage.clientWidth, H = stage.clientHeight;
    portrait = W / H < 0.8;
    camera.fov = portrait ? SETTINGS.camera.fovPortrait : SETTINGS.camera.fov;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
    overlay.resize(W, H);
  }
  resize();
  addEventListener('resize', resize);

  // ---------------------------------------------------------------- loop
  // Kritiskt dämpad fjäder mot scrollen, så bilden inte skjuter förbi.
  const spring = { x: scrollU(), v: 0 };
  const lastBoom = new THREE.Vector3();
  let angle = 0, spinSpeed = 0, speed = 0, time = 0, last = performance.now(), visible = true, fadeTo = null;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; time += dt;
    if (!visible) return;
    const reduce = reducedMotion.matches;
    const u = reduce ? reducedU(scrollU()) : followScroll(scrollU(), dt);

    const { seg, t } = poses.compute(u);
    camera.position.copy(pose.pos);
    camera.lookAt(pose.look);
    camera.updateMatrixWorld(); // måste ske före pinnarna projiceras, annars hoppar de

    // snurr efter faktisk fart, ett varv per `lengthsPerRev` boomeranglängder
    const S = SETTINGS.spin;
    if (dt > 0) speed += (lastBoom.distanceTo(pose.boom) / dt - speed) * (1 - Math.exp(-dt * 10));
    lastBoom.copy(pose.boom);
    const boost = lerp(1, S.legBoost, pose.legBlend);
    const target = reduce ? 0 : Math.min(S.max, (2 * Math.PI * speed * boost) / (pose.scale * boomerang.length * S.lengthsPerRev));
    spinSpeed += (target - spinSpeed) * (1 - Math.exp(-dt * S.response));
    if (spinSpeed < 0.01 && !target) spinSpeed = 0;
    angle += spinSpeed * dt;

    const floating = seg.type === 'hero' || seg.type === 'end';
    boomerang.pivot.position.copy(pose.boom);
    if (floating && !reduce) boomerang.pivot.position.y += Math.sin(time * 1.3) * SETTINGS.boomerang.heroFloat;
    boomerang.pivot.scale.setScalar(pose.scale * Math.min(1, 0.85 + time * 0.6)); // liten entré när sidan laddat
    boomerang.tilt.rotation.set(pose.tilt, 0, pose.bank);
    boomerang.spin.rotation.y = -angle;
    sun.position.copy(pose.boom).add(new THREE.Vector3(1.6, 6, 2.2));
    sun.target.position.copy(pose.boom);

    const doneLeg = seg.type === 'hold' ? seg.stop : seg.type === 'flight' ? seg.to - 1 : seg.type === 'hero' ? -1 : Infinity;
    trail.reveal(doneLeg, pose.leg, pose.legS, seg.type !== 'hero');
    clouds.update(pose.cloudsOpen, camera);

    // kartan (pinnar, lista) tonas in under slutet av dyket och ut på väg tillbaka
    const mapVisible = floating ? 0 : seg.type === 'flight' && seg.from < 0 ? clamp((t - 0.55) / 0.2) : seg.type === 'return' ? clamp(1 - t / 0.3) : 1;
    overlay.update({ camera, seg, t, u, dt, reduce, W: stage.clientWidth, H: stage.clientHeight, mapVisible });

    renderer.render(scene, camera);
  }

  function followScroll(goal, dt) {
    const w = (2 * Math.PI) / SETTINGS.scroll.smoothing;
    const steps = Math.ceil(dt * 120), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      spring.v += (w * w * (goal - spring.x) - 2 * w * spring.v) * h;
      spring.x += spring.v * h;
    }
    return spring.x;
  }

  // Reducerad rörelse: hoppa mellan fasta vyer (hero, stopp, slut) med kort övertoning
  let shownU = null;
  function reducedU(goal) {
    spring.x = goal; spring.v = 0;
    const { seg, t } = locate(tl, goal);
    const i = tl.segs.indexOf(seg);
    const view = seg.type === 'flight' || seg.type === 'return' ? tl.segs[t < 0.5 ? i - 1 : i + 1] : seg;
    const want = view.start + view.len / 2;
    if (shownU === null) shownU = want;
    if (want !== shownU && fadeTo === null) {
      fadeTo = want;
      stage.classList.add('is-fading');
      setTimeout(() => { shownU = fadeTo; fadeTo = null; stage.classList.remove('is-fading'); }, 160);
    }
    return shownU;
  }

  root.classList.add('is-ready');
  requestAnimationFrame(frame);
  if (params.has('edit')) setupEdit(renderer.domElement, camera, toLatLon);
  if (params.has('tune') || location.hash === '#tune') setupTune();
  window.vassaroTour = { tour, stops, tl, scrollToU, spin: () => spinSpeed }; // för felsökning i konsolen
}
