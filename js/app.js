/* Taller 3D — interfaz y visor */
'use strict';
(() => {
const { MODELS, CATEGORIES } = CAT;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) e.append(c); return e; };
const demoCache = {}; const demo = k => demoCache[k] || (demoCache[k] = K.demoImage(k));
const state = { values: {}, colors: {}, cat: null, model: null, result: null, gen: 0 };

/* ---------- descargas ---------- */
async function saveFile(name, blob) {
  try { const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); return 'Descarga iniciada.'; }
  catch (e) { return 'Este navegador no permite la descarga.'; }
}

/* ---------- navegación ---------- */
function route() {
  const h = location.hash.slice(1);
  if (h.startsWith('m-') && MODELS[h.slice(2)] && !MODELS[h.slice(2)].soon) return openModel(h.slice(2));
  const c = CATEGORIES.find(c => c.id === h); if (c) return openCat(c);
  openHome();
}
function show(id) { for (const v of ['view-home', 'view-cat', 'view-editor']) $('#' + v).classList.toggle('hidden', v !== id); window.scrollTo(0, 0); }
function crumbs(parts) { const c = $('#crumbs'); c.innerHTML = ''; parts.forEach((p, i) => { if (i) c.append(' / '); c.append(p.href ? el('a', { href: p.href }, p.label) : el('span', {}, p.label)); }); }
function openHome() { show('view-home'); crumbs([]); stopViewer(); }
function openCat(c) {
  state.cat = c; show('view-cat'); crumbs([{ label: 'Inicio', href: '#inicio' }, { label: c.name }]); stopViewer();
  $('#cat-title').textContent = c.name; $('#cat-desc').textContent = c.desc; $('#cat-count').textContent = c.models.length + ' modelos';
  const g = $('#cat-models'); g.innerHTML = ''; c.models.forEach(id => g.append(modelCard(MODELS[id])));
  queueThumbs(g);
}
function modelCard(m) {
  if (m.soon) return el('div', { class: 'card soon' }, el('div', { class: 'thumb' }, '⏳'), el('div', { class: 't' }, el('b', {}, m.name), el('span', {}, 'Necesita geometría esculpida; no incluido aún.')));
  const th = el('div', { class: 'thumb', 'data-model': m.id }, '…');
  return el('a', { class: 'card', href: '#m-' + m.id }, th, el('div', { class: 't' }, el('b', {}, m.name), el('span', {}, m.desc)));
}
function renderCats() {
  const g = $('#cats'); CATEGORIES.forEach(c => g.append(el('a', { class: 'card cat', href: '#' + c.id }, el('div', { class: 'thumb' }, c.icon), el('div', { class: 't' }, el('b', {}, c.name), el('span', {}, c.desc), el('small', {}, c.models.filter(id => !MODELS[id].soon).length + ' modelos')))));
  $('#q').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); const r = $('#results'); r.innerHTML = '';
    if (!q) { r.classList.add('hidden'); $('#cats').classList.remove('hidden'); return; }
    const found = Object.values(MODELS).filter(m => (m.name + ' ' + (m.desc || '')).toLowerCase().includes(q)); found.forEach(m => r.append(modelCard(m)));
    if (!found.length) r.append(el('p', { class: 'muted' }, 'Nada con ese nombre.'));
    r.classList.remove('hidden'); $('#cats').classList.add('hidden'); queueThumbs(r); });
}

