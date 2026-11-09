/* Taller 3D — interfaz y visor */
'use strict';
(() => {
const { MODELS, CATEGORIES } = CAT;
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } for (const c of kids) e.append(c); return e; };
const demoCache = {}; const demo = k => demoCache[k] || (demoCache[k] = K.demoImage(k));
const state = { values: {}, colors: {}, cat: null, model: null, result: null, gen: 0 };

/* ---------- motor: Web Worker (segundo plano) o, si no se puede, la propia página ---------- */
const Engine = (() => {
  let worker = null, seq = 0; const wait = new Map(); let local = null;
  const fontCss = (document.querySelector('link[href*="fonts.googleapis"]') || {}).href;
  const call = (op, data) => new Promise((res, rej) => { const id = ++seq; wait.set(id, { res, rej }); worker.postMessage({ id, op, data }); });
  const failAll = (msg) => { for (const p of wait.values()) p.rej(new Error(msg)); wait.clear(); };
  /* modo página: carga Manifold aquí (si se puede) y ejecuta los trabajos directamente */
  function useLocal(why) {
    console.warn('Taller 3D: sin Web Worker (' + why + '); se calcula en la página.');
    if (worker) { worker.terminate(); worker = null; failAll('worker detenido'); }
    return loadLocal();
  }
  function loadLocal() {
    if (local) return local;
    return local = new Promise(res => {
      if (location.protocol === 'file:') return res('local');
      const base = new URL('vendor/manifold/', location.href).href; const sc = document.createElement('script'); sc.src = base + 'manifold.js';
      sc.onload = () => self.ManifoldModule({ locateFile: f => base + f }).then(w => { w.setup(); K.useManifold(w); res('local'); }, () => res('local'));
      sc.onerror = () => res('local'); document.head.append(sc);
    });
  }
  const mode = new Promise(res => {
    if (!window.Worker || location.protocol === 'file:') return res(useLocal('no disponible'));
    try { worker = new Worker('js/worker.js'); } catch (e) { return res(useLocal(e.message)); }
    worker.onmessage = e => { const { id, ok, out, error } = e.data; const p = wait.get(id); if (!p) return; wait.delete(id); ok ? p.res(out) : p.rej(new Error(error)); };
    worker.onerror = e => { e.preventDefault(); failAll('error en el worker'); res(useLocal(e.message || 'error al cargar')); };
    const t = setTimeout(() => res(useLocal('no responde')), 30000);
    call('hello', { fontCss }).then(r => { clearTimeout(t); res(r.ok ? 'worker' : useLocal('sin OffscreenCanvas/FontFace')); }, err => { clearTimeout(t); res(worker ? useLocal(err.message) : loadLocal()); });
  });
  /* las imágenes se pasan al worker como ImageBitmap */
  const bmps = new WeakMap();
  async function prep(m, v) { const o = { ...v }; for (const p of m.params) if (p.type === 'img' && v[p.k]) { if (!bmps.has(v[p.k])) bmps.set(v[p.k], createImageBitmap(v[p.k])); o[p.k] = await bmps.get(v[p.k]); } return o; }
  async function run(op, m, v, extra) {
    if (await mode === 'worker') {
      let data = null; try { data = { id: m && m.id, values: m && await prep(m, v), ...extra }; } catch (e) { console.warn('Imagen no transferible al worker; se calcula en la página.', e); }
      if (data) { try { return await call(op, data); } catch (e) { if (worker) throw e; } }   /* si el worker se cae a mitad, se repite en la página */
    }
    await loadLocal();
    return JOBS[op]({ id: m && m.id, values: v, ...extra });
  }
  return { mode, run, gen: (m, v) => run('gen', m, v), thumb: (m, v) => run('thumb', m, v), zip: (data) => run('zip', null, null, data) };
})();

/* ---------- descargas ---------- */
async function saveFile(name, blob) {
  try { const url = URL.createObjectURL(blob); const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); return 'Descarga iniciada.'; }
  catch (e) { return 'Este navegador no permite la descarga.'; }
}

