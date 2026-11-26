// Laddar boomerangmodellen (.glb) och ger den sjökortsstilen: platt färg med svart kontur.
// Hierarki: pivot (position) → tilt (lutning) → spin (snurr) → modell (centrerad och normaliserad)
import * as THREE from '../vendor/three.js';
import { SETTINGS } from './settings.js';
import { DEG } from './util.js';

export async function loadBoomerang(opts, url) {
  const loader = new THREE.GLTFLoader();
  const gltf = opts.src.startsWith('data:')
    ? await loader.parseAsync(Uint8Array.from(atob(opts.src.split(',')[1]), c => c.charCodeAt(0)).buffer, '') // inbäddad modell
    : await loader.loadAsync(url(opts.src));

  const model = gltf.scene;
  const [rx, ry, rz] = opts.rotation || [0, 0, 0];
  model.rotation.set(rx * DEG, ry * DEG, rz * DEG);
  model.updateMatrixWorld(true);

  // centrera och skala så att längsta sidan blir `size`, oavsett hur modellen var gjord
  const box = new THREE.Box3().setFromObject(model);
  const norm = (opts.size || 1) / Math.max(...box.getSize(new THREE.Vector3()).toArray());
  model.position.sub(box.getCenter(new THREE.Vector3()));
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.geometry = THREE.mergeVertices(o.geometry.deleteAttribute('normal'), 1e-4); // mjuka normaler
    o.geometry.computeVertexNormals();
  });
  if ((opts.style || 'symbol') === 'symbol') symbolStyle(model, opts, norm);

  const pivot = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group(), holder = new THREE.Group();
  holder.scale.setScalar(norm);
  holder.add(model); spin.add(holder); tilt.add(spin); pivot.add(tilt);
  return { pivot, tilt, spin, length: opts.size || 1 };
}

// Magenta i två toner, svart kontur via inverted hull (större kopia, bara baksidor)
function symbolStyle(model, opts, norm) {
  const steps = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1);
  steps.minFilter = steps.magFilter = THREE.NearestFilter;
  steps.needsUpdate = true;
  const fill = new THREE.MeshToonMaterial({ color: opts.color || SETTINGS.colors.magenta, gradientMap: steps });
  const outline = new THREE.ShaderMaterial({
    uniforms: { width: { value: (opts.outline ?? 0.018) / norm }, color: { value: new THREE.Color(SETTINGS.colors.ink) } },
    vertexShader: 'uniform float width; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * width, 1.0); }',
    fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
    side: THREE.BackSide,
  });
  const meshes = [];
  model.traverse(o => o.isMesh && meshes.push(o));
  meshes.forEach(m => { m.material = fill; m.add(new THREE.Mesh(m.geometry, outline)); });
}
