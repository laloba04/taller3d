/* Taller 3D — motor geométrico (código original)
   Máscaras 2D en mm → mallas extruidas por capas, torno, mapa de alturas, exportación STL/3MF. */
'use strict';
const K = (() => {

const QUALITY = { maxPx: 1150, res: 5 };
function setQuality(maxPx, res) { QUALITY.maxPx = maxPx; QUALITY.res = res; }
/* ---------- fuentes ---------- */
const FONTS = [
  { id: 'pacifico', name: 'Pacifico (manuscrita)', fam: 'Pacifico', w: 400 },
  { id: 'lobster', name: 'Lobster', fam: 'Lobster', w: 400 },
  { id: 'dancing', name: 'Dancing Script', fam: 'Dancing Script', w: 700 },
  { id: 'vibes', name: 'Great Vibes (elegante)', fam: 'Great Vibes', w: 400 },
  { id: 'fredoka', name: 'Fredoka (redonda)', fam: 'Fredoka', w: 700 },
  { id: 'baloo', name: 'Baloo 2', fam: 'Baloo 2', w: 800 },
  { id: 'luckiest', name: 'Luckiest Guy (cómic)', fam: 'Luckiest Guy', w: 400 },
  { id: 'chewy', name: 'Chewy', fam: 'Chewy', w: 400 },
  { id: 'bebas', name: 'Bebas Neue', fam: 'Bebas Neue', w: 400 },
  { id: 'anton', name: 'Anton (gruesa)', fam: 'Anton', w: 400 },
  { id: 'righteous', name: 'Righteous', fam: 'Righteous', w: 400 },
  { id: 'rubik', name: 'Rubik Black', fam: 'Rubik', w: 900 },
  { id: 'montserrat', name: 'Montserrat', fam: 'Montserrat', w: 700 },
];
const EMOJI = { id: 'emoji', fam: null, w: 400 };
function font(id) { return id === 'emoji' ? EMOJI : (FONTS.find(f => f.id === id) || FONTS[0]); }
function fontStr(f, px) { return f.fam ? `${f.w} ${px}px "${f.fam}", sans-serif` : `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; }
async function loadFont(f) { if (!f.fam || !document.fonts) return; try { await document.fonts.load(`${f.w} 60px "${f.fam}"`); } catch (e) { } }

const mctx = document.createElement('canvas').getContext('2d');
/* mide un bloque de líneas; resultados por 1 mm de cuerpo de letra */
function measure(lines, f, lh = 1.15) {
  lines = (Array.isArray(lines) ? lines : [lines]).filter(t => t !== '' && t != null);
  if (!lines.length) lines = [' '];
  mctx.font = fontStr(f, 200); mctx.textBaseline = 'alphabetic'; mctx.textAlign = 'left';
  const L = lines.map((t, k) => { const m = mctx.measureText(t); return { t, l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent, b: k * lh * 200 }; });
  let top = Infinity, bot = -Infinity, w = 0;
  for (const s of L) { top = Math.min(top, s.b - s.a); bot = Math.max(bot, s.b + s.d); w = Math.max(w, s.l + s.r); }
  const u = 1 / 200;
  return { w: Math.max(w * u, 1e-3), h: Math.max((bot - top) * u, 1e-3), top: top * u, bot: bot * u, L: L.map(s => ({ t: s.t, l: s.l * u, r: s.r * u, a: s.a * u, d: s.d * u, b: s.b * u })) };
}
function fitSize(lines, f, maxW, maxH, lh) { const m = measure(lines, f, lh); return Math.min(maxW / m.w, maxH ? maxH / m.h : Infinity); }

/* ---------- marco de trabajo (rejilla de píxeles en mm, origen en el centro, y hacia abajo) ---------- */
function frame(W, H, opt = {}) {
  const margin = opt.margin ?? 6;
  W += 2 * margin; H += 2 * margin;
  const maxPx = opt.maxPx || QUALITY.maxPx;
  const res = Math.min(opt.res || QUALITY.res, maxPx / Math.max(W, H));
  const w = Math.ceil(W * res), h = Math.ceil(H * res);
  const F = { w, h, res, W: w / res, H: h / res, n: w * h };
  F.canvas = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d', { willReadFrequently: true }); return { c, ctx }; };
  F.fromCanvas = (ctx) => { const d = ctx.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h); for (let i = 0, k = 3; i < m.length; i++, k += 4) m[i] = d[k] > 127 ? 1 : 0; clearBorder(F, m); return m; };
  /* dibujo libre en mm */
  F.draw = (fn) => { const { ctx } = F.canvas(); ctx.setTransform(res, 0, 0, res, w / 2, h / 2); ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; fn(ctx); return F.fromCanvas(ctx); };
  F.blank = () => new Uint8Array(w * h);
  F.disk = (x, y, r) => F.draw(c => { c.beginPath(); c.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2); c.fill(); });
  F.rect = (x0, y0, x1, y1, r = 0) => F.draw(c => { roundRect(c, Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), r); c.fill(); });
  F.rectC = (cx, cy, rw, rh, r = 0) => F.rect(cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2, r);
  F.shape = (kind, cx, cy, sw, sh, rot = 0) => F.draw(c => { c.translate(cx, cy); c.rotate(rot); shapePath(c, kind, 0, 0, sw, sh ?? sw); c.fill('nonzero'); });
  /* texto: bloque centrado en (cx,cy) con cuerpo de letra size (mm) */
  F.text = (lines, f, size, cx = 0, cy = 0, o = {}) => {
    const lh = o.lh || 1.15; const m = measure(lines, f, lh);
    const { ctx } = F.canvas(); const px = size * res;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pcx = w / 2 + cx * res, pcy = h / 2 + cy * res;
    if (o.mirror) { ctx.translate(pcx, 0); ctx.scale(-1, 1); ctx.translate(-pcx, 0); }
    if (o.rot) { ctx.translate(pcx, pcy); ctx.rotate(o.rot); ctx.translate(-pcx, -pcy); }
    ctx.font = fontStr(f, px); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#000';
    const mid = (m.top + m.bot) / 2;
    for (const s of m.L) {
      const lw = s.r - s.l;
      let x;
      if (o.align === 'left') x = pcx - m.w * px / 2 + s.l * px;
      else if (o.align === 'right') x = pcx + m.w * px / 2 - s.r * px;
      else x = pcx - (s.r - s.l) * px / 2;
      const y = pcy + (s.b - mid) * px;
      ctx.fillText(s.t, x, y);
      if (o.bold) { ctx.lineWidth = o.bold * res; ctx.lineJoin = 'round'; ctx.strokeText(s.t, x, y); }
    }
    return F.fromCanvas(ctx);
  };
  /* texto en arco: centro (cx,cy), radio r a la línea base; arriba (top) o abajo */
  F.arcText = (text, f, size, cx, cy, r, bottom = false) => {
    const { ctx } = F.canvas(); ctx.setTransform(res, 0, 0, res, w / 2, h / 2);
    ctx.font = fontStr(f, size); ctx.textAlign = 'center'; ctx.textBaseline = bottom ? 'top' : 'alphabetic';
    const chars = [...text]; const ws = chars.map(ch => ctx.measureText(ch).width * 1.04);
    const total = ws.reduce((a, b) => a + b, 0) / r;
    let ang = bottom ? Math.PI / 2 + total / 2 : -Math.PI / 2 - total / 2;
    chars.forEach((ch, i) => {
      const da = ws[i] / r; ang += bottom ? -da / 2 : da / 2;
      ctx.save(); ctx.translate(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
      ctx.rotate(bottom ? ang - Math.PI / 2 : ang + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
      ang += bottom ? -da / 2 : da / 2;
    });
    return F.fromCanvas(ctx);
  };
  /* imagen → máscara; mode: auto|alpha|dark|light */
  F.image = (img, cx, cy, iw, ih, o = {}) => {
    const { ctx } = F.canvas(); ctx.setTransform(res, 0, 0, res, w / 2, h / 2);
    if (o.mirror) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
    const d = ctx.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h);
    let mode = o.mode || 'auto';
    if (mode === 'auto') mode = imgHasAlpha(img) ? 'alpha' : 'dark';
    const thr = (o.thr ?? 50) / 100 * 255;
    for (let i = 0, k = 0; i < m.length; i++, k += 4) {
      const a = d[k + 3]; if (a < 100) { m[i] = 0; continue; }
      const lum = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
      let v = mode === 'alpha' ? 1 : mode === 'dark' ? (lum < thr) : (lum >= thr);
      if (o.invert && mode !== 'alpha') v = !v && a >= 100;
      m[i] = v ? 1 : 0;
    }
    clearBorder(F, m); return m;
  };
  /* luminancia 0..1 (1 = blanco); fuera de la imagen = -1 */
  F.lum = (img, cx, cy, iw, ih) => {
    const { ctx } = F.canvas(); ctx.setTransform(res, 0, 0, res, w / 2, h / 2);
    ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
    const d = ctx.getImageData(0, 0, w, h).data; const L = new Float32Array(w * h);
    for (let i = 0, k = 0; i < L.length; i++, k += 4) L[i] = d[k + 3] < 100 ? -1 : (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
    return L;
  };
  F.qr = (text, cx, cy, size) => {
    const q = makeQR(text); const n = q.getModuleCount(); const ms = size / n;
    return F.draw(c => { for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) c.fillRect(cx - size / 2 + k * ms - 0.02, cy - size / 2 + r * ms - 0.02, ms + 0.04, ms + 0.04); });
  };
  F.pattern = (kind, sp, lw, seed = 1) => patternMask(F, kind, sp, lw, seed);
  return F;
}
function clearBorder(F, m) { const { w, h } = F; for (let i = 0; i < w; i++) { m[i] = 0; m[(h - 1) * w + i] = 0; } for (let j = 0; j < h; j++) { m[j * w] = 0; m[j * w + w - 1] = 0; } }
function imgHasAlpha(img) {
  if (img._hasAlpha !== undefined) return img._hasAlpha;
  const c = document.createElement('canvas'); const s = 64; c.width = s; c.height = s; const x = c.getContext('2d'); x.drawImage(img, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data; let t = 0; for (let k = 3; k < d.length; k += 4) if (d[k] < 200) t++;
  img._hasAlpha = t > s * s * 0.02; return img._hasAlpha;
}
function makeQR(text) {
  if (typeof qrcode === 'undefined') throw new Error('No se ha cargado la librería de QR.');
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const q = qrcode(0, 'M'); q.addData(text || ' '); q.make(); return q;
}

/* ---------- operaciones de máscara ---------- */
function or(...ms) { const o = new Uint8Array(ms[0].length); for (const m of ms) if (m) for (let i = 0; i < o.length; i++) o[i] |= m[i]; return o; }
function and(a, b) { const o = new Uint8Array(a.length); for (let i = 0; i < o.length; i++) o[i] = a[i] & b[i]; return o; }
function sub(a, ...bs) { const o = a.slice(); for (const b of bs) if (b) for (let i = 0; i < o.length; i++) if (b[i]) o[i] = 0; return o; }
function inv(F, a) { const o = new Uint8Array(a.length); for (let i = 0; i < o.length; i++) o[i] = a[i] ? 0 : 1; return o; }
function count(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }

function dt1(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}
/* distancia euclídea al cuadrado (px²) al píxel activo más cercano */
function edt(F, m) {
  const { w, h } = F; const INF = 1e12; const N = Math.max(w, h);
  const f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
  const o = new Float64Array(w * h);
  for (let i = 0; i < o.length; i++) o[i] = m[i] ? 0 : INF;
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = o[y * w + x]; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) o[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { const r = y * w; for (let x = 0; x < w; x++) f[x] = o[r + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) o[r + x] = d[x]; }
  return o;
}
function dilate(F, m, r) { if (r <= 0) return m.slice(); const D = edt(F, m); const t = (r * F.res) ** 2; const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = D[i] <= t ? 1 : 0; clearBorder(F, o); return o; }
function erode(F, m, r) { if (r <= 0) return m.slice(); const D = edt(F, inv(F, m)); const t = (r * F.res) ** 2; const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = m[i] && D[i] > t ? 1 : 0; return o; }
function close(F, m, r) { return erode(F, dilate(F, m, r), r); }
function open(F, m, r) { return dilate(F, erode(F, m, r), r); }
function outline(F, m, wd) { return sub(dilate(F, m, wd), m); }      // anillo exterior
function ring(F, m, wd) { return sub(m, erode(F, m, wd)); }           // anillo interior
function fillHoles(F, m) {
  const { w, h } = F; const seen = new Uint8Array(m.length); const st = [];
  for (let i = 0; i < w; i++) { st.push(i, (h - 1) * w + i); } for (let j = 0; j < h; j++) { st.push(j * w, j * w + w - 1); }
  while (st.length) { const k = st.pop(); if (seen[k] || m[k]) continue; seen[k] = 1; const x = k % w, y = (k / w) | 0; if (x > 0) st.push(k - 1); if (x < w - 1) st.push(k + 1); if (y > 0) st.push(k - w); if (y < h - 1) st.push(k + w); }
  const o = new Uint8Array(m.length); for (let i = 0; i < o.length; i++) o[i] = seen[i] ? 0 : 1; return o;
}
const px2x = (F, i) => (i + 0.5 - F.w / 2) / F.res, px2y = (F, j) => (j + 0.5 - F.h / 2) / F.res;
const x2px = (F, x) => Math.round(x * F.res + F.w / 2 - 0.5), y2px = (F, y) => Math.round(y * F.res + F.h / 2 - 0.5);
function bbox(F, m) {
  const { w, h } = F; let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let j = 0; j < h; j++) { const r = j * w; for (let i = 0; i < w; i++) if (m[r + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
  if (x1 < 0) return null;
  return { x0: px2x(F, x0) - 0.5 / F.res, x1: px2x(F, x1) + 0.5 / F.res, y0: px2y(F, y0) - 0.5 / F.res, y1: px2y(F, y1) + 0.5 / F.res, get cx() { return (this.x0 + this.x1) / 2; }, get cy() { return (this.y0 + this.y1) / 2; }, get bw() { return this.x1 - this.x0; }, get bh() { return this.y1 - this.y0; } };
}
/* punto extremo de la máscara: left/right/top/bottom; rango opcional en el otro eje (mm) */
function extreme(F, m, dir, a, b) {
  const { w, h } = F;
  const inR = (v) => a === undefined || (v >= a && v <= b);
  if (dir === 'left' || dir === 'right') {
    const cols = dir === 'left' ? [...Array(w).keys()] : [...Array(w).keys()].reverse();
    for (const i of cols) { let s = 0, n = 0; for (let j = 0; j < h; j++) if (m[j * w + i] && inR(px2y(F, j))) { s += j; n++; } if (n) return [px2x(F, i), px2y(F, s / n)]; }
  } else {
    const rows = dir === 'top' ? [...Array(h).keys()] : [...Array(h).keys()].reverse();
    for (const j of rows) { let s = 0, n = 0; for (let i = 0; i < w; i++) if (m[j * w + i] && inR(px2x(F, i))) { s += i; n++; } if (n) return [px2x(F, s / n), px2y(F, j)]; }
  }
  if (a !== undefined) return extreme(F, m, dir);
  return [0, 0];
}
function shift(F, m, dx, dy) {
  const { w, h } = F; const di = Math.round(dx * F.res), dj = Math.round(dy * F.res); const o = new Uint8Array(m.length);
  for (let j = 0; j < h; j++) { const jj = j + dj; if (jj < 1 || jj >= h - 1) continue; for (let i = 0; i < w; i++) { if (!m[j * w + i]) continue; const ii = i + di; if (ii < 1 || ii >= w - 1) continue; o[jj * w + ii] = 1; } }
  return o;
}
/* copia espejada (horizontal) de la máscara centrada en srcX → centrada en dstX */
function mirrorTo(F, m, srcX, dstX) {
  const { w, h } = F; const si = srcX * F.res + w / 2, di = dstX * F.res + w / 2; const o = new Uint8Array(m.length);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!m[j * w + i]) continue; const ii = Math.round(di - (i + 0.5 - si) - 0.5); if (ii > 0 && ii < w - 1) o[j * w + ii] = 1; }
  return o;
}
/* componentes conexas (para piezas separadas) */
function components(F, m, minPx = 30) {
  const { w, h } = F; const lab = new Int32Array(m.length); let n = 0; const out = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || lab[s]) continue; n++; const st = [s]; const pix = []; lab[s] = n;
    while (st.length) { const k = st.pop(); pix.push(k); const x = k % w, y = (k / w) | 0;
      const nb = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const q of nb) if (q >= 0 && m[q] && !lab[q]) { lab[q] = n; st.push(q); } }
    if (pix.length >= minPx) { const c = new Uint8Array(m.length); for (const k of pix) c[k] = 1; out.push(c); }
  }
  return out;
}

/* ---------- formas ---------- */
function roundRect(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); }
function poly(c, pts) { c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
function circ(c, x, y, r) { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }
function ell(c, x, y, rx, ry, rot = 0) { c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot)); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
function regPoly(n, R, rot, cx = 0, cy = 0) { return [...Array(n)].map((_, k) => { const a = rot + k * 2 * Math.PI / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; }); }
function star(n, R, ri, cx = 0, cy = 0) { const p = []; for (let k = 0; k < 2 * n; k++) { const a = -Math.PI / 2 + k * Math.PI / n; const r = k % 2 ? ri : R; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; }
const SHAPES = {
  circulo: 'Círculo', ovalo: 'Óvalo', ondulado: 'Círculo ondulado', ovalo_ondulado: 'Óvalo ondulado', corazon: 'Corazón', estrella: 'Estrella',
  hexagono: 'Hexágono', octogono: 'Octógono', cuadrado: 'Cuadrado redondeado', rect: 'Rectángulo', capsula: 'Cápsula', arco: 'Arco',
  hueso: 'Hueso', pez: 'Pez', huella: 'Huella', conejo: 'Conejo', zanahoria: 'Zanahoria', flor: 'Flor', nube: 'Nube', escudo: 'Escudo',
  bola: 'Bola de Navidad', arbol: 'Árbol', campana: 'Campana', casa: 'Casita', galleta: 'Muñeco de jengibre', lazo: 'Lazo', copo: 'Copo (silueta)',
  gota: 'Gota', marcapaginas: 'Marcapáginas',
};
function shapePath(c, kind, cx, cy, w, h) {
  c.beginPath();
  const W = w / 2, H = h / 2;
  switch (kind) {
    case 'circulo': ell(c, cx, cy, W, W); break;
    case 'ovalo': ell(c, cx, cy, W, H); break;
    case 'ondulado': case 'ovalo_ondulado': {
      const n = kind === 'ondulado' ? 14 : 18; const rx = kind === 'ondulado' ? W : W, ry = kind === 'ondulado' ? W : H;
      const pts = []; for (let i = 0; i <= 360; i++) { const a = i / 360 * 2 * Math.PI; const k = 1 - 0.06 + 0.06 * Math.cos(n * a); pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)]); }
      poly(c, pts); break;
    }
    case 'corazon': { const pts = []; for (let i = 0; i < 160; i++) { const t = i / 160 * 2 * Math.PI; const x = 16 * Math.sin(t) ** 3; const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); pts.push([cx + x / 32 * w, cy - (y + 2.5) / 29 * h]); } poly(c, pts); break; }
    case 'estrella': poly(c, star(5, W * 1.05, W * 0.48, cx, cy + H * 0.1)); break;
    case 'hexagono': poly(c, regPoly(6, W, Math.PI / 6, cx, cy)); break;
    case 'octogono': poly(c, regPoly(8, W / Math.cos(Math.PI / 8), Math.PI / 8, cx, cy)); break;
    case 'cuadrado': roundRect(c, cx - W, cy - H, w, h, Math.min(w, h) * 0.16); break;
    case 'rect': roundRect(c, cx - W, cy - H, w, h, Math.min(w, h) * 0.06); break;
    case 'capsula': roundRect(c, cx - W, cy - H, w, h, Math.min(w, h) / 2); break;
    case 'marcapaginas': { c.moveTo(cx - W, cy - H + 3); c.arcTo(cx - W, cy - H, cx, cy - H, 3); c.arcTo(cx + W, cy - H, cx + W, cy, 3); c.lineTo(cx + W, cy + H); c.lineTo(cx, cy + H - W * 0.7); c.lineTo(cx - W, cy + H); c.closePath(); break; }
    case 'arco': { const r = Math.min(W, h * 0.5); c.moveTo(cx - W, cy + H); c.lineTo(cx - W, cy - H + r); c.arc(cx, cy - H + r, W, Math.PI, 0); c.lineTo(cx + W, cy + H); c.closePath(); break; }
    case 'hueso': { const r = H * 0.52; roundRect(c, cx - W + r, cy - H * 0.42, w - 2 * r, H * 0.84, 2); for (const sx of [-1, 1]) for (const sy of [-1, 1]) circ(c, cx + sx * (W - r), cy + sy * (H - r), r); break; }
    case 'pez': { ell(c, cx + W * 0.12, cy, W * 0.72, H * 0.9); poly(c, [[cx - W * 0.4, cy], [cx - W, cy - H * 0.75], [cx - W * 0.85, cy], [cx - W, cy + H * 0.75]]); break; }
    case 'huella': { ell(c, cx, cy + H * 0.3, W * 0.5, H * 0.42); for (const [x, y, r] of [[-0.68, -0.15, 0.2], [-0.27, -0.6, 0.22], [0.27, -0.6, 0.22], [0.68, -0.15, 0.2]]) ell(c, cx + x * W, cy + y * H, r * w * 0.6, r * h * 0.75); break; }
    case 'conejo': { ell(c, cx, cy + H * 0.32, W * 0.95, H * 0.62); ell(c, cx - W * 0.35, cy - H * 0.45, W * 0.22, H * 0.55, -0.15); ell(c, cx + W * 0.35, cy - H * 0.45, W * 0.22, H * 0.55, 0.15); break; }
    case 'zanahoria': { c.moveTo(cx - W * 0.45, cy - H * 0.55); c.quadraticCurveTo(cx + W * 0.2, cy - H * 0.75, cx + W, cy); c.quadraticCurveTo(cx + W * 0.2, cy + H * 0.75, cx - W * 0.45, cy + H * 0.55); c.quadraticCurveTo(cx - W * 0.6, cy, cx - W * 0.45, cy - H * 0.55); c.closePath();
      for (const a of [-0.55, 0, 0.55]) ell(c, cx - W * 0.68, cy + a * H * 0.6, W * 0.26, H * 0.16, a * 0.8); break; }
    case 'flor': { const n = 8; const rr = W * 0.3; for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; circ(c, cx + (W - rr) * Math.cos(a), cy + (W - rr) * Math.sin(a), rr); } circ(c, cx, cy, W - rr); break; }
    case 'nube': { for (const [x, y, r] of [[-0.55, 0.15, 0.42], [0, -0.2, 0.55], [0.55, 0.1, 0.45], [0, 0.3, 0.45]]) ell(c, cx + x * W, cy + y * H, r * W, r * H * 1.2); break; }
    case 'escudo': { c.moveTo(cx - W, cy - H); c.lineTo(cx + W, cy - H); c.lineTo(cx + W, cy); c.quadraticCurveTo(cx + W, cy + H * 0.7, cx, cy + H); c.quadraticCurveTo(cx - W, cy + H * 0.7, cx - W, cy); c.closePath(); break; }
    case 'bola': { const r = Math.min(W, H * 0.88); circ(c, cx, cy + H - r, r); roundRect(c, cx - r * 0.28, cy - H, r * 0.56, r * 0.32, 1.5); break; }
    case 'arbol': { const t = [[0.0, -1, 0.55, -0.35], [0, -0.55, 0.8, 0.15], [0, -0.1, 1, 0.65]]; for (const [x, yt, hw, yb] of t) poly(c, [[cx, cy + yt * H], [cx + hw * W, cy + yb * H], [cx - hw * W, cy + yb * H]]); roundRect(c, cx - W * 0.17, cy + 0.6 * H, W * 0.34, H * 0.4, 1); break; }
    case 'campana': { c.moveTo(cx, cy - H); c.bezierCurveTo(cx + W * 0.7, cy - H, cx + W * 0.55, cy + H * 0.3, cx + W, cy + H * 0.62); c.lineTo(cx - W, cy + H * 0.62); c.bezierCurveTo(cx - W * 0.55, cy + H * 0.3, cx - W * 0.7, cy - H, cx, cy - H); c.closePath(); circ(c, cx, cy + H * 0.78, H * 0.2); break; }
    case 'casa': { poly(c, [[cx, cy - H], [cx + W, cy - H * 0.15], [cx + W * 0.78, cy - H * 0.15], [cx + W * 0.78, cy + H], [cx - W * 0.78, cy + H], [cx - W * 0.78, cy - H * 0.15], [cx - W, cy - H * 0.15]]); break; }
    case 'galleta': { const s = Math.min(W, H); circ(c, cx, cy - H + s * 0.38, s * 0.38); ell(c, cx, cy + H * 0.05, W * 0.45, H * 0.42);
      ell(c, cx - W * 0.55, cy - H * 0.1, W * 0.42, H * 0.16, -0.35); ell(c, cx + W * 0.55, cy - H * 0.1, W * 0.42, H * 0.16, 0.35);
      ell(c, cx - W * 0.32, cy + H * 0.62, W * 0.2, H * 0.36, 0.3); ell(c, cx + W * 0.32, cy + H * 0.62, W * 0.2, H * 0.36, -0.3); break; }
    case 'lazo': { poly(c, [[cx, cy], [cx - W, cy - H * 0.75], [cx - W * 0.9, cy + H * 0.65]]); poly(c, [[cx, cy], [cx + W, cy - H * 0.75], [cx + W * 0.9, cy + H * 0.65]]); circ(c, cx, cy, Math.min(W, H) * 0.24);
      poly(c, [[cx - W * 0.1, cy], [cx - W * 0.45, cy + H], [cx - W * 0.25, cy + H * 0.95], [cx, cy + H * 0.3]]); poly(c, [[cx + W * 0.1, cy], [cx + W * 0.45, cy + H], [cx + W * 0.25, cy + H * 0.95], [cx, cy + H * 0.3]]); break; }
    case 'copo': { poly(c, regPoly(12, W * 0.55, 0, cx, cy)); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const p = []; const ca = Math.cos(a), sa = Math.sin(a); const pr = (u, v) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
        poly(c, [pr(0, -W * 0.09), pr(W, -W * 0.09), pr(W, W * 0.09), pr(0, W * 0.09)]); poly(c, [pr(W * 0.55, 0), pr(W * 0.78, -W * 0.3), pr(W * 0.86, -W * 0.22), pr(W * 0.7, 0)]); poly(c, [pr(W * 0.55, 0), pr(W * 0.78, W * 0.3), pr(W * 0.86, W * 0.22), pr(W * 0.7, 0)]); } break; }
    case 'gota': { c.moveTo(cx, cy - H); c.bezierCurveTo(cx + W * 0.4, cy - H * 0.4, cx + W, cy, cx + W, cy + H * 0.35); c.arc(cx, cy + H * 0.35, W, 0, Math.PI); c.bezierCurveTo(cx - W, cy, cx - W * 0.4, cy - H * 0.4, cx, cy - H); c.closePath(); break; }
    default: ell(c, cx, cy, W, H);
  }
}

/* ---------- patrones ---------- */
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const PATTERNS = { rayas: 'Rayas', verticales: 'Rayas verticales', diagonales: 'Diagonales', cuadricula: 'Cuadrícula', rombos: 'Rombos', zigzag: 'Zigzag', ondas: 'Ondas', circulos: 'Círculos concéntricos', radial: 'Rayos', puntos: 'Puntos', mosaico: 'Mosaico', floral: 'Floral', panal: 'Panal' };
function patternMask(F, kind, sp, lw, seed) {
  const W = F.W / 2 + sp, H = F.H / 2 + sp;
  if (kind === 'mosaico') return voronoi(F, sp, lw, seed);
  return F.draw(c => {
    c.lineWidth = lw;
    const lines = (ang) => { const R = Math.hypot(W, H); const ca = Math.cos(ang), sa = Math.sin(ang); c.beginPath(); for (let d = -R; d <= R; d += sp) { c.moveTo(d * -sa - R * ca, d * ca - R * sa); c.lineTo(d * -sa + R * ca, d * ca + R * sa); } c.stroke(); };
    switch (kind) {
      case 'rayas': lines(0); break;
      case 'verticales': lines(Math.PI / 2); break;
      case 'diagonales': lines(Math.PI / 4); break;
      case 'cuadricula': lines(0); lines(Math.PI / 2); break;
      case 'rombos': lines(Math.PI / 4); lines(-Math.PI / 4); break;
      case 'zigzag': c.beginPath(); for (let y = -H; y <= H; y += sp) { c.moveTo(-W, y); let up = true; for (let x = -W; x <= W; x += sp / 2) { c.lineTo(x, y + (up ? -sp * 0.3 : sp * 0.3)); up = !up; } } c.stroke(); break;
      case 'ondas': c.beginPath(); for (let y = -H; y <= H; y += sp) { c.moveTo(-W, y); for (let x = -W; x <= W; x += 0.5) c.lineTo(x, y + Math.sin(x / sp * Math.PI) * sp * 0.3); } c.stroke(); break;
      case 'circulos': c.beginPath(); for (let r = sp; r < Math.hypot(W, H); r += sp) { c.moveTo(r, 0); c.arc(0, 0, r, 0, Math.PI * 2); } c.stroke(); break;
      case 'radial': { const n = Math.max(8, Math.round(2 * Math.PI * 40 / sp)); c.beginPath(); for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 2 * W, Math.sin(a) * 2 * H); } c.stroke(); break; }
      case 'puntos': for (let y = -H; y <= H; y += sp) for (let x = -W + ((Math.round((y + H) / sp) % 2) ? sp / 2 : 0); x <= W; x += sp) { c.beginPath(); c.arc(x, y, lw, 0, Math.PI * 2); c.fill(); } break;
      case 'panal': { const r = sp / Math.sqrt(3); c.beginPath(); let row = 0; for (let y = -H; y <= H; y += 1.5 * r, row++) for (let x = -W + (row % 2 ? sp / 2 : 0); x <= W; x += sp) poly(c, regPoly(6, r, Math.PI / 6, x, y)); c.stroke(); break; }
      case 'floral': { const R = rng(seed); let row = 0; for (let y = -H; y <= H; y += sp * 1.1, row++) for (let x = -W + (row % 2 ? sp * 0.55 : 0); x <= W; x += sp * 1.1) { const r = sp * (0.32 + R() * 0.12); const n = 5 + (R() * 2 | 0); const rot = R() * 6; c.beginPath(); for (let k = 0; k < n; k++) { const a = rot + k * 2 * Math.PI / n; const px = x + r * 0.62 * Math.cos(a), py = y + r * 0.62 * Math.sin(a); c.moveTo(px + r * 0.4, py); c.arc(px, py, r * 0.4, 0, Math.PI * 2); } c.stroke(); c.beginPath(); c.arc(x, y, r * 0.18, 0, Math.PI * 2); c.fill(); } break; }
      default: lines(0);
    }
  });
}
function voronoi(F, sp, lw, seed) {
  const { w, h, res } = F; const R = rng(seed); const pts = [];
  for (let y = -F.H / 2; y < F.H / 2 + sp; y += sp) for (let x = -F.W / 2; x < F.W / 2 + sp; x += sp) pts.push([(x + R() * sp) * res + w / 2, (y + R() * sp) * res + h / 2]);
  const cell = sp * res; const gx = Math.ceil(w / cell) + 2; const grid = new Map();
  pts.forEach((p, k) => { const key = Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell); (grid.get(key) || grid.set(key, []).get(key)).push(k); });
  const lab = new Int32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cx = Math.floor(i / cell), cy = Math.floor(j / cell); let best = -1, bd = Infinity;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const l = grid.get((cx + dx) + ',' + (cy + dy)); if (!l) continue; for (const k of l) { const d = (pts[k][0] - i) ** 2 + (pts[k][1] - j) ** 2; if (d < bd) { bd = d; best = k; } } }
    lab[j * w + i] = best;
  }
  const e = new Uint8Array(w * h);
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const k = j * w + i; if (lab[k] !== lab[k + 1] || lab[k] !== lab[k + w]) e[k] = 1; }
  clearBorder(F, e);
  return dilate(F, e, Math.max(lw / 2 - 0.5 / res, 0.05));
}
function snowflake(F, cx, cy, R, lw, seed) {
  const r = rng(seed);
  const br = [0.35 + r() * 0.1, 0.6 + r() * 0.1, 0.82];
  const bl = [0.22 + r() * 0.12, 0.18 + r() * 0.1, 0.1];
  return F.draw(c => {
    c.lineWidth = lw; c.beginPath();
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 - Math.PI / 2; const ca = Math.cos(a), sa = Math.sin(a); const P = (u, v) => [cx + (u * ca - v * sa) * R, cy + (u * sa + v * ca) * R];
      let p = P(0.12, 0); c.moveTo(...p); p = P(1, 0); c.lineTo(...p);
      br.forEach((b, i) => { for (const s of [-1, 1]) { c.moveTo(...P(b, 0)); c.lineTo(...P(b + bl[i] * 0.7, s * bl[i])); } }); }
    c.stroke(); c.beginPath(); c.arc(cx, cy, R * 0.12, 0, Math.PI * 2); c.stroke();
  });
}
function wifiIcon(F, cx, cy, s, lw) {
  return F.draw(c => { c.lineWidth = lw; for (const r of [0.35, 0.65, 0.95]) { c.beginPath(); c.arc(cx, cy + s * 0.45, r * s * 0.6, -Math.PI * 0.75, -Math.PI * 0.25); c.stroke(); } c.beginPath(); c.arc(cx, cy + s * 0.45, lw * 1.1, 0, Math.PI * 2); c.fill(); });
}

/* ---------- máscara → malla (marching squares + triangulación + extrusión) ---------- */
function newMesh() { return { pos: [], idx: [] }; }
function maskToMesh(F, m0, z0, z1, mesh = newMesh()) {
  const { w, h, res } = F; const iso = 0.5;
  const m = m0.slice();
  for (let pass = 0; pass < 3; pass++) { let ch = 0;
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const k = j * w + i; const a = m[k], b = m[k + 1], c = m[k + w], d = m[k + w + 1];
      if (a && d && !b && !c) { m[k + 1] = 1; m[k + w] = 1; ch++; } else if (b && c && !a && !d) { m[k] = 1; m[k + w + 1] = 1; ch++; } }
    if (!ch) break; }
  const f = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++) { const o = j * w; for (let i = 1; i < w - 1; i++) { const k = o + i; if (!(m[k] | m[k - 1] | m[k + 1] | m[k - w] | m[k + w] | m[k - w - 1] | m[k - w + 1] | m[k + w - 1] | m[k + w + 1])) continue;
    f[k] = (4 * m[k] + 2 * (m[k - 1] + m[k + 1] + m[k - w] + m[k + w]) + m[k - w - 1] + m[k - w + 1] + m[k + w - 1] + m[k + w + 1]) / 16; } }
  const W1 = w + 1; const N = 2 * W1 * (h + 1);
  const nxt = new Int32Array(N).fill(-1); const PX = new Float32Array(N), PY = new Float32Array(N); const starts = [];
  const ek = [0, 0, 0, 0], ex = [0, 0, 0, 0], ey = [0, 0, 0, 0];
  const S = (p, q) => { const k1 = ek[p], k2 = ek[q]; nxt[k1] = k2; PX[k1] = ex[p]; PY[k1] = ey[p]; PX[k2] = ex[q]; PY[k2] = ey[q]; starts.push(k1); };
  const T = 0, R = 1, B = 2, L = 3;
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const a = f[j * w + i], b = f[j * w + i + 1], c = f[(j + 1) * w + i + 1], d = f[(j + 1) * w + i];
    const id = (a > iso ? 8 : 0) | (b > iso ? 4 : 0) | (c > iso ? 2 : 0) | (d > iso ? 1 : 0);
    if (id === 0 || id === 15) continue;
    ek[0] = (j * W1 + i) << 1; ex[0] = i + (iso - a) / (b - a); ey[0] = j;
    ek[1] = ((j * W1 + i + 1) << 1) | 1; ex[1] = i + 1; ey[1] = j + (iso - b) / (c - b);
    ek[2] = ((j + 1) * W1 + i) << 1; ex[2] = i + (iso - d) / (c - d); ey[2] = j + 1;
    ek[3] = ((j * W1 + i) << 1) | 1; ex[3] = i; ey[3] = j + (iso - a) / (d - a);
    switch (id) {
      case 1: S(L, B); break; case 2: S(B, R); break; case 3: S(L, R); break; case 4: S(R, T); break;
      case 5: if ((a + b + c + d) / 4 > iso) { S(L, T); S(R, B); } else { S(L, B); S(R, T); } break;
      case 6: S(B, T); break; case 7: S(L, T); break; case 8: S(T, L); break; case 9: S(T, B); break;
      case 10: if ((a + b + c + d) / 4 > iso) { S(T, R); S(B, L); } else { S(T, L); S(B, R); } break;
      case 11: S(T, R); break; case 12: S(R, L); break; case 13: S(R, B); break; case 14: S(B, L); break;
    }
  }
  const seen = new Uint8Array(N); const loops = [];
  for (const s0 of starts) {
    if (seen[s0]) continue; const pts = []; let s = s0, guard = 0;
    while (s >= 0 && !seen[s] && guard++ < 5e6) { seen[s] = 1; pts.push([(PX[s] + 0.5 - w / 2) / res, -(PY[s] + 0.5 - h / 2) / res]); s = nxt[s]; }
    if (pts.length >= 3) loops.push(pts);
  }
  const eps = 0.3 / res;
  const outers = [], holes = [];
  for (let raw of loops) {
    raw = dedup(raw.reverse()); const lp = dedup(rdpClosed(raw, eps)); if (lp.length < 3 || raw.length < 3) continue;
    const A = area(raw); if (Math.abs(A) < 0.02) continue;
    const o = { pts: lp, raw, A, bb: lbbox(raw), holes: [] }; (A > 0 ? outers : holes).push(o);
  }
  outers.sort((p, q) => p.A - q.A);
  for (const hl of holes) { const p = hl.raw[0]; for (const o of outers) { if (o.A < -hl.A) continue; if (p[0] < o.bb[0] || p[0] > o.bb[2] || p[1] < o.bb[1] || p[1] > o.bb[3]) continue; if (pip(p, o.raw)) { o.holes.push(hl); break; } } }
  for (const o of outers) {
    const hp = o.holes.map(h => h.pts), hr = o.holes.map(h => h.raw);
    if (extrude(mesh, o.pts, hp, z0, z1)) continue;
    if (extrude(mesh, o.raw, hr, z0, z1)) continue;
    MESH_WARN.n++; MESH_WARN.last = { A: o.A, n: o.raw.length, holes: o.holes.length };
    if (o.A > 1.5) extrude(mesh, o.raw, o.holes.map(h => h.raw), z0, z1, true);
  }
  return mesh;
}
function dedup(p) { const o = []; for (const q of p) { const l = o[o.length - 1]; if (!l || Math.abs(l[0] - q[0]) > 1e-6 || Math.abs(l[1] - q[1]) > 1e-6) o.push(q); } while (o.length > 1 && Math.abs(o[0][0] - o[o.length - 1][0]) < 1e-6 && Math.abs(o[0][1] - o[o.length - 1][1]) < 1e-6) o.pop(); return o; }
function area(p) { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function lbbox(p) { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { if (q[0] < a) a = q[0]; if (q[1] < b) b = q[1]; if (q[0] > c) c = q[0]; if (q[1] > d) d = q[1]; } return [a, b, c, d]; }
function pip(p, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
function rdp(pts, eps) {
  const n = pts.length; if (n < 3) return pts; const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1; const st = [[0, n - 1]]; const e2 = eps * eps;
  while (st.length) { const [s, e] = st.pop(); const [x1, y1] = pts[s], [x2, y2] = pts[e]; const dx = x2 - x1, dy = y2 - y1; const L2 = dx * dx + dy * dy || 1e-12; let md = 0, mi = -1;
    for (let i = s + 1; i < e; i++) { const [x, y] = pts[i]; const cr = (x - x1) * dy - (y - y1) * dx; const d = cr * cr / L2; if (d > md) { md = d; mi = i; } }
    if (md > e2) { keep[mi] = 1; st.push([s, mi], [mi, e]); } }
  return pts.filter((_, i) => keep[i]);
}
function rdpClosed(p, eps) { if (p.length < 10) return p; let far = 0, fd = -1; for (let i = 1; i < p.length; i++) { const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2; if (d > fd) { fd = d; far = i; } }
  const a = rdp(p.slice(0, far + 1), eps), b = rdp(p.slice(far).concat([p[0]]), eps); return a.slice(0, -1).concat(b.slice(0, -1)); }
const MESH_WARN = { n: 0 };
function extrude(mesh, outer, holes, z0, z1, force, strict) {
  const rings = [outer, ...holes]; const all = [].concat(...rings); const n = all.length;
  const tris = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p[0], p[1])), holes.map(hh => hh.map(p => new THREE.Vector2(p[0], p[1]))));
  if (!force) { let ta = 0, deg = 0; for (const [a, b, c] of tris) { const A = all[a], B = all[b], C = all[c]; const ar = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2; ta += ar; if (ar < 1e-7) deg++; } if (deg && strict) return false;
    let pa = Math.abs(area(outer)); for (const h of holes) pa -= Math.abs(area(h)); if (Math.abs(ta - pa) > Math.max(0.01, pa * 0.002)) return false; }
  const base = mesh.pos.length / 3;
  for (const p of all) mesh.pos.push(p[0], p[1], z1); for (const p of all) mesh.pos.push(p[0], p[1], z0);
  for (const t of tris) { let [a, b, c] = t; const A = all[a], B = all[b], C = all[c]; if ((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]) < 0) [b, c] = [c, b];
    mesh.idx.push(base + a, base + b, base + c, base + n + a, base + n + c, base + n + b); }
  let off = 0;
  for (const r of rings) { const m = r.length; for (let k = 0; k < m; k++) { const k1 = (k + 1) % m; const t0 = base + off + k, t1 = base + off + k1, b0 = t0 + n, b1 = t1 + n; mesh.idx.push(b0, b1, t1, b0, t1, t0); } off += m; }
  return true;
}
/* volumen con signo; si es negativo se invierte la orientación */
function fixOrientation(mesh) {
  const P = mesh.pos, I = mesh.idx; let v = 0;
  for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); }
  if (v < 0) for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; }
  return Math.abs(v) / 6;
}
/* torno: perfil cerrado [[r,z],...] alrededor de (cx,cy) */
function lathe(profile, cx = 0, cy = 0, segs = 96, mesh = newMesh()) {
  const base = mesh.pos.length / 3; const ids = [];
  for (const [r, z] of profile) {
    if (r < 1e-6) { ids.push({ axis: true, i: mesh.pos.length / 3 }); mesh.pos.push(cx, cy, z); }
    else { const i0 = mesh.pos.length / 3; for (let s = 0; s < segs; s++) { const a = s * 2 * Math.PI / segs; mesh.pos.push(cx + r * Math.cos(a), cy + r * Math.sin(a), z); } ids.push({ axis: false, i: i0 }); }
  }
  const n = profile.length; const v = (p, s) => p.axis ? p.i : p.i + (s % segs);
  const start = mesh.idx.length;
  for (let k = 0; k < n; k++) { const P = ids[k], Q = ids[(k + 1) % n]; if (P.axis && Q.axis) continue;
    for (let s = 0; s < segs; s++) { const a = v(P, s), b = v(Q, s), c = v(Q, s + 1), d = v(P, s + 1);
      if (P.axis) mesh.idx.push(a, b, c); else if (Q.axis) mesh.idx.push(a, b, d); else mesh.idx.push(a, b, c, a, c, d); } }
  const sub = { pos: mesh.pos, idx: mesh.idx.slice(start) }; fixOrientation(sub); mesh.idx.length = start; mesh.idx.push(...sub.idx);
  return mesh;
}
/* mapa de alturas (litofanía): heights Float32Array nx*ny (mm), paso en mm */
function heightMesh(hm, nx, ny, step, mesh = newMesh()) {
  const base = mesh.pos.length / 3; const X = i => (i - (nx - 1) / 2) * step, Y = j => -(j - (ny - 1) / 2) * step;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) mesh.pos.push(X(i), Y(j), hm[j * nx + i]);
  const top = (i, j) => base + j * nx + i;
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = top(i, j), b = top(i + 1, j), c = top(i, j + 1), d = top(i + 1, j + 1); mesh.idx.push(a, c, b, b, c, d); }
  const loop = []; for (let i = 0; i < nx; i++) loop.push([i, ny - 1]); for (let j = ny - 2; j >= 0; j--) loop.push([nx - 1, j]); for (let i = nx - 2; i >= 0; i--) loop.push([i, 0]); for (let j = 1; j < ny - 1; j++) loop.push([0, j]);
  const bb = mesh.pos.length / 3; for (const [i, j] of loop) mesh.pos.push(X(i), Y(j), 0); const ctr = mesh.pos.length / 3; mesh.pos.push(0, 0, 0);
  const L = loop.length;
  for (let k = 0; k < L; k++) { const k1 = (k + 1) % L; const t0 = top(...loop[k]), t1 = top(...loop[k1]), b0 = bb + k, b1 = bb + k1; mesh.idx.push(b0, b1, t1, b0, t1, t0, ctr, b1, b0); }
  return mesh;
}

/* tubo de radio variable: rOut(θ,z), rIn(θ,z) (o null = macizo hasta el eje) entre z0 y z1 */
function tube(rOut, rIn, z0, z1, segs, nz, cx = 0, cy = 0, mesh = newMesh()) {
  const start = mesh.idx.length; const base = mesh.pos.length / 3; const ring = segs * (nz + 1);
  const P = (r, a, z) => mesh.pos.push(cx + r * Math.cos(a), cy + r * Math.sin(a), z);
  for (let k = 0; k <= nz; k++) { const z = z0 + (z1 - z0) * k / nz; for (let s = 0; s < segs; s++) { const a = s * 2 * Math.PI / segs; P(rOut(a, z), a, z); } }
  let inner = -1, cBot = -1, cTop = -1;
  if (rIn) { inner = mesh.pos.length / 3; for (let k = 0; k <= nz; k++) { const z = z0 + (z1 - z0) * k / nz; for (let s = 0; s < segs; s++) { const a = s * 2 * Math.PI / segs; P(rIn(a, z), a, z); } } }
  else { cBot = mesh.pos.length / 3; mesh.pos.push(cx, cy, z0); cTop = cBot + 1; mesh.pos.push(cx, cy, z1); }
  const O = (k, s) => base + k * segs + (s % segs), I = (k, s) => inner + k * segs + (s % segs);
  for (let k = 0; k < nz; k++) for (let s = 0; s < segs; s++) {
    mesh.idx.push(O(k, s), O(k, s + 1), O(k + 1, s + 1), O(k, s), O(k + 1, s + 1), O(k + 1, s));
    if (rIn) mesh.idx.push(I(k, s), I(k + 1, s + 1), I(k, s + 1), I(k, s), I(k + 1, s), I(k + 1, s + 1));
  }
  for (let s = 0; s < segs; s++) {
    if (rIn) { mesh.idx.push(O(0, s), I(0, s), I(0, s + 1), O(0, s), I(0, s + 1), O(0, s + 1)); mesh.idx.push(O(nz, s), O(nz, s + 1), I(nz, s + 1), O(nz, s), I(nz, s + 1), I(nz, s)); }
    else { mesh.idx.push(cBot, O(0, s + 1), O(0, s)); mesh.idx.push(cTop, O(nz, s), O(nz, s + 1)); }
  }
  const sub = { pos: mesh.pos, idx: mesh.idx.slice(start) }; fixOrientation(sub); mesh.idx.length = start; for (const v of sub.idx) mesh.idx.push(v);
  return mesh;
}
/* perfil de rosca trapecial (0..1), flancos a 45° con paso P y profundidad d */
function threadProfile(a, z, P, d) { const u = (z - P * a / (2 * Math.PI)) / P; const v = Math.abs(u - Math.floor(u) - 0.5); const half = 0.5 - 0.05; const fl = d / P; return Math.max(0, Math.min(1, (half - v) / fl + 0.0)); }
/* lámina curva cerrada (pétalos): S(u,v) → [x,y,z] y normal de desplazamiento N(u,v) */
function shell(S, N, t, nu, nv, mesh = newMesh()) {
  const start = mesh.idx.length; const b = mesh.pos.length / 3;
  for (let pass = 0; pass < 2; pass++) for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const u = -1 + 2 * i / nu, v = j / nv; const p = S(u, v); const n = N(u, v); const o = pass ? t : 0; mesh.pos.push(p[0] + n[0] * o, p[1] + n[1] * o, p[2] + n[2] * o); }
  const A = (i, j) => b + j * (nu + 1) + i, Bv = (i, j) => b + (nu + 1) * (nv + 1) + j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { mesh.idx.push(A(i, j), A(i + 1, j + 1), A(i + 1, j), A(i, j), A(i, j + 1), A(i + 1, j + 1)); mesh.idx.push(Bv(i, j), Bv(i + 1, j), Bv(i + 1, j + 1), Bv(i, j), Bv(i + 1, j + 1), Bv(i, j + 1)); }
  for (let i = 0; i < nu; i++) { mesh.idx.push(A(i, 0), A(i + 1, 0), Bv(i + 1, 0), A(i, 0), Bv(i + 1, 0), Bv(i, 0)); mesh.idx.push(A(i, nv), Bv(i + 1, nv), A(i + 1, nv), A(i, nv), Bv(i, nv), Bv(i + 1, nv)); }
  for (let j = 0; j < nv; j++) { mesh.idx.push(A(0, j), Bv(0, j + 1), A(0, j + 1), A(0, j), Bv(0, j), Bv(0, j + 1)); mesh.idx.push(A(nu, j), A(nu, j + 1), Bv(nu, j + 1), A(nu, j), Bv(nu, j + 1), Bv(nu, j)); }
  const sub = { pos: mesh.pos, idx: mesh.idx.slice(start) }; fixOrientation(sub); mesh.idx.length = start; for (const v of sub.idx) mesh.idx.push(v);
  return mesh;
}
/* mapa de alturas limitado a una máscara: hz(k) → altura superior del píxel k; base en z0 */
function maskHeightMesh(F, m0, hz, z0 = 0, mesh = newMesh()) {
  const { w, h, res } = F; const m = m0.slice();
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) { const k = j * w + i; if (m[k] && m[k + w + 1] && !m[k + 1] && !m[k + w]) { m[k + 1] = 1; m[k + w] = 1; } else if (m[k + 1] && m[k + w] && !m[k] && !m[k + w + 1]) { m[k] = 1; m[k + w + 1] = 1; } }
  const W1 = w + 1; const top = new Int32Array(W1 * (h + 1)).fill(-1), bot = new Int32Array(W1 * (h + 1)).fill(-1);
  const start = mesh.idx.length; const X = i => (i - w / 2) / res, Y = j => -(j - h / 2) / res;
  const cornerZ = (ci, cj) => { let s = 0, n = 0; for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= w || j >= h) continue; const k = j * w + i; if (m[k]) { s += hz(k); n++; } } return n ? s / n : z0; };
  const T = (ci, cj) => { const q = cj * W1 + ci; if (top[q] < 0) { top[q] = mesh.pos.length / 3; mesh.pos.push(X(ci), Y(cj), cornerZ(ci, cj)); } return top[q]; };
  const Bt = (ci, cj) => { const q = cj * W1 + ci; if (bot[q] < 0) { bot[q] = mesh.pos.length / 3; mesh.pos.push(X(ci), Y(cj), z0); } return bot[q]; };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; if (!m[k]) continue;
    const a = T(i, j), b = T(i + 1, j), c = T(i + 1, j + 1), d = T(i, j + 1); mesh.idx.push(a, d, b, b, d, c);
    const A = Bt(i, j), B = Bt(i + 1, j), Cc = Bt(i + 1, j + 1), D = Bt(i, j + 1); mesh.idx.push(A, B, D, B, Cc, D);
    if (j === 0 || !m[k - w]) mesh.idx.push(a, b, B, a, B, A);
    if (j === h - 1 || !m[k + w]) mesh.idx.push(d, Cc, c, d, D, Cc);
    if (i === 0 || !m[k - 1]) mesh.idx.push(a, A, D, a, D, d);
    if (i === w - 1 || !m[k + 1]) mesh.idx.push(b, c, Cc, b, Cc, B);
  }
  const sub = { pos: mesh.pos, idx: mesh.idx.slice(start) }; fixOrientation(sub); mesh.idx.length = start; for (const v of sub.idx) mesh.idx.push(v);
  return mesh;
}
function translateMesh(m, dx, dy = 0, dz = 0) { for (let k = 0; k < m.pos.length; k += 3) { m.pos[k] += dx; m.pos[k + 1] += dy; m.pos[k + 2] += dz; } return m; }
function mergeMeshes(list) { const o = newMesh(); for (const m of list) { const b = o.pos.length / 3; for (const v of m.pos) o.pos.push(v); for (const i of m.idx) o.idx.push(i + b); } return o; }
/* campo con signo: >0 fuera (distancia a la máscara), <0 dentro */
function signedDist(F, m) { const Do = edt(F, m), Di = edt(F, inv(F, m)); const o = new Float32Array(m.length); for (let i = 0; i < o.length; i++) o[i] = m[i] ? -Math.sqrt(Di[i]) / F.res : Math.sqrt(Do[i]) / F.res; return o; }
function level(sd, a, b) { const o = new Uint8Array(sd.length); for (let i = 0; i < o.length; i++) o[i] = sd[i] > a && sd[i] <= b ? 1 : 0; return o; }

function meshFromMasks(F, layer) { const m = maskToMesh(F, layer.mask, layer.z0, layer.z1); fixOrientation(m); return m; }

/* ---------- exportación ---------- */
function toSTL(meshes) {
  let nt = 0; for (const m of meshes) nt += m.idx.length / 3;
  const buf = new ArrayBuffer(84 + nt * 50); const dv = new DataView(buf);
  const hdr = 'Taller 3D - STL binario'; for (let i = 0; i < hdr.length; i++) dv.setUint8(i, hdr.charCodeAt(i));
  dv.setUint32(80, nt, true); let o = 84;
  for (const m of meshes) { const P = m.pos, I = m.idx;
    for (let t = 0; t < I.length; t += 3) { const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
      for (const q of [a, b, c]) { dv.setFloat32(o, P[q], true); dv.setFloat32(o + 4, P[q + 1], true); dv.setFloat32(o + 8, P[q + 2], true); o += 12; }
      dv.setUint16(o, 0, true); o += 2; } }
  return buf;
}
const xesc = s => String(s).replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[ch]));
async function to3MF(parts, title) {
  const out = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="es-ES" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n');
  out.push(`<metadata name="Title">${xesc(title)}</metadata>\n<metadata name="Application">Taller 3D</metadata>\n<resources>\n<basematerials id="1">\n`);
  parts.forEach(p => out.push(`<base name="${xesc(p.name)}" displaycolor="${(p.color || '#cccccc').toUpperCase()}FF"/>\n`));
  out.push('</basematerials>\n');
  parts.forEach((p, k) => {
    out.push(`<object id="${k + 2}" type="model" name="${xesc(p.name)}" pid="1" pindex="${k}"><mesh><vertices>\n`);
    const P = p.mesh.pos; const vs = []; for (let i = 0; i < P.length; i += 3) vs.push(`<vertex x="${P[i].toFixed(3)}" y="${P[i + 1].toFixed(3)}" z="${P[i + 2].toFixed(3)}"/>`);
    out.push(vs.join('\n')); out.push('\n</vertices><triangles>\n');
    const I = p.mesh.idx; const ts = []; for (let t = 0; t < I.length; t += 3) ts.push(`<triangle v1="${I[t]}" v2="${I[t + 1]}" v3="${I[t + 2]}"/>`);
    out.push(ts.join('\n')); out.push('\n</triangles></mesh></object>\n');
  });
  const pid = parts.length + 2;
  out.push(`<object id="${pid}" type="model" name="${xesc(title)}"><components>\n`);
  parts.forEach((p, k) => out.push(`<component objectid="${k + 2}"/>\n`));
  out.push(`</components></object>\n</resources>\n<build><item objectid="${pid}"/></build>\n</model>\n`);
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>', { createFolders: false });
  z.file('3D/3dmodel.model', out.join(''), { createFolders: false });
  return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/* ---------- imágenes de ejemplo ---------- */
function demoImage(kind = 'dibujo') {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512); x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'foto') {
    const g = x.createRadialGradient(256, 200, 20, 256, 256, 330); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#999'); g.addColorStop(1, '#222'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    x.fillStyle = '#111'; x.beginPath(); shapePath(x, 'corazon', 256, 280, 230, 210); x.fill();
    x.fillStyle = '#eee'; x.font = 'bold 60px sans-serif'; x.textAlign = 'center'; x.fillText('♥', 256, 300);
  } else if (kind === 'color') {
    x.clearRect(0, 0, 512, 512); x.fillStyle = '#b9a6e8'; x.beginPath(); shapePath(x, 'conejo', 256, 256, 330, 440); x.fill();
    x.strokeStyle = '#111'; x.lineWidth = 12; x.stroke(); x.fillStyle = '#111'; x.beginPath(); x.arc(205, 330, 18, 0, 7); x.arc(307, 330, 18, 0, 7); x.fill();
    x.beginPath(); x.moveTo(236, 380); x.quadraticCurveTo(256, 400, 276, 380); x.stroke();
    x.fillStyle = '#f4b6c8'; x.beginPath(); ell(x, 170, 160, 26, 70, -0.15); ell(x, 342, 160, 26, 70, 0.15); x.fill();
  } else if (kind === 'castillo') {
    x.clearRect(0, 0, 512, 512); x.fillStyle = '#000'; x.beginPath();
    const tw = (cx, w, top) => { x.rect(cx - w / 2, top, w, 470 - top); for (let k = 0; k < 3; k++) x.rect(cx - w / 2 + k * w / 2.5, top - 18, w / 5, 18); };
    tw(110, 70, 170); tw(402, 70, 170); tw(256, 90, 80); x.rect(110, 260, 292, 210); x.fill();
    x.beginPath(); x.moveTo(256, 20); x.lineTo(296, 80); x.lineTo(216, 80); x.fill(); x.beginPath(); x.moveTo(110, 110); x.lineTo(140, 170); x.lineTo(80, 170); x.fill(); x.beginPath(); x.moveTo(402, 110); x.lineTo(432, 170); x.lineTo(372, 170); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(256, 400, 40, Math.PI, 0); x.rect(216, 400, 80, 70); x.fill(); for (const [a, b] of [[110, 220], [402, 220], [256, 150]]) { x.beginPath(); x.rect(a - 8, b, 16, 26); x.fill(); } x.globalCompositeOperation = 'source-over';
  } else if (kind === 'silueta') {
    x.clearRect(0, 0, 512, 512); x.fillStyle = '#000'; x.beginPath(); shapePath(x, 'conejo', 256, 256, 330, 440); x.fill();
  } else if (kind === 'logo') {
    x.clearRect(0, 0, 512, 512); x.fillStyle = '#000'; x.beginPath(); poly(x, star(5, 230, 100, 256, 270)); x.fill();
  } else {
    x.strokeStyle = '#000'; x.lineWidth = 14; x.beginPath(); shapePath(x, 'corazon', 256, 256, 440, 400); x.stroke();
    x.lineWidth = 9; x.beginPath(); shapePath(x, 'flor', 256, 230, 170, 170); x.stroke(); x.beginPath(); x.arc(256, 230, 32, 0, 7); x.stroke();
    x.beginPath(); x.moveTo(256, 315); x.quadraticCurveTo(240, 380, 256, 420); x.stroke();
    x.beginPath(); ell(x, 205, 375, 42, 18, -0.5); x.stroke(); x.beginPath(); ell(x, 307, 360, 42, 18, 0.5); x.stroke();
  }
  return c;
}

return { tube, threadProfile, shell, maskHeightMesh, translateMesh, mergeMeshes, signedDist, level, MESH_WARN, setQuality, QUALITY, FONTS, font, loadFont, measure, fitSize, frame, or, and, sub, inv, count, edt, dilate, erode, close, open, outline, ring, fillHoles, bbox, extreme, shift, mirrorTo, components,
  SHAPES, shapePath, PATTERNS, snowflake, wifiIcon, star, regPoly, roundRect, maskToMesh, meshFromMasks, fixOrientation, lathe, heightMesh, newMesh, toSTL, to3MF, demoImage, rng };
})();