/* ---------- parámetros ---------- */
function defaults(m) { const v = {}; for (const p of m.params) v[p.k] = p.type === 'img' ? demo(p.demo) : p.def; return v; }
function vals(m) { if (!state.values[m.id]) state.values[m.id] = defaults(m); return state.values[m.id]; }
function numVal(p, v) { return p.type === 'num' ? +v : p.type === 'sel' && typeof p.def === 'number' ? +v : v; }
function buildForm(m) {
  const f = $('#params'); f.innerHTML = ''; const v = vals(m);
  for (const p of m.params) {
    const box = el('div', { class: 'f' + (p.type === 'chk' ? ' chk' : ''), 'data-k': p.k });
    const set = (x) => { v[p.k] = numVal(p, x); refreshVisibility(m); schedule(); };
    if (p.type === 'text') { const i = el('input', { type: 'text', value: v[p.k] ?? '' }); i.addEventListener('input', () => set(i.value)); box.append(el('label', {}, p.label), i); }
    else if (p.type === 'area') { const i = el('textarea', {}); i.value = v[p.k] ?? ''; i.addEventListener('input', () => set(i.value)); box.append(el('label', {}, p.label), i); }
    else if (p.type === 'font') { const s = el('select', {}); for (const fo of K.FONTS) { const o = el('option', { value: fo.id }, fo.name); o.style.fontFamily = `"${fo.fam}"`; s.append(o); } s.value = v[p.k]; s.addEventListener('change', () => set(s.value)); box.append(el('label', {}, p.label), s); }
    else if (p.type === 'sel') { const s = el('select', {}); for (const [k, l] of Object.entries(p.opts)) s.append(el('option', { value: k }, l)); s.value = String(v[p.k]); s.addEventListener('change', () => set(s.value)); box.append(el('label', {}, p.label), s); }
    else if (p.type === 'chk') { const i = el('input', { type: 'checkbox' }); i.checked = !!v[p.k]; i.addEventListener('change', () => set(i.checked)); box.append(el('label', {}, i, p.label)); }
    else if (p.type === 'num') {
      const r = el('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: v[p.k] }); const n = el('input', { type: 'number', min: p.min, max: p.max, step: p.step, value: v[p.k] });
      r.addEventListener('input', () => { n.value = r.value; set(r.value); }); n.addEventListener('change', () => { const x = Math.min(p.max, Math.max(p.min, +n.value || p.def)); n.value = x; r.value = x; set(x); });
      box.append(el('label', {}, p.label, el('em', {}, p.unit ?? 'mm')), el('div', { class: 'row' }, r, n));
    }
    else if (p.type === 'img') {
      const cv = el('canvas', { width: 108, height: 108 }); const draw = () => { const c = cv.getContext('2d'); c.clearRect(0, 0, 108, 108); const im = v[p.k]; const s = Math.min(108 / im.width, 108 / im.height); c.drawImage(im, (108 - im.width * s) / 2, (108 - im.height * s) / 2, im.width * s, im.height * s); }; draw();
      const inp = el('input', { type: 'file', accept: 'image/*' });
      inp.addEventListener('change', () => { const file = inp.files[0]; if (!file) return; const im = new Image(); im.onload = () => { v[p.k] = im; draw(); schedule(); }; im.onerror = () => showErr('No se ha podido leer esa imagen.'); im.src = URL.createObjectURL(file); });
      const reset = el('button', { type: 'button', class: 'ghost' }, 'Ejemplo'); reset.addEventListener('click', () => { v[p.k] = demo(p.demo); draw(); schedule(); });
      box.append(el('label', {}, p.label, el('em', {}, 'PNG transparente o dibujo negro')), el('div', { class: 'img' }, cv, el('label', { class: 'btn' }, 'Subir imagen', inp), reset));
    }
    f.append(box);
  }
  refreshVisibility(m);
}
function refreshVisibility(m) { const v = vals(m); for (const p of m.params) { if (!p.show) continue; const b = $('#params').querySelector(`[data-k="${p.k}"]`); if (b) b.classList.toggle('hidden', !p.show(v)); } }

/* ---------- generación ---------- */
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(regenerate, 280); }
async function runModel(m, v) {
  const fonts = new Set(); for (const p of m.params) if (p.type === 'font') fonts.add(v[p.k]); fonts.add('montserrat');
  await Promise.all([...fonts].map(id => K.loadFont(K.font(id)))); await K.loadFont(K.font('emoji'));
  const r = m.gen(v);
  const parts = [];
  for (const L of r.layers) {
    if (L.mesh) { parts.push({ name: L.name, color: L.color, mesh: L.mesh }); continue; }
    if (!L.mask || !K.count(L.mask) || L.z1 <= L.z0) continue;
    parts.push({ name: L.name, color: L.color, mesh: K.meshFromMasks(r.F, L), z0: L.z0, z1: L.z1 });
  }
  return { parts: parts.filter(p => p.mesh.idx.length), note: r.note };
}
async function regenerate() {
  const m = state.model; if (!m) return; const my = ++state.gen;
  $('#busy').classList.remove('hidden'); hideErr(); await new Promise(r => setTimeout(r, 20));
  try {
    const res = await runModel(m, vals(m)); if (my !== state.gen) return;
    const cols = state.colors[m.id] || (state.colors[m.id] = {});
    res.parts.forEach(p => { if (cols[p.name]) p.color = cols[p.name]; });
    state.result = res; showMeshes(res.parts); renderLayers(res.parts);
    const note = [m.note, res.note].filter(Boolean).join(' '); $('#m-note').textContent = note; $('#m-note').classList.toggle('hidden', !note);
    if (!res.parts.length) showErr('Con estos valores no sale ninguna pieza. Revisa el texto o la imagen.');
  } catch (e) { console.error(e); if (my === state.gen) showErr('No se ha podido generar: ' + (e.message || e)); }
  finally { if (my === state.gen) $('#busy').classList.add('hidden'); }
}
function showErr(t) { $('#err').textContent = t; $('#err').classList.remove('hidden'); }
function hideErr() { $('#err').classList.add('hidden'); }
function renderLayers(parts) {
  const box = $('#layers'); box.innerHTML = ''; const cols = state.colors[state.model.id];
  parts.forEach((p, i) => { const c = el('input', { type: 'color', value: p.color }); c.addEventListener('input', () => { p.color = c.value; cols[p.name] = c.value; meshes[i] && meshes[i].material.color.set(c.value); });
    box.append(el('div', { class: 'layer' }, c, el('span', {}, p.name), el('small', {}, p.z1 !== undefined ? `${p.z0.toFixed(1)}–${p.z1.toFixed(1)} mm` : ''))); });
}
async function download() {
  const r = state.result, m = state.model; if (!r || !r.parts.length) return; const btn = $('#btn-dl'); btn.disabled = true; $('#dl-msg').textContent = 'Preparando archivos…';
  try {
    const v = vals(m); const tag = String(v.texto || v.nombre || v.usuario || v.letra || '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 24);
    const base = m.id + (tag ? '-' + tag : '');
    const stl = K.toSTL(r.parts.map(p => p.mesh)); const tmf = await K.to3MF(r.parts, m.name);
    const z = new JSZip(); z.file(base + '.stl', stl); z.file(base + '.3mf', tmf);
    z.file('LEEME.txt', `${m.name}\nGenerado con Taller 3D.\n\n${base}.3mf: cada capa es una pieza con su color (asígnale filamento en el laminador).\n${base}.stl: todo en una malla.\n\nPiezas:\n` + r.parts.map(p => `- ${p.name}${p.z1 !== undefined ? ` (z ${p.z0}–${p.z1} mm)` : ''}`).join('\n') + '\n');
    const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    $('#dl-msg').textContent = await saveFile(base + '.zip', blob);
  } catch (e) { console.error(e); $('#dl-msg').textContent = 'Error al crear los archivos: ' + (e.message || e); }
  btn.disabled = false;
}

/* ---------- visor three.js ---------- */
let renderer, scene, camera, controls, meshes = [], group, raf = 0, grid;
function initViewer() {
  if (renderer) return;
  const box = $('#viewer'); renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); box.append(renderer.domElement);
  scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(35, 1, 1, 5000); camera.up.set(0, 0, 1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.75)); const d1 = new THREE.DirectionalLight(0xffffff, 0.75); d1.position.set(80, -120, 200); scene.add(d1); const d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-150, 100, 80); scene.add(d2);
  grid = new THREE.GridHelper(400, 40, 0xb8c2c8, 0xcfd6da); grid.rotation.x = Math.PI / 2; scene.add(grid);
  group = new THREE.Group(); scene.add(group);
  controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
  new ResizeObserver(resize).observe(box); resize();
  $('#btn-top').onclick = () => fit(true); $('#btn-iso').onclick = () => fit(false);
}
function resize() { if (!renderer) return; const b = $('#viewer'); const w = b.clientWidth, h = b.clientHeight || 1; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function loop() { raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera); }
function stopViewer() { cancelAnimationFrame(raf); raf = 0; }
function showMeshes(parts) {
  for (const m of meshes) { group.remove(m); m.geometry.dispose(); m.material.dispose(); } meshes = [];
  for (const p of parts) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p.mesh.pos, 3)); g.setIndex(p.mesh.idx); const ng = g.toNonIndexed(); g.dispose(); ng.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.62, metalness: 0.02, flatShading: false }); const mesh = new THREE.Mesh(ng, mat); group.add(mesh); meshes.push(mesh); }
  const bb = new THREE.Box3().setFromObject(group); const s = bb.getSize(new THREE.Vector3());
  $('#dims').textContent = isFinite(s.x) ? `${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)} mm · ${parts.reduce((a, p) => a + p.mesh.idx.length / 3, 0).toLocaleString('es-ES')} triángulos` : '—';
  if (state.refit) { fit(false); state.refit = false; }
}
function fit(top) {
  const bb = new THREE.Box3().setFromObject(group); if (bb.isEmpty()) return; const c = bb.getCenter(new THREE.Vector3()); const s = bb.getSize(new THREE.Vector3()); const r = Math.max(s.x, s.y, s.z * 1.5, 20);
  const dist = r / Math.tan(camera.fov * Math.PI / 360) * 0.75;
  if (top) camera.position.set(c.x, c.y - 0.001, c.z + dist); else camera.position.set(c.x + dist * 0.35, c.y - dist * 0.75, c.z + dist * 0.6);
  controls.target.copy(c); camera.near = dist / 100; camera.far = dist * 20; camera.updateProjectionMatrix(); controls.update();
}
function openModel(id) {
  const m = MODELS[id]; state.model = m; show('view-editor');
  const c = state.cat && state.cat.models.includes(id) ? state.cat : CATEGORIES.find(c => c.models.includes(id));
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: c.name, href: '#' + c.id }, { label: m.name }]);
  $('#m-title').textContent = m.name; $('#m-desc').textContent = m.desc; $('#dl-msg').textContent = '';
  initViewer(); if (!raf) loop(); state.refit = true; resize(); buildForm(m); regenerate();
}

