// Rutter längs öns vägar.
//  - planRoute: kortaste vägen mellan två stopp i vägnätet (spåret ritas på den)
//  - gentleFlight: nästan rak flyglinje mellan stoppen (boomerangen flyger den)
import * as THREE from '../vendor/three.js';

const PATH_COST = 1.25; // stigar "kostar" lite mer än vägar, så rutten föredrar vägar

// Bygger en graf av alla vägar: map.roads = [{ type: 'road' | 'path', points: [[x, z], …] }]
export function buildRoadGraph(roads = []) {
  const nodes = [];
  const index = new Map();
  const id = ([x, z]) => {
    const key = `${Math.round(x * 1000)},${Math.round(z * 1000)}`; // punkter som ligger på samma ställe slås ihop
    if (!index.has(key)) { index.set(key, nodes.length); nodes.push({ x, z, edges: [] }); }
    return index.get(key);
  };
  for (const road of roads) {
    const cost = road.type === 'path' ? PATH_COST : 1;
    for (let i = 1; i < road.points.length; i++) {
      const a = id(road.points[i - 1]), b = id(road.points[i]);
      if (a === b) continue;
      const w = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z) * cost;
      nodes[a].edges.push({ to: b, w });
      nodes[b].edges.push({ to: a, w });
    }
  }
  return nodes;
}

function nearestNode(nodes, x, z) {
  let best = -1, bestDist = Infinity;
  nodes.forEach((n, i) => {
    const d = Math.hypot(n.x - x, n.z - z);
    if (n.edges.length && d < bestDist) { bestDist = d; best = i; }
  });
  return { i: best, dist: bestDist };
}

// Dijkstra utan prioritetskö. Räcker, vägnätet är litet.
function shortestPath(nodes, from, to) {
  const dist = new Float64Array(nodes.length).fill(Infinity);
  const prev = new Int32Array(nodes.length).fill(-1);
  const done = new Uint8Array(nodes.length);
  dist[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || !isFinite(dist[u]) || u === to) break;
    done[u] = 1;
    for (const e of nodes[u].edges) {
      if (dist[u] + e.w < dist[e.to]) { dist[e.to] = dist[u] + e.w; prev[e.to] = u; }
    }
  }
  if (!isFinite(dist[to])) return null;
  const path = [];
  for (let v = to; v >= 0; v = prev[v]) path.unshift(v);
  return path;
}

// Rutt från a till b ([x, z]) längs vägarna. `via` = egna mellanpunkter. Utan vägar: en mjuk båge.
export function planRoute(graph, a, b, via) {
  const A = new THREE.Vector3(a[0], 0, a[1]), B = new THREE.Vector3(b[0], 0, b[1]);
  let pts;
  if (via?.length) {
    pts = [A, ...via.map(([x, z]) => new THREE.Vector3(x, 0, z)), B];
  } else {
    const na = nearestNode(graph, ...a), nb = nearestNode(graph, ...b);
    const path = na.dist < 0.8 && nb.dist < 0.8 ? shortestPath(graph, na.i, nb.i) : null;
    pts = path
      ? [A, ...path.map(i => new THREE.Vector3(graph[i].x, 0, graph[i].z)), B]
      : [A, A.clone().lerp(B, 0.5).add(new THREE.Vector3(B.z - A.z, 0, A.x - B.x).multiplyScalar(0.2)), B];
  }
  // ta bort punkter som ligger väldigt tätt, så kurvan blir lugn
  const kept = [pts[0]];
  pts.slice(1, -1).forEach(p => { if (p.distanceTo(kept[kept.length - 1]) >= 0.05) kept.push(p); });
  pts = [...kept, pts[pts.length - 1]];
  if (pts.length < 3) pts.splice(1, 0, pts[0].clone().lerp(pts[pts.length - 1], 0.5));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

// Nästan rak flyglinje: bow = 0 → helt rak, 1 → böjer sig ut till vägens mittpunkt.
export function gentleFlight(route, y, bow) {
  const A = route.getPointAt(0), B = route.getPointAt(1);
  const mid = A.clone().lerp(B, 0.5);
  const through = mid.clone().lerp(route.getPointAt(0.5), bow);
  const control = through.clone().multiplyScalar(2).sub(mid); // så att kurvan passerar `through` på mitten
  [A, control, B].forEach(p => (p.y = y));
  return new THREE.QuadraticBezierCurve3(A, control, B);
}