/* ---------- navegación ---------- */
function route() {
  const h = location.hash.slice(1); setNav(h);
  if (h.startsWith('m-') && MODELS[h.slice(2)] && !MODELS[h.slice(2)].soon) return openModel(h.slice(2));
  const c = CATEGORIES.find(c => c.id === h); if (c) return openCat(c);
  if (h === 'modelos') return openAll(); if (h === 'favoritos') return openFav(); if (h === 'herramientas') return openTools();
  if (h === 'svg') return openSvg(); if (h === 'generador-qr') return openQrTool();
  openHome();
}
function setNav(h) { const map = { modelos: 'modelos', favoritos: 'favoritos', herramientas: 'herramientas', svg: 'herramientas', 'generador-qr': 'herramientas', pruebas: 'herramientas' }; const k = map[h] || (h === '' || h === 'inicio' ? 'inicio' : ''); document.querySelectorAll('.mainnav a').forEach(a => a.classList.toggle('on', a.dataset.nav === k)); }
function show(id) { for (const v of ['view-home', 'view-cat', 'view-page', 'view-editor']) $('#' + v).classList.toggle('hidden', v !== id); window.scrollTo(0, 0); }
/* favoritos (solo en este navegador) */
function favs() { try { return new Set(JSON.parse(localStorage.getItem('t3d-fav') || '[]')); } catch (e) { return new Set(); } }
function toggleFav(id) { const f = favs(); f.has(id) ? f.delete(id) : f.add(id); try { localStorage.setItem('t3d-fav', JSON.stringify([...f])); } catch (e) { } return f.has(id); }
function uniqueModels() { const seen = new Set(), out = []; for (const c of CATEGORIES.filter(c => !c.hidden)) for (const id of c.models) if (!seen.has(id) && MODELS[id] && !MODELS[id].soon) { seen.add(id); out.push({ m: MODELS[id], cat: c.id }); } return out; }
function page(title, desc) { show('view-page'); stopViewer(); const v = $('#view-page'); v.innerHTML = ''; const head = el('section', { class: 'cat-head' }, el('h1', {}, title), el('p', {}, desc)); v.append(head); return v; }
function openAll() {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Modelos' }]); const all = uniqueModels(); const v = page('Todos los modelos', all.length + ' modelos para personalizar e imprimir.');
  const q = el('input', { type: 'search', placeholder: 'Buscar modelo…' }); const chips = el('div', { class: 'chips' }); const grid = el('section', { class: 'grid models' }); let cat = '';
  const draw = () => { grid.innerHTML = ''; const t = q.value.trim().toLowerCase(); const list = all.filter(x => (!cat || CATEGORIES.find(c => c.id === cat).models.includes(x.m.id)) && (!t || (x.m.name + ' ' + x.m.desc).toLowerCase().includes(t)));
    list.forEach(x => grid.append(modelCard(x.m))); if (!list.length) grid.append(el('p', { class: 'empty' }, 'Nada por aquí.')); queueThumbs(grid); };
  const mk = (id, label) => { const b = el('button', { class: 'chip' + (cat === id ? ' on' : ''), type: 'button' }, label); b.addEventListener('click', () => { cat = id; chips.querySelectorAll('.chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); draw(); }); return b; };
  chips.append(mk('', 'Todos')); CATEGORIES.filter(c => !c.hidden).forEach(c => chips.append(mk(c.id, c.icon + ' ' + c.name)));
  q.addEventListener('input', draw); v.append(el('div', { class: 'search', style: 'text-align:center' }, q), chips, grid); draw();
}
function openFav() {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Favoritos' }]); const f = favs(); const v = page('Favoritos', 'Los modelos que marcas con el corazón se guardan en este navegador.');
  const grid = el('section', { class: 'grid models' }); [...f].filter(id => MODELS[id]).forEach(id => grid.append(modelCard(MODELS[id])));
  if (!f.size) grid.append(el('p', { class: 'empty' }, 'Aún no tienes favoritos. Pulsa ♡ en cualquier modelo.')); v.append(grid); queueThumbs(grid);
}
function openTools() {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Herramientas' }]); const v = page('Herramientas', 'Utilidades para impresión 3D y diseño.');
  const g = el('section', { class: 'grid tools' }); const t = (href, ic, name, desc) => el('a', { class: 'card tool', href }, el('div', { class: 'ic' }, ic), el('div', {}, el('b', {}, name), el('p', {}, desc)));
  g.append(t('#svg', '🖼️', 'Conversor a SVG', 'Convierte imágenes PNG, JPEG o WebP en un SVG vectorial para usar en modelos 3D, corte o Cricut.'), t('#generador-qr', '🔳', 'Generador de QR', 'Crea códigos QR desde cualquier enlace o texto y descárgalos en PNG o SVG.'), t('#pruebas', '📏', 'Archivos de prueba', 'Calibración, tolerancias, puentes y roscas para ajustar tu impresora.'));
  v.append(g);
}
function numField(label, val, min, max, step, unit = '') { const r = el('input', { type: 'range', min, max, step, value: val }); const n = el('input', { type: 'number', min, max, step, value: val }); r.addEventListener('input', () => { n.value = r.value; n.dispatchEvent(new Event('sync')); }); n.addEventListener('change', () => { r.value = n.value; n.dispatchEvent(new Event('sync')); }); const box = el('div', { class: 'f' }, el('label', {}, label, el('em', {}, unit)), el('div', { class: 'row' }, r, n)); box.val = () => +n.value; box.on = fn => n.addEventListener('sync', fn); return box; }
function openSvg() {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Herramientas', href: '#herramientas' }, { label: 'Conversor a SVG' }]); const v = page('Conversor a SVG', 'Sube una imagen y conviértela en trazados vectoriales. Todo se hace en tu navegador.');
  let img = demo('logo'); const inp = el('input', { type: 'file', accept: 'image/*' }); const thr = numField('Umbral', 55, 5, 95, 1, '%'), width = numField('Ancho del SVG', 100, 10, 400, 1, 'mm'), smooth = numField('Simplificar', 0.15, 0.02, 1, 0.01, 'mm'), clean = numField('Limpiar manchas', 0.4, 0, 3, 0.1, 'mm');
  const modeS = el('select', {}); for (const [k, l] of [['auto', 'Automático'], ['dark', 'Zonas oscuras'], ['light', 'Zonas claras'], ['alpha', 'Transparencia (PNG)']]) modeS.append(el('option', { value: k }, l));
  const prev = el('div', { class: 'toolprev' }); const info = el('p', { class: 'muted small' }); let svgText = '';
  const run = () => { try { const W = width.val(); const H = W * img.height / img.width; const F = K.frame(W, H, { margin: 2, maxPx: 1000 }); let m = F.image(img, 0, 0, W, H, { thr: thr.val(), mode: modeS.value }); if (clean.val() > 0) m = K.open(F, m, clean.val() / 2);
      const loops = K.traceLoops(F, m, smooth.val()); const d = loops.map(l => 'M' + l.map(([x, y]) => (x + W / 2).toFixed(2) + ' ' + (H / 2 - y).toFixed(2)).join('L') + 'Z').join('');
      svgText = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.toFixed(1)}mm" height="${H.toFixed(1)}mm" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}"><path fill="#000" fill-rule="evenodd" d="${d}"/></svg>`;
      prev.innerHTML = svgText; info.textContent = `${loops.length} trazados · ${W.toFixed(0)} × ${H.toFixed(0)} mm`; } catch (e) { info.textContent = 'No se ha podido convertir: ' + e.message; } };
  inp.addEventListener('change', () => { const f = inp.files[0]; if (!f) return; const im = new Image(); im.onload = () => { img = im; run(); }; im.src = URL.createObjectURL(f); });
  [thr, width, smooth, clean].forEach(x => x.on(run)); modeS.addEventListener('change', run);
  const dl = el('button', { class: 'primary', type: 'button' }, 'Descargar SVG'); const msg = el('p', { class: 'muted small' }); dl.addEventListener('click', async () => { msg.textContent = await saveFile('imagen.svg', new Blob([svgText], { type: 'image/svg+xml' })); });
  v.append(el('div', { class: 'toolbox' }, el('aside', { class: 'panel' }, el('div', { class: 'f' }, el('label', {}, 'Imagen'), el('div', { class: 'img' }, el('label', { class: 'btn' }, 'Subir imagen', inp))), el('div', { class: 'f' }, el('label', {}, 'Qué convertir'), modeS), thr, width, smooth, clean, info, dl, msg), prev)); run();
}
function openQrTool() {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Herramientas', href: '#herramientas' }, { label: 'Generador de QR' }]); const v = page('Generador de QR', 'Código QR desde cualquier enlace o texto, en PNG o SVG.');
  const txt = el('textarea', {}); txt.value = 'https://'; const size = numField('Tamaño (PNG)', 800, 200, 2000, 50, 'px'), margin = numField('Margen', 2, 0, 8, 1, 'módulos');
  const fg = el('input', { type: 'color', value: '#22223b' }), bg = el('input', { type: 'color', value: '#ffffff' }); const prev = el('div', { class: 'toolprev' }); const cv = el('canvas', {}); prev.append(cv); let svgText = '';
  const run = () => { const q = K.makeQR(txt.value || ' '); const n = q.getModuleCount(), mg = margin.val(), tot = n + 2 * mg, px = size.val(); cv.width = cv.height = px; const x = cv.getContext('2d'); x.fillStyle = bg.value; x.fillRect(0, 0, px, px); x.fillStyle = fg.value; const c = px / tot;
    let rects = ''; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) { x.fillRect(Math.floor((k + mg) * c), Math.floor((r + mg) * c), Math.ceil(c), Math.ceil(c)); rects += `M${k + mg} ${r + mg}h1v1h-1z`; }
    svgText = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${tot} ${tot}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${bg.value}"/><path fill="${fg.value}" d="${rects}"/></svg>`; };
  [size, margin].forEach(f => f.on(run)); [txt, fg, bg].forEach(e => e.addEventListener('input', run));
  const msg = el('p', { class: 'muted small' }); const bP = el('button', { class: 'primary', type: 'button' }, 'Descargar PNG'), bS = el('button', { class: 'primary', type: 'button' }, 'Descargar SVG');
  bP.addEventListener('click', () => cv.toBlob(async b => { msg.textContent = await saveFile('codigo-qr.png', b); }, 'image/png')); bS.addEventListener('click', async () => { msg.textContent = await saveFile('codigo-qr.svg', new Blob([svgText], { type: 'image/svg+xml' })); });
  v.append(el('div', { class: 'toolbox' }, el('aside', { class: 'panel' }, el('div', { class: 'f' }, el('label', {}, 'Enlace o texto'), txt), size, margin, el('div', { class: 'f' }, el('label', {}, 'Colores'), el('div', { class: 'row' }, fg, el('span', { class: 'small muted' }, 'código'), bg, el('span', { class: 'small muted' }, 'fondo'))), el('div', { class: 'btnrow' }, bP, bS), msg), prev)); run();
}
function crumbs(parts) { const c = $('#crumbs'); c.innerHTML = ''; parts.forEach((p, i) => { if (i) c.append(' / '); c.append(p.href ? el('a', { href: p.href }, p.label) : el('span', {}, p.label)); }); }
function openHome() { show('view-home'); crumbs([]); stopViewer(); }
function openCat(c) {
  state.cat = c; show('view-cat'); crumbs(c.hidden ? [{ label: 'Inicio', href: '#inicio' }, { label: 'Herramientas', href: '#herramientas' }, { label: c.name }] : [{ label: 'Inicio', href: '#inicio' }, { label: c.name }]); stopViewer();
  $('#cat-title').textContent = c.name; $('#cat-desc').textContent = c.desc; $('#cat-count').textContent = c.models.length + ' modelos';
  const g = $('#cat-models'); g.innerHTML = ''; c.models.forEach(id => g.append(modelCard(MODELS[id])));
  queueThumbs(g);
}
function modelCard(m) {
  if (m.soon) return el('div', { class: 'card soon' }, el('div', { class: 'thumb' }, '⏳'), el('div', { class: 't' }, el('b', {}, m.name), el('span', {}, 'Necesita geometría esculpida; no incluido aún.')));
  const th = el('div', { class: 'thumb', 'data-model': m.id }, '…');
  const fv = el('button', { class: 'fav', type: 'button', title: 'Favorito' }, favs().has(m.id) ? '♥' : '♡'); fv.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fv.textContent = toggleFav(m.id) ? '♥' : '♡'; });
  return el('a', { class: 'card', href: '#m-' + m.id }, fv, th, el('div', { class: 't' }, el('b', {}, m.name), el('span', {}, m.desc)));
}
function renderCats() {
  const g = $('#cats'); CATEGORIES.filter(c => !c.hidden).forEach(c => g.append(el('a', { class: 'card cat', href: '#' + c.id }, el('div', { class: 'thumb' }, c.icon), el('div', { class: 't' }, el('b', {}, c.name), el('span', {}, c.desc), el('small', {}, c.models.filter(id => !MODELS[id].soon).length + ' modelos')))));
  $('#q').addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); const r = $('#results'); r.innerHTML = '';
    if (!q) { r.classList.add('hidden'); $('#cats').classList.remove('hidden'); return; }
    const found = uniqueModels().map(x => x.m).filter(m => (m.name + ' ' + (m.desc || '')).toLowerCase().includes(q)); found.forEach(m => r.append(modelCard(m)));
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
let timer = null, running = false, again = false;
function schedule() { clearTimeout(timer); timer = setTimeout(regenerate, 280); }
/* una generación a la vez; si cambias algo mientras calcula, al terminar se repite con lo último */
async function regenerate() {
  const m = state.model; if (!m) return;
  if (running) { again = true; return; }
  running = true; again = false; const my = ++state.gen;
  $('#busy').classList.remove('hidden'); hideErr();
  try {
    const res = await Engine.gen(m, vals(m));
    if (my === state.gen && state.model === m && !again) {
      const cols = state.colors[m.id] || (state.colors[m.id] = {});
      res.parts.forEach(p => { if (cols[p.name]) p.color = cols[p.name]; });
      state.result = res; showMeshes(res.parts); renderLayers(res.parts);
      const note = [m.note, res.note].filter(Boolean).join(' '); $('#m-note').textContent = note; $('#m-note').classList.toggle('hidden', !note);
      if (!res.parts.length) showErr('Con estos valores no sale ninguna pieza. Revisa el texto o la imagen.');
    }
  } catch (e) { console.error(e); if (state.model === m && !again) showErr('No se ha podido generar: ' + (e.message || e)); }
  finally { running = false; if (again) regenerate(); else $('#busy').classList.add('hidden'); }
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
    const readme = `${m.name}\nGenerado con Taller 3D.\n\n${base}.3mf: cada capa es una pieza con su color (asígnale filamento en el laminador).\n${base}.stl: {STL}\n\nPiezas:\n` + r.parts.map(p => `- ${p.name}${p.z1 !== undefined ? ` (z ${p.z0}–${p.z1} mm)` : ''}`).join('\n') + '\n';
    const { blob } = await Engine.zip({ parts: r.parts.map(p => ({ name: p.name, color: p.color, mesh: p.mesh })), title: m.name, base, readme });
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
  for (const p of parts) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p.mesh.pos instanceof Float32Array ? p.mesh.pos : Float32Array.from(p.mesh.pos), 3)); g.setIndex(new THREE.BufferAttribute(p.mesh.idx instanceof Uint32Array ? p.mesh.idx : Uint32Array.from(p.mesh.idx), 1)); const ng = g.toNonIndexed(); g.dispose(); ng.computeVertexNormals();
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
  thumbQ = []; initViewer(); if (!raf) loop(); state.refit = true; resize(); buildForm(m); regenerate();
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
function makeThumb(m) { return Engine.thumb(m, defaults(m)); }

$('#btn-dl').addEventListener('click', download);
renderCats(); window.addEventListener('hashchange', route); route();
window.__T3D = { Engine, MODELS, defaults, makeThumb, vals };
})();
