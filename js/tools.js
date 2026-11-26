// Utvecklarverktyg:
//   ?edit  klick på kartan kopierar latlon för ett nytt stopp
//   ?tune  reglage för några värden i settings.js (även #tune)
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';

export function setupEdit(canvas, camera, toLatLon) {
  const tip = document.body.appendChild(Object.assign(document.createElement('div'), {
    className: 'edit-tip',
    textContent: 'Redigeringsläge: klicka på kartan för att kopiera en position till tour.json',
  }));
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SETTINGS.layers.land);
  const ray = new THREE.Raycaster(), hit = new THREE.Vector3();
  canvas.style.pointerEvents = 'auto';
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('click', e => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
    if (!ray.ray.intersectPlane(ground, hit)) return;
    const [lat, lon] = toLatLon(hit.x, hit.z);
    const text = `"latlon": [${lat.toFixed(6)}, ${lon.toFixed(6)}]`;
    navigator.clipboard?.writeText(text).catch(() => {});
    tip.textContent = `Kopierat: ${text}`;
  });
}

// [etikett, grupp i SETTINGS, nyckel, min, max, steg]
const TUNE = [
  ['Snurr: boomeranglängder per varv', 'spin', 'lengthsPerRev', 1, 12, 0.5],
  ['Snurr: förstärkning mellan stoppen', 'spin', 'legBoost', 1, 8, 0.1],
  ['Kamera: sidbyte (hur långt åt sidan)', 'camera.chase', 'sway', 0, 1.2, 0.05],
  ['Kamera: avstånd bakom', 'camera.chase', 'back', 0.5, 3, 0.05],
  ['Kamera: höjd över boomerangen', 'camera.chase', 'up', 0.1, 1.5, 0.05],
  ['Inflygning: sidbyte', 'camera.dive', 'sway', 0, 1.5, 0.05],
  ['Inflygning: avstånd bakom', 'camera.dive', 'back', 0.5, 3, 0.05],
];

export function setupTune() {
  const group = path => path.split('.').reduce((o, k) => o[k], SETTINGS);
  const panel = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'tune' }));
  panel.innerHTML = '<p class="tune__title">Justera känslan</p>';
  TUNE.forEach(([label, path, key, min, max, step], n) => {
    const row = panel.appendChild(document.createElement('label'));
    row.className = 'tune__row';
    row.innerHTML = `<span></span><output></output><input type="range" id="tune-${n}" min="${min}" max="${max}" step="${step}">`;
    row.htmlFor = `tune-${n}`;
    row.querySelector('span').textContent = label;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.value = out.textContent = group(path)[key];
    input.addEventListener('input', () => { group(path)[key] = +input.value; out.textContent = input.value; });
  });
  const copy = panel.appendChild(Object.assign(document.createElement('button'), { type: 'button', className: 'tune__copy', textContent: 'Kopiera inställningar' }));
  copy.addEventListener('click', () => {
    const text = TUNE.map(([label, path, key]) => `${path}.${key} = ${group(path)[key]}   // ${label}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => (copy.textContent = 'Kopierat – för in värdena i js/settings.js'), () => console.log(text));
  });
}
