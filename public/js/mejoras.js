/* Taller 3D — "Cosas a mejorar": formulario público para avisar de fallos (texto, fotos, vídeos)
   y panel privado para revisarlos. Usa las Pages Functions de /api/mejoras. */
'use strict';
const Mejoras = (() => {
/* utilidades de la interfaz (las expone app.js) */
const el = (...a) => window.T3DUI.el(...a), page = (...a) => window.T3DUI.page(...a), crumbs = (...a) => window.T3DUI.crumbs(...a);
const API = '/api/mejoras';
const SEGUROS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']);
const ESTADOS = { pendiente: 'Pendiente', en_curso: 'En curso', arreglado: 'Arreglado', descartado: 'Descartado' };
let cfg = null;
async function config() {
  if (cfg) return cfg;
  try { const r = await fetch(API + '/config'); if (!r.ok) throw 0; cfg = await r.json(); } catch (e) { cfg = { activo: false }; }
  return cfg;
}

/* foto → JPEG de como mucho 1600 px (ocupa poco y se ve bien) */
async function reducir(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file); const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}
const mb = n => (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + ' MB';

/* ---------- formulario público ---------- */
async function abrir(modeloId) {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Cosas a mejorar' }]);
  const v = page('Cosas a mejorar', '¿Algo no se ve bien, no imprime bien o falta algo? Cuéntanoslo y, si puedes, manda fotos o un vídeo.');
  const box = el('section', { class: 'mej' }); v.append(box);
  const c = await config();
  if (!c.activo) { box.append(el('p', { class: 'note' }, 'Este apartado solo funciona en la web publicada (taller3d-e15.pages.dev).')); return; }

  const f = (label, input, hint) => el('div', { class: 'f' }, el('label', {}, label, hint ? el('em', {}, ' ' + hint) : ''), input);
  const modelo = el('select', {}); modelo.append(el('option', { value: '' }, 'Algo general de la web'));
  for (const cat of CAT.CATEGORIES) { const g = el('optgroup', { label: cat.name }); for (const id of cat.models) { const m = CAT.MODELS[id]; if (m && !m.soon) g.append(el('option', { value: id }, m.name)); } if (g.children.length) modelo.append(g); }
  if (modeloId && CAT.MODELS[modeloId]) modelo.value = modeloId;
  const texto = el('textarea', { rows: 6, maxlength: 4000, placeholder: 'Qué pasa, en qué modelo y con qué valores. Por ejemplo: "El abrelatas lazo: la anilla de la lata no entra en la ranura, la he impreso en PLA a 0,2 mm".' });
  const files = el('input', { type: 'file', multiple: '', accept: c.videos ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif' });
  const lista = el('div', { class: 'mej-files' }); let elegidos = [];
  const pintar = () => { lista.innerHTML = ''; elegidos.forEach((fl, i) => { const q = el('button', { type: 'button', class: 'chip', title: 'Quitar', onclick: () => { elegidos.splice(i, 1); pintar(); } }, (fl.type.startsWith('video/') ? '🎬 ' : '📷 ') + fl.name + ' · ' + mb(fl.size) + ' ✕'); lista.append(q); }); };
  files.addEventListener('change', () => { elegidos = elegidos.concat([...files.files]).slice(0, c.maxArchivos || 5); files.value = ''; pintar(); });
  const nombre = el('input', { type: 'text', maxlength: 200, placeholder: 'Opcional' }), contacto = el('input', { type: 'text', maxlength: 200, placeholder: 'Opcional: email o Instagram, por si hay que preguntarte algo' });
  const trampa = el('input', { type: 'text', name: 'web', tabindex: '-1', autocomplete: 'off' });   /* campo trampa para bots */
  const btn = el('button', { class: 'primary', type: 'submit' }, 'Enviar'); const msg = el('p', { class: 'muted small' }); const barra = el('progress', { max: 100, value: 0, class: 'hidden' });
  const form = el('form', { class: 'panel mej-form' },
    f('Modelo', modelo), f('¿Qué hay que mejorar?', texto),
    f('Fotos' + (c.videos ? ' o vídeos' : ''), el('div', {}, el('label', { class: 'chip mej-add' }, '＋ Añadir archivos', files), lista), c.videos ? `hasta ${c.maxArchivos}, vídeos de máx. ${c.maxVideoMB} MB` : `hasta ${c.maxArchivos} fotos`),
    f('Tu nombre', nombre), f('Contacto', contacto), el('div', { class: 'mej-trampa', 'aria-hidden': 'true' }, trampa), btn, barra, msg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (texto.value.trim().length < 5) { msg.textContent = 'Cuéntanos un poco más qué pasa.'; texto.focus(); return; }
    btn.disabled = true; msg.textContent = 'Preparando…';
    const fd = new FormData(); fd.append('modelo', modelo.value); fd.append('modeloNombre', modelo.value ? modelo.selectedOptions[0].textContent : ''); fd.append('texto', texto.value); fd.append('nombre', nombre.value); fd.append('contacto', contacto.value); fd.append('web', trampa.value);
    for (const fl of elegidos) fd.append('archivos', await reducir(fl));
    barra.classList.remove('hidden'); msg.textContent = 'Enviando…';
    /* XMLHttpRequest para ver el progreso de subida (los vídeos tardan) */
    const xhr = new XMLHttpRequest(); xhr.open('POST', API); xhr.upload.onprogress = ev => { if (ev.lengthComputable) barra.value = 100 * ev.loaded / ev.total; };
    xhr.onload = () => { btn.disabled = false; barra.classList.add('hidden'); let r = {}; try { r = JSON.parse(xhr.responseText); } catch (er) { }
      if (xhr.status === 200 && r.ok) { form.replaceWith(el('div', { class: 'panel mej-ok' }, el('h2', {}, '¡Gracias!'), el('p', {}, 'Lo hemos recibido y lo revisaremos.'), el('a', { href: '#inicio', class: 'chip' }, 'Volver al inicio'), ' ', el('a', { href: '#mejoras', class: 'chip', onclick: () => setTimeout(() => abrir(), 0) }, 'Enviar otro'))); }
      else msg.textContent = r.error || 'No se ha podido enviar. Prueba otra vez.'; };
    xhr.onerror = () => { btn.disabled = false; barra.classList.add('hidden'); msg.textContent = 'Sin conexión. Prueba otra vez.'; };
    xhr.send(fd);
  });
  box.append(form, el('p', { class: 'muted small mej-pie' }, el('a', { href: '#mejoras-panel' }, 'Panel de revisión')));
}

/* ---------- panel privado ---------- */
const clave = () => { try { return sessionStorage.getItem('t3d-mej') || ''; } catch (e) { return ''; } };
const guardarClave = k => { try { sessionStorage.setItem('t3d-mej', k); } catch (e) { } };
async function api(path, opt = {}) {
  const r = await fetch(API + path, { ...opt, headers: { ...(opt.headers || {}), authorization: 'Bearer ' + clave() } });
  if (r.status === 401) { guardarClave(''); throw new Error('Contraseña incorrecta.'); }
  if (!r.ok) { let m = 'Error ' + r.status; try { m = (await r.json()).error || m; } catch (e) { } throw new Error(m); }
  return r;
}
async function panel(filtro = 'pendiente') {
  crumbs([{ label: 'Inicio', href: '#inicio' }, { label: 'Cosas a mejorar', href: '#mejoras' }, { label: 'Panel' }]);
  const v = page('Panel de mejoras', 'Lo que te han enviado. Cambia el estado según lo vayas arreglando.');
  const box = el('section', { class: 'mej' }); v.append(box);
  const c = await config();
  if (!c.activo) { box.append(el('p', { class: 'note' }, 'El panel solo funciona en la web publicada.')); return; }
  if (!c.panel) { box.append(el('p', { class: 'note' }, 'Falta poner la contraseña del panel: en Cloudflare → Workers y Pages → taller3d → Configuración → Variables y secretos, añade un secreto ADMIN_PASSWORD y vuelve a desplegar.')); return; }
  if (!clave()) {
    const pw = el('input', { type: 'password', placeholder: 'Contraseña del panel', autocomplete: 'current-password' }); const m = el('p', { class: 'muted small' });
    /* ojito para ver u ocultar la contraseña */
    const ojo = el('button', { type: 'button', class: 'mej-ojo', title: 'Mostrar contraseña', 'aria-label': 'Mostrar contraseña', onclick: () => { const ver = pw.type === 'password'; pw.type = ver ? 'text' : 'password'; ojo.textContent = ver ? '🙈' : '👁️'; ojo.title = ojo.ariaLabel = ver ? 'Ocultar contraseña' : 'Mostrar contraseña'; pw.focus(); } }, '👁️');
    const fm = el('form', { class: 'panel mej-form' }, el('div', { class: 'f' }, el('label', {}, 'Contraseña'), el('div', { class: 'mej-pw' }, pw, ojo)), el('button', { class: 'primary', type: 'submit' }, 'Entrar'), m);
    fm.addEventListener('submit', async e => { e.preventDefault(); guardarClave(pw.value); try { await api('?estado=pendiente'); panel(filtro); } catch (er) { m.textContent = er.message; } });
    box.append(fm); pw.focus(); return;
  }
  let data; try { data = await (await api(filtro === 'todos' ? '' : '?estado=' + filtro)).json(); }
  catch (e) { box.append(el('p', { class: 'note' }, e.message), el('button', { class: 'chip', onclick: () => panel(filtro) }, 'Reintentar')); return; }
  const tabs = el('div', { class: 'chips' });
  for (const [k, l] of [['pendiente', 'Pendientes'], ['en_curso', 'En curso'], ['arreglado', 'Arreglados'], ['descartado', 'Descartados'], ['todos', 'Todos']]) {
    const n = k === 'todos' ? Object.values(data.cuenta).reduce((a, b) => a + b, 0) : data.cuenta[k] || 0;
    tabs.append(el('button', { class: 'chip' + (k === filtro ? ' on' : ''), onclick: () => panel(k) }, `${l} (${n})`));
  }
  tabs.append(el('button', { class: 'chip', onclick: () => { guardarClave(''); panel(filtro); } }, 'Salir'));
  box.append(tabs, avisos());
  if (!data.reportes.length) { box.append(el('p', { class: 'muted' }, 'No hay nada aquí. 🎉')); return; }
  for (const r of data.reportes) box.append(tarjeta(r, filtro));
}
/* avisos por Telegram: estado y botón para conectar */
function avisos() {
  const c = el('div', { class: 'mej-tg muted small' }, 'Avisos por Telegram: comprobando…');
  const pintar = (st) => { c.innerHTML = '';
    if (!st.token) { c.append('📵 Avisos por Telegram desactivados. Crea un bot con @BotFather y pon su token como secreto TELEGRAM_TOKEN en Cloudflare (ver README).'); return; }
    if (st.chat) { c.append('🔔 Avisos por Telegram a ', el('b', {}, st.chat.nombre), ' ', el('button', { class: 'chip', onclick: () => conectar() }, 'Probar / reconectar'), ' ', el('button', { class: 'chip', onclick: async () => { await api('/telegram', { method: 'DELETE' }); cargar(); } }, 'Desconectar')); return; }
    c.append('🔕 Telegram sin conectar. Abre tu bot, escríbele /start y pulsa ', el('button', { class: 'chip', onclick: () => conectar() }, 'Conectar Telegram')); };
  const cargar = () => api('/telegram').then(r => r.json()).then(pintar).catch(e => { c.textContent = e.message; });
  const conectar = async () => { c.textContent = 'Conectando…'; try { await api('/telegram', { method: 'POST' }); cargar(); } catch (e) { c.textContent = e.message + ' '; c.append(el('button', { class: 'chip', onclick: () => cargar() }, 'Volver')); } };
  cargar(); return c;
}
function tarjeta(r, filtro) {
  const m = r.modelo && CAT.MODELS[r.modelo];
  const estado = el('select', {}); for (const [k, l] of Object.entries(ESTADOS)) estado.append(el('option', { value: k }, l)); estado.value = r.estado;
  const nota = el('textarea', { rows: 2, placeholder: 'Nota interna (qué has cambiado, commit…)' }); nota.value = r.nota || '';
  const ok = el('span', { class: 'muted small' });
  const guardar = async (body) => { ok.textContent = 'Guardando…'; try { await api('/' + r.id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); ok.textContent = 'Guardado'; if (body.estado && filtro !== 'todos') setTimeout(() => panel(filtro), 400); } catch (e) { ok.textContent = e.message; } };
  estado.addEventListener('change', () => guardar({ estado: estado.value }));
  /* borrar con confirmación dentro de la tarjeta (sin ventanas del navegador) */
  const borrar = el('span', {}); const pintarBorrar = (pregunta) => { borrar.innerHTML = '';
    if (!pregunta) return borrar.append(el('button', { class: 'chip', onclick: () => pintarBorrar(true) }, 'Borrar'));
    borrar.append(el('span', { class: 'mej-seguro' }, '¿Borrar este reporte y sus archivos? '),
      el('button', { class: 'chip peligro', onclick: async () => { try { await api('/' + r.id, { method: 'DELETE' }); panel(filtro); } catch (e) { ok.textContent = e.message; } } }, 'Sí, borrar'), ' ',
      el('button', { class: 'chip', onclick: () => pintarBorrar(false) }, 'No')); };
  pintarBorrar(false);
  const media = el('div', { class: 'mej-media' });
  for (const a of r.adjuntos) {
    const ph = el('div', { class: 'mej-ph' }, a.tipo === 'video' ? '🎬' : '📷'); media.append(ph);
    api('/adjunto/' + a.id).then(x => x.blob()).then(b => {
      /* segunda barrera: solo se muestran fotos y vídeos de la lista; cualquier otra cosa no se abre */
      if (!SEGUROS.has(b.type)) { ph.textContent = '⚠️'; ph.title = 'Archivo no permitido'; return; }
      const u = URL.createObjectURL(new Blob([b], { type: b.type }));
      ph.replaceWith(a.tipo === 'video' ? el('video', { src: u, controls: '', preload: 'metadata' }) : el('a', { href: u, target: '_blank' }, el('img', { src: u, alt: a.nombre || 'foto' }))); })
      .catch(() => { ph.textContent = '⚠️'; });
  }
  const fecha = new Date(r.creado.replace(' ', 'T') + 'Z').toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  return el('article', { class: 'panel mej-card ' + r.estado },
    el('header', {}, el('b', {}, '#' + r.id + ' · '), m ? el('a', { href: '#m-' + r.modelo }, m.name) : el('span', {}, 'General'), el('span', { class: 'muted small' }, ' · ' + fecha)),
    el('p', { class: 'mej-texto' }, r.texto),
    r.nombre || r.contacto ? el('p', { class: 'muted small' }, [r.nombre, r.contacto].filter(Boolean).join(' · ')) : '',
    r.adjuntos.length ? media : '',
    el('div', { class: 'mej-acc' }, estado, nota,
      el('button', { class: 'chip', onclick: () => guardar({ nota: nota.value }) }, 'Guardar nota'),
      borrar, ok));
}

return { abrir, panel };
})();
