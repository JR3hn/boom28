// Var kameran och boomerangen är vid varje scroll-position.
//
//  hero:     boomerangen svävar i himlen
//  dyk:      ner genom molnen söder om ön, över vattnet, båge in till första stoppet
//  stopp:    kameran snett ovanför pinnen, boomerangen bredvid
//  sträcka:  nästan rak flygning till nästa stopp, kameran bakom
//  tillbaka: båge ut, vidare norrut och upp i himlen (dyket baklänges)
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { clamp, lerp, ease, soft, DEG, UP, vec } from './util.js';
import { locate } from './timeline.js';

const CAM = SETTINGS.camera, B = SETTINGS.boomerang, LAND = SETTINGS.layers.land;

export function createPoses({ stops, flights, tl, isPortrait }) {
  const HERO = { T: vec(SETTINGS.flight.divePath[0]), D: CAM.hero.distance, pitch: CAM.hero.pitch * DEG, yaw: 0 };

  // ------------------------------------------------ grundvyer
  // Kamera runt punkt T: avstånd D, lutning pitch, riktning yaw (0 = norr uppåt)
  function orbit({ T, D, pitch, yaw }) {
    const pos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    return { pos: pos.multiplyScalar(D).add(T), look: T.clone() };
  }
  const heroView = () => ({ ...orbit(HERO), boom: HERO.T.clone(), ...HERO });
  // Slutbilden: samma inramning som startsidan, men i himlen norr om ön (kameran bakom, tittar norrut)
  const RP = SETTINGS.flight.returnPath, END = { ...HERO, T: vec(RP[RP.length - 1]) };
  const endView = () => ({ ...orbit(END), boom: END.T.clone(), ...END });

  // Stoppvyn tittar åt samma håll som man kom in från, om inte camera.yaw finns i tour.json
  const facing = tan => Math.atan2(-tan.x, -tan.z);
  function stopYaw(i) {
    if (stops[i].camera?.yaw != null) return stops[i].camera.yaw * DEG;
    if (flights[i]) return facing(flights[i].getTangentAt(0.98));
    if (flights[i + 1]) return facing(flights[i + 1].getTangentAt(0.02));
    return 0;
  }
  function stopView(i) {
    const c = stops[i].camera || {}, mobile = isPortrait();
    const D = (c.distance ?? CAM.stop.distance) * (mobile ? CAM.stop.mobileZoomOut : 1);
    const yaw = stopYaw(i), pitch = (c.pitch ?? CAM.stop.pitch) * DEG;
    const P = new THREE.Vector3(stops[i].position[0], LAND, stops[i].position[1]);
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    // dator: pinnen lite till vänster (kortet får plats till höger). mobil: pinnen i övre delen (kortet nedtill)
    const T = mobile ? P.clone().addScaledVector(forward, -D * 0.16) : P.clone().addScaledVector(right, D * 0.13);
    T.y = LAND + SETTINGS.pins.height * 0.6;
    const boom = P.clone().addScaledVector(right, -B.atStop.side * (mobile ? 0.73 : 1)).addScaledVector(UP, B.atStop.up);
    return { ...orbit({ T, D, pitch, yaw }), boom, T, D, pitch, yaw };
  }

  // ------------------------------------------------ inflygningens bana
  let dive = null, diveFor = null;
  function divePath() {
    if (dive && diveFor === isPortrait()) return dive;
    const [x, z] = stops[0].position, [ax, ay, az] = SETTINGS.flight.diveApproach;
    const pts = [...SETTINGS.flight.divePath.map(vec), new THREE.Vector3(x + ax, LAND + ay, z + az), stopView(0).boom];
    diveFor = isPortrait();
    return (dive = new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }

  // ------------------------------------------------ tillbakaflygningens bana
  // Som dyket baklänges: båge ut från sista stoppet, vidare norrut och upp i himlen
  let climb = null, climbFor = null;
  function climbPath() {
    if (climb && climbFor === isPortrait()) return climb;
    const last = stops.length - 1, [x, z] = stops[last].position, [ax, ay, az] = SETTINGS.flight.returnDepart;
    const pts = [stopView(last).boom, new THREE.Vector3(x + ax, LAND + ay, z + az), ...RP.map(vec)];
    climbFor = isPortrait();
    return (climb = new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }

  // ------------------------------------------------ drönarkameran
  // Bakom boomerangen vid s (0..1) längs kurvan. `side` = sidan kameran börjar på (+1/−1).
  // Byter sida en gång per sträcka. Fler byten blir rörigt.
  function droneView(curve, s, f, flat, side) {
    const p = curve.getPointAt(clamp(s));
    const tan = new THREE.Vector3();
    for (const o of [-0.02, 0, 0.02, 0.05, 0.08]) tan.add(curve.getTangentAt(clamp(s + o))); // utjämnad riktning
    tan.normalize();
    const level = tan.clone().setY(0).normalize();
    const right = new THREE.Vector3(-level.z, 0, level.x);
    const sway = f.sway * side * Math.cos(Math.PI * ease(clamp(s)));
    const back = flat ? level : tan;
    const pos = p.clone().addScaledVector(back, -f.back).addScaledVector(UP, f.up + f.bob * Math.sin(Math.PI * s)).addScaledVector(right, sway);
    const look = p.clone().addScaledVector(back, f.ahead).addScaledVector(right, sway * 0.25);
    if (flat) look.y = LAND + 0.05;
    const next = curve.getTangentAt(clamp(s + 0.05));
    const bank = clamp((tan.x * next.z - tan.z * next.x) * 4, -CAM.bank, CAM.bank);
    return { pos, look, boom: p, bank };
  }

  // ------------------------------------------------ pose för en scroll-position u
  const pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), boom: new THREE.Vector3(), scale: 1, tilt: 0, bank: 0, cloudsOpen: 0, leg: -1, legS: 0, legBlend: 0 };
  const set = v => { pose.pos.copy(v.pos); pose.look.copy(v.look); pose.boom.copy(v.boom); };
  // eCam styr kameran, eBoom boomerangen. Då kan kameran zooma långsammare utan att boomerangen flyttar sig senare.
  const blend = (v, eCam, eBoom = eCam) => { pose.pos.lerp(v.pos, eCam); pose.look.lerp(v.look, eCam); pose.boom.lerp(v.boom, eBoom); };
  // Kamerans övergång i början / slutet av ett segment: längd i skärmhöjder, högst halva segmentet
  const zoomOut = (seg, t, len = CAM.zoom.out) => ease(clamp(t / Math.min(0.5, len / seg.len)));
  const zoomIn = (seg, t, len = CAM.zoom.in) => ease(clamp(1 - (1 - t) / Math.min(0.5, len / seg.len)));
  const firstHold = tl.segs.find(s => s.type === 'hold');

  function compute(u) {
    const { seg, t } = locate(tl, u);
    Object.assign(pose, { bank: 0, leg: -1, legBlend: 0, cloudsOpen: u >= firstHold.start ? 1 : 0 });

    if (seg.type === 'hero' || seg.type === 'end') {
      set(seg.type === 'hero' ? heroView() : endView());
      Object.assign(pose, { scale: B.scale.hero, tilt: B.tilt.hero });

    } else if (seg.type === 'hold') {
      set(stopView(seg.stop));
      Object.assign(pose, { scale: B.scale.stop, tilt: B.tilt.stop });

    } else if (seg.type === 'flight' && seg.from < 0) { // dyket
      const s = soft(clamp((t - 0.03) / 0.88));
      const drone = droneView(divePath(), s, CAM.dive, false, 1);
      const start = ease(clamp(t / 0.14)), land = ease(clamp((t - 0.86) / 0.14));
      set(heroView()); blend(drone, zoomOut(seg, t, CAM.zoom.skyOut), start); blend(stopView(0), zoomIn(seg, t), land);
      pose.scale = lerp(lerp(B.scale.hero, B.scale.flying, ease(clamp(s / 0.45))), B.scale.stop, land);
      pose.tilt = lerp(lerp(B.tilt.hero, B.tilt.diving, ease(clamp(s / 0.3))), B.tilt.stop, land);
      pose.bank = drone.bank * start * (1 - land);
      pose.cloudsOpen = clamp((s - 0.12) / 0.25);

    } else if (seg.type === 'flight') { // sträcka mellan två stopp
      const s = soft(clamp((t - 0.08) / 0.84));
      const f = isPortrait() ? CAM.chaseMobile : CAM.chase;
      const drone = droneView(flights[seg.to], s, f, true, seg.to % 2 ? -1 : 1); // varannan sträcka börjar på andra sidan
      const lift = ease(clamp(t / 0.18)), land = ease(clamp((t - 0.82) / 0.18));
      set(stopView(seg.from)); blend(drone, zoomOut(seg, t), lift); blend(stopView(seg.to), zoomIn(seg, t), land);
      pose.scale = lerp(lerp(B.scale.stop, B.scale.flying, lift), B.scale.stop, land);
      pose.tilt = lerp(lerp(B.tilt.stop, B.tilt.flying, lift), B.tilt.stop, land);
      pose.bank = drone.bank * lift * (1 - land);
      Object.assign(pose, { leg: seg.to, legS: s, legBlend: lift * (1 - land) });

    } else { // tillbaka: norrut och upp i himlen (dyket baklänges)
      const s = soft(clamp((t - 0.09) / 0.88));
      const drone = droneView(climbPath(), s, CAM.climb, false, -1);
      const lift = ease(clamp(t / 0.14)), arrive = ease(clamp((t - 0.86) / 0.14));
      set(stopView(seg.from)); blend(drone, zoomOut(seg, t), lift); blend(endView(), zoomIn(seg, t, CAM.zoom.skyIn), arrive);
      pose.scale = lerp(lerp(B.scale.stop, B.scale.flying, lift), B.scale.hero, ease(clamp((s - 0.55) / 0.45)));
      pose.tilt = lerp(lerp(B.tilt.stop, B.tilt.diving, lift), B.tilt.hero, ease(clamp((s - 0.7) / 0.3)));
      pose.bank = drone.bank * lift * (1 - arrive);
    }
    return { seg, t };
  }

  return { pose, compute, divePath };
}