/* ---------- miniaturas (vista superior, baja resolución) ---------- */
const thumbCache = {}; let thumbQ = [], thumbBusy = false;
function queueThumbs(root) { thumbQ = [...root.querySelectorAll('[data-model]')]; if (!thumbBusy) nextThumb(); }
async function nextThumb() {
  const node = thumbQ.shift(); if (!node) { thumbBusy = false; return; } thumbBusy = true;
  const id = node.dataset.model;
  try { if (!thumbCache[id]) thumbCache[id] = await makeThumb(MODELS[id]); node.innerHTML = ''; const cv = el('canvas', { width: 240, height: 180 }); cv.getContext('2d').drawImage(thumbCache[id], 0, 0); node.append(cv); }
  catch (e) { console.warn('miniatura', id, e); node.textContent = '🧩'; }
  setTimeout(nextThumb, 10);
}
async function makeThumb(m) {
  const v = defaults(m); const fonts = new Set(m.params.filter(p => p.type === 'font').map(p => v[p.k])); fonts.add('montserrat');
  await Promise.all([...fonts].map(id => K.loadFont(K.font(id))));
  const old = { ...K.QUALITY }; K.setQuality(260, 2.5); let r; try { r = m.gen(v); } finally { K.setQuality(old.maxPx, old.res); }
  const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180; const x = cv.getContext('2d');
  const items = r.layers.filter(L => L.mask || L.mesh).sort((a, b) => (a.z1 ?? 0) - (b.z1 ?? 0));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const F = r.F;
  for (const L of items) { if (L.mask) { const b = K.bbox(F, L.mask); if (b) { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); } } else { const P = L.mesh.pos; for (let i = 0; i < P.length; i += 3) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y0 = Math.min(y0, -P[i + 1]); y1 = Math.max(y1, -P[i + 1]); } } }
  if (!isFinite(x0)) return cv; const s = Math.min(220 / (x1 - x0), 160 / (y1 - y0)); const ox = 120 - (x0 + x1) / 2 * s, oy = 90 - (y0 + y1) / 2 * s;
  for (const L of items) {
    if (L.mask) { const { w, h } = F; const id = new ImageData(w, h); const col = hex(L.color); const shade = 0.82 + Math.min(0.18, (L.z1 || 0) / 40);
      for (let i = 0; i < L.mask.length; i++) if (L.mask[i]) { id.data[i * 4] = col[0] * shade; id.data[i * 4 + 1] = col[1] * shade; id.data[i * 4 + 2] = col[2] * shade; id.data[i * 4 + 3] = 255; }
      const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(id, 0, 0);
      x.save(); x.shadowColor = 'rgba(0,0,0,.18)'; x.shadowBlur = 3; x.shadowOffsetY = 1; x.imageSmoothingEnabled = true; x.drawImage(t, ox + (-F.W / 2) * s, oy + (-F.H / 2) * s, F.W * s, F.H * s); x.restore(); }
    else { const P = L.mesh.pos, I = L.mesh.idx; const col = hex(L.color); const lx = -0.35, ly = 0.45, lz = 0.82;
      for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
        const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (nz <= 0) continue; const l = Math.hypot(nx, ny, nz);
        const k = 0.55 + 0.45 * Math.max(0, (nx * lx + ny * ly + nz * lz) / l); x.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
        x.beginPath(); x.moveTo(ox + P[a] * s, oy - P[a + 1] * s); x.lineTo(ox + P[b] * s, oy - P[b + 1] * s); x.lineTo(ox + P[c] * s, oy - P[c + 1] * s); x.closePath(); x.fill(); x.strokeStyle = x.fillStyle; x.lineWidth = 0.6; x.stroke(); } }
  }
  return cv;
}
function hex(c) { const n = parseInt(String(c || '#cccccc').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }

$('#btn-dl').addEventListener('click', download);
renderCats(); window.addEventListener('hashchange', route); route();
window.__T3D = { runModel, MODELS, defaults, makeThumb };
})();
