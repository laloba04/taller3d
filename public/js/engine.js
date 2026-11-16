/* Taller 3D — trabajos pesados: generar un modelo, hacer su miniatura y preparar la descarga.
   Se ejecutan dentro del Web Worker (worker.js) y, si el navegador no puede usar el worker, en la propia página. */
'use strict';
const JOBS = (() => {
const { MODELS } = CAT;

async function fontsFor(m, v) {
  const ids = new Set(['montserrat']); for (const p of m.params) if (p.type === 'font') ids.add(v[p.k]);
  await Promise.all([...ids].map(id => K.loadFont(K.font(id))));
}
/* resultado del generador → piezas con malla (una por color/capa) */
function toParts(r) {
  const parts = [];
  for (const L of r.layers) {
    if (L.mesh) { if (L.mesh.idx.length) parts.push({ name: L.name, color: L.color, mesh: L.mesh, ...(L.plate ? { plate: L.plate } : {}) }); continue; }
    if (!L.mask || !K.count(L.mask) || L.z1 <= L.z0) continue;
    const mesh = K.meshFromMasksOk(r.F, L);
    if (mesh.idx.length) parts.push({ name: L.name, color: L.color, mesh, z0: L.z0, z1: L.z1 });
  }
  return parts;
}
/* mallas en arrays tipados (se pasan del worker a la página sin copiar) */
function pack(parts) { return parts.map(p => ({ ...p, mesh: { pos: Float32Array.from(p.mesh.pos), idx: Uint32Array.from(p.mesh.idx) } })); }

async function gen({ id, values }) {
  const m = MODELS[id]; if (!m) throw new Error('Modelo desconocido: ' + id);
  await fontsFor(m, values); K.MESH_WARN.n = 0;
  try { const r = m.gen(values); return { parts: pack(toParts(r)), note: r.note || '', csg: K.hasCSG(), warn: K.MESH_WARN.n }; }
  finally { K.csgFree(); }
}
async function thumb({ id, values }) {
  const m = MODELS[id]; await fontsFor(m, values);
  const old = { ...K.QUALITY }; K.setQuality(260, 2.5);
  try { return K.renderThumb(m.gen(values)); } finally { K.setQuality(old.maxPx, old.res); K.csgFree(); }
}
/* ZIP con STL (una sola malla; unida en un sólido válido si hay Manifold) + 3MF (una pieza por color) + LEEME */
async function zip({ parts, title, base, readme }) {
  const meshes = parts.map(p => p.mesh); const joined = K.unionMeshes(meshes);
  const stl = K.toSTL(joined ? [joined] : meshes); const tmf = await K.to3MF(parts, title);
  const stlInfo = joined ? 'todas las piezas unidas en un único sólido cerrado.' : 'todas las piezas en un mismo archivo (sin unir).';
  const z = new JSZip(); z.file(base + '.stl', stl); z.file(base + '.3mf', tmf);
  /* modelos con placas (termoformado): un 3MF por placa, con sus piezas centradas, listo para laminar */
  const placas = {}; for (const p of parts) if (p.plate) (placas[p.plate] = placas[p.plate] || []).push(p);
  const claves = Object.keys(placas);
  if (claves.length > 1) for (const k of claves) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of placas[k]) { const P = p.mesh.pos; for (let i = 0; i < P.length; i += 3) { if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i]; if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1]; } }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const centradas = placas[k].map(p => { const P = Float32Array.from(p.mesh.pos); for (let i = 0; i < P.length; i += 3) { P[i] -= cx; P[i + 1] -= cy; } return { name: p.name, color: p.color, mesh: { pos: P, idx: p.mesh.idx } }; });
    z.file('placas/' + base + '-placa-' + k + '.3mf', await K.to3MF(centradas, title + ' — ' + k));
  }
  const infoPlacas = claves.length > 1 ? '\nplacas/: un 3MF por placa (' + claves.join(', ') + '), cada uno con sus piezas centradas.\n' : '';
  z.file('LEEME.txt', readme.replace('{STL}', stlInfo) + infoPlacas);
  return { blob: await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }), joined: !!joined };
}
/* comprueba cada pieza (cerrada, volumen, género); lo usan las pruebas */
function check({ parts }) { try { return parts.map(p => ({ name: p.name, ...K.checkMesh(p.mesh) })); } finally { K.csgFree(); } }
return { gen, thumb, zip, check, toParts };
})();
