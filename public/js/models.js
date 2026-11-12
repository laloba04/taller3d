/* Taller 3D — catálogo de modelos (código original) */
'use strict';
const CAT = (() => {
const { frame, or, and, sub, dilate, erode, close, outline, ring, fillHoles, bbox, extreme, shift, mirrorTo, components, font, measure, fitSize } = K;
const C = { blanco: '#F4F1EA', negro: '#2B2D42', rojo: '#E4572E', rosa: '#EF6F9C', azul: '#3D7DD8', celeste: '#7EC8E3', verde: '#3BA776', oro: '#E0B13A', lila: '#8E6CCF', marron: '#9C6B4A', gris: '#9AA0A6', naranja: '#F39237', crema: '#E9D8B4', translucido: '#F8F6F0' };

/* ---------- parámetros ---------- */
const txt = (k, label, def, o = {}) => ({ k, label, type: 'text', def, ...o });
const area = (k, label, def, o = {}) => ({ k, label, type: 'area', def, ...o });
const fnt = (k = 'fuente', label = 'Fuente', def = 'pacifico', o = {}) => ({ k, label, type: 'font', def, ...o });
const num = (k, label, def, min, max, step = 0.5, o = {}) => ({ k, label, type: 'num', def, min, max, step, unit: 'mm', ...o });
const cnt = (k, label, def, min, max, o = {}) => ({ k, label, type: 'num', def, min, max, step: 1, unit: '', ...o });
const sel = (k, label, def, opts, o = {}) => ({ k, label, type: 'sel', def, opts, ...o });
const chk = (k, label, def, o = {}) => ({ k, label, type: 'chk', def, ...o });
const img = (k, label, demo = 'dibujo', o = {}) => ({ k, label, type: 'img', demo, ...o });
const shp = (def, list, k = 'forma', label = 'Forma') => sel(k, label, def, Object.fromEntries(list.map(s => [s, K.SHAPES[s]])));
const pat = (def, k = 'patron', label = 'Patrón') => sel(k, label, def, K.PATTERNS);
const HOLE = (def = 'arriba') => [sel('agujero', 'Anilla', def, { arriba: 'Arriba', izq: 'Izquierda', der: 'Derecha', abajo: 'Abajo', no: 'Sin anilla' }), num('dAg', 'Ø agujero', 4.5, 3, 8, 0.5, { show: p => p.agujero !== 'no' }), num('movAg', 'Mover anilla', 0, -100, 100, 5, { unit: '%', show: p => p.agujero !== 'no' })];
const STAND = (def = true) => chk('peana', 'Incluir peana (soporte con ranura)', def);

/* ---------- utilidades ---------- */
const lines = (s, d) => { const a = String(s ?? '').split('\n').map(t => t.trim()).filter(Boolean); return a.length ? a : [d]; };
const L = (name, mask, z0, z1, color) => ({ name, mask, z0, z1, color });
const LM = (name, mesh, color) => ({ name, mesh, color });
function tdim(t, f, width, lh) { const m = measure(t, f, lh); const s = width / m.w; return { s, w: width, h: m.h * s }; }
function imgFit(im, maxW, maxH) { const r = (im.width || 1) / (im.height || 1); let w = maxW, h = maxW / r; if (h > maxH) { h = maxH; w = maxH * r; } return { w, h }; }
/* anilla en una pestaña por fuera del borde: el agujero no recorta la figura.
   pos: arriba | izq | der | abajo | no; ya,yb: franja vertical donde buscar el borde (izq/der); mov: -100..100 % a lo largo del borde */
function holeTab(F, base, pos, d, ya, yb, mov = 0) {
  if (!pos || pos === 'no') return { base, hole: null, clear: null };
  const r = d / 2, R = r + 2.4, gap = r + 0.6, bb = bbox(F, base), k = Math.max(-1, Math.min(1, (+mov || 0) / 100)) * 0.85; let c;
  if (pos === 'izq' || pos === 'der') {
    const y = bb.cy + k * bb.bh / 2; const e = ya !== undefined && !k ? extreme(F, base, pos === 'izq' ? 'left' : 'right', ya, yb) : extreme(F, base, pos === 'izq' ? 'left' : 'right', y - 1, y + 1);
    c = [e[0] + (pos === 'izq' ? -gap : gap), e[1]];
  } else {
    const x = bb.cx + k * bb.bw / 2; const s = bb.bw; const dir = pos === 'abajo' ? 'bottom' : 'top';
    const e = k ? extreme(F, base, dir, x - 1, x + 1) : extreme(F, base, dir, bb.x0 + s * 0.38, bb.x1 - s * 0.38);
    c = [e[0], e[1] + (pos === 'abajo' ? gap : -gap)];
  }
  const hole = F.disk(c[0], c[1], r);
  const nb = sub(close(F, or(base, F.disk(c[0], c[1], R)), 1.2), hole);
  return { base: nb, hole, clear: F.disk(c[0], c[1], gap) };
}
/* lengüeta inferior + peana con ranura (en posición y0) */
function standParts(F, tabW, thick, cx, y0) {
  const len = tabW + 18, dep = Math.max(20, thick * 5);
  const blk = F.rectC(cx, y0 + dep / 2, len, dep, 3);
  const slot = F.rectC(cx, y0 + dep / 2, tabW + 0.6, thick + 0.4, 0);
  return [L('Peana', blk, 0, 2.5, C.negro), L('Peana (ranura)', sub(blk, slot), 2.5, 10, C.negro)];
}
const tabMask = (F, cx, yTop, tabW, h = 7) => F.rect(cx - tabW / 2, yTop - 1, cx + tabW / 2, yTop + h, 0.5);
function clipText(F, m, region) { return and(m, region); }
const FIT = { circulo: [.74, .58], ovalo: [.8, .6], ondulado: [.68, .52], ovalo_ondulado: [.74, .55], corazon: [.6, .42, 0, -.1], estrella: [.42, .26, 0, .1], hexagono: [.74, .55], octogono: [.74, .55],
  cuadrado: [.82, .7], rect: [.88, .74], capsula: [.8, .64], arco: [.8, .62, 0, .08], hueso: [.62, .52], pez: [.55, .55, .12], huella: [.4, .22, 0, .33], conejo: [.62, .3, 0, .26], zanahoria: [.5, .34, .06],
  flor: [.6, .5], nube: [.7, .45, 0, .1], escudo: [.74, .5, 0, -.08], bola: [.64, .48, 0, .1], arbol: [.48, .22, 0, .26], campana: [.6, .28, 0, .14], casa: [.66, .45, 0, .22], galleta: [.48, .2, 0, .06],
  lazo: [.3, .2], copo: [.5, .22], gota: [.6, .38, 0, .28], marcapaginas: [.7, .8] };

/* ===================================================== GENERADORES ===================================================== */

/* llavero / letrero de nombre con contorno (2 o 3 colores, icono opcional) */
function gNombre(p, o = {}) {
  const f = font(p.fuente); const t = lines(p.texto, 'Maria'); const d = tdim(t, f, p.ancho);
  const b = p.borde, b2 = o.tres ? p.borde2 : 0; const iconW = o.icono ? d.h * 1.15 : 0; const R = (p.dAg || 4) / 2 + 4;
  const F = frame(p.ancho + iconW + 2 * (b + b2) + 4 * R, d.h + 2 * (b + b2) + 4 * R + (o.pie ? 6 : 0));
  const tx = iconW ? iconW / 2 + 1 : 0;
  let T = F.text(t, f, d.s, tx, 0);
  if (o.icono) { const im = p.img; const s = imgFit(im, iconW, iconW); T = or(T, F.image(im, tx - p.ancho / 2 - 1.5 - iconW / 2, 0, s.w, s.h, { thr: p.umbral })); }
  let mid = close(F, dilate(F, T, b), Math.min(1.5, b));
  let base = o.tres ? close(F, dilate(F, T, b + b2), 1.5) : mid;
  if (o.pie) { const bb = bbox(F, base); const bar = F.rect(bb.x0 + 2, bb.y1 - 5, bb.x1 - 2, bb.y1, 1); base = or(base, bar); if (!o.tres) mid = base; }
  const h = holeTab(F, base, o.sinAnilla ? 'no' : p.agujero, p.dAg, undefined, undefined, p.movAg); base = h.base;
  const cl = h.clear ? (m) => sub(m, h.clear) : (m) => m;
  const hb = p.hBase, ht = p.hTexto;
  if (o.tres) return { F, layers: [L('Base', base, 0, hb, p.c1 || C.negro), L('Contorno', cl(mid), hb, hb + p.hMedio, C.blanco), L('Texto', cl(T), hb + p.hMedio, hb + p.hMedio + ht, C.rosa)] };
  return { F, layers: [L('Base', base, 0, hb, C.rosa), L('Texto', cl(T), hb, hb + ht, C.blanco)] };
}
/* nombres superpuestos */
function gSuperpuestos(p, o = {}) {
  const f1 = font(p.fuente), f2 = font(p.fuente2); const d1 = tdim(lines(p.texto, 'Elisa'), f1, p.ancho), d2 = tdim(lines(p.texto2, 'Borges'), f2, p.ancho * p.escala2);
  const H = d1.h + d2.h * 0.75; const R = (p.dAg || 4) / 2 + 4;
  const F = frame(p.ancho * 1.25 + 2 * p.borde + 4 * R, H + 2 * p.borde + 4 * R);
  const y1 = -H / 2 + d1.h / 2, y2 = y1 + d1.h / 2 + d2.h * 0.25;
  const T1 = F.text(lines(p.texto, 'Elisa'), f1, d1.s, -p.ancho * 0.08, y1), T2 = F.text(lines(p.texto2, 'Borges'), f2, d2.s, p.ancho * 0.12, y2);
  let base = close(F, dilate(F, or(T1, T2), p.borde), 1.5);
  const h = holeTab(F, base, o.sinAnilla ? 'no' : p.agujero, p.dAg, undefined, undefined, p.movAg); base = h.base;
  const cl = m => h.clear ? sub(m, h.clear) : m;
  const hb = p.hBase;
  return { F, layers: [L('Base', base, 0, hb, C.negro), L('Nombre 1', cl(sub(T1, dilate(F, T2, 0.8))), hb, hb + p.hTexto, C.lila), L('Nombre 2', cl(T2), hb, hb + p.hTexto + 0.6, C.oro)] };
}
/* placa con forma: texto 1-2 líneas, icono, borde, anilla, NFC, glaseado */
function gPlaca(p, o = {}) {
  const forma = o.forma || p.forma; const W = p.ancho, H = p.alto ?? p.ancho; const R = (p.dAg || 4) / 2 + 4;
  const F = frame(W + 4 * R, H + 4 * R);
  let S = forma === 'imagen' ? fillHoles(F, close(F, F.image(p.img, 0, 0, ...Object.values(imgFit(p.img, W, H)), { thr: p.umbral }), 1.5)) : F.shape(forma, 0, 0, W, H);
  const fit = FIT[forma] || [.6, .45]; const bw = W * fit[0], bh = H * fit[1]; const cx = W * (fit[2] || 0), cy = H * (fit[3] || 0);
  const f1 = font(p.fuente), f2 = font(p.fuente2 || p.fuente);
  const t1 = lines(p.texto, ''), t2 = p.texto2 ? lines(p.texto2, '') : null, ic = p.icono ? [p.icono] : null;
  const m1 = measure(t1, f1), m2 = t2 ? measure(t2, f2) : null, mi = ic ? measure(ic, font('emoji')) : null;
  const k2 = p.escala2 || 0.42, gap = 0.12;
  const hTot = s => s * (m1.h + (m2 ? gap + m2.h * k2 : 0) + (mi ? mi.h * 0.9 + gap : 0));
  let s = Math.min(bw / m1.w, m2 ? bw / (m2.w * k2) : Infinity, bh / (hTot(1))); if (!p.texto) s = Math.min(s, 1e9);
  if (o.maxTexto) s = Math.min(s, o.maxTexto);
  let T = F.blank();
  if (p.conImagen && p.img) { const ih = bh * 0.55; const sz = imgFit(p.img, bw, ih); T = or(T, F.image(p.img, cx, cy - bh / 2 + sz.h / 2, sz.w, sz.h, { thr: p.umbral })); const rest = bh - sz.h - 1.5; s = Math.min(s, bw / m1.w, rest / (m1.h + (m2 ? gap + m2.h * k2 : 0))); }
  let y = p.conImagen && p.img ? cy - bh / 2 + bh * 0.55 + 1.5 : cy - hTot(s) / 2;
  if (mi) { const hi = mi.h * s * 0.9; T = or(T, F.text(ic, font('emoji'), s * 0.9, cx, y + hi / 2)); y += hi + gap * s; }
  if (p.texto) { T = or(T, F.text(t1, f1, s, cx, y + m1.h * s / 2)); y += m1.h * s + gap * s; }
  if (m2) T = or(T, F.text(t2, f2, s * k2, cx, y + m2.h * s * k2 / 2));
  const rim = p.borde || 0;
  T = and(T, erode(F, S, rim + 0.8));
  const h = holeTab(F, S, p.agujero, p.dAg, undefined, undefined, p.movAg); let base = h.base;
  const cl = m => h.clear ? sub(m, h.clear) : m;
  const hb = p.hBase, hr = p.hRel; const layers = [];
  if (p.nfc) { const pocket = F.disk(0, 0, p.dNfc / 2 + 0.3); layers.push(L('Base', base, 0, 0.8, o.c1 || C.azul), L('Hueco NFC (pausa aquí)', sub(base, pocket), 0.8, 0.8 + p.eNfc, o.c1 || C.azul), L('Tapa', base, 0.8 + p.eNfc, Math.max(hb, 1.8 + p.eNfc), o.c1 || C.azul)); }
  else layers.push(L('Base', base, 0, hb, o.c1 || C.azul));
  const top = layers[layers.length - 1].z1;
  if (rim > 0) layers.push(L('Borde', cl(ring(F, S, rim)), top, top + hr, o.c2 || C.blanco));
  if (p.glaseado) layers.push(L('Glaseado', cl(ring(F, erode(F, S, 2.4), 1)), top, top + hr, C.blanco));
  layers.push(L('Texto', cl(T), top, top + hr, o.c2 || C.blanco));
  return { F, layers };
}
/* marco para chapa (llavero / imán / test) */
function gChapa(p, o = {}) {
  if (o.test) {
    const ds = [-0.6, -0.3, 0, 0.3, 0.6].map(x => +(p.dChapa + x).toFixed(1)); const sp = p.dChapa + 8;
    const F = frame(sp * ds.length, p.dChapa + 20); const layers = [];
    let rings = F.blank(), labels = F.blank(), tabs = F.blank();
    ds.forEach((d, i) => { const x = (i - (ds.length - 1) / 2) * sp; rings = or(rings, sub(F.disk(x, 0, d / 2 + 1.6), F.disk(x, 0, d / 2)));
      const ty = d / 2 + 5; tabs = or(tabs, F.rectC(x, ty, 16, 8, 2)); labels = or(labels, F.text([(ds[i] - p.dChapa >= 0 ? '+' : '') + (ds[i] - p.dChapa).toFixed(1)], font('montserrat'), 4.2, x, ty)); });
    return { F, layers: [L('Aros de prueba', or(rings, tabs), 0, p.hChapa + 1.2, C.azul), L('Etiquetas', labels, p.hChapa + 1.2, p.hChapa + 1.8, C.blanco)] };
  }
  const D = p.dChapa + p.holgura; const k = p.forma === 'circulo' ? 1 : (p.forma === 'estrella' ? 1.75 : p.forma === 'arbol' || p.forma === 'galleta' ? 1.6 : 1.22);
  const Wo = (D + 2 * p.pared) * k; const R = (p.dAg || 4) / 2 + 4;
  const F = frame(Wo + 4 * R, Wo + 4 * R);
  const fit = FIT[p.forma] || [0, 0]; const cy = p.forma === 'circulo' ? 0 : Wo * (fit[3] || 0);
  const S = or(F.shape(p.forma, 0, 0, Wo, Wo), F.disk(0, cy, D / 2 + p.pared));
  const pocket = F.disk(0, cy, D / 2), lipIn = F.disk(0, cy, D / 2 - p.labio);
  const h = holeTab(F, S, o.iman ? 'no' : p.agujero, p.dAg, undefined, undefined, p.movAg); const base = h.base;
  const fondo = o.iman ? sub(base, F.disk(0, cy, D / 2 - 3)) : base;
  const f0 = 1.2, hc = p.hChapa;
  const ztop = f0 + hc + 0.8; const layers = [L('Fondo', fondo, 0, f0, C.azul), L('Pared', sub(base, pocket), f0, f0 + hc, C.azul), L('Pestaña de sujeción', sub(base, lipIn), f0 + hc, ztop, C.azul)];
  if (p.adorno && p.adorno !== 'no') { const bb = bbox(F, S); let ad;
    if (p.adorno === 'lazo') ad = F.shape('lazo', 0, bb.y0 + Wo * 0.06, Wo * 0.55, Wo * 0.36);
    else if (p.adorno === 'acebo') ad = F.draw(c => { const x = bb.x0 + Wo * 0.2, y = bb.y0 + Wo * 0.2, r = Wo * 0.13; for (const a of [-0.5, 0.9]) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.ellipse(r * 0.9, 0, r, r * 0.42, 0, 0, Math.PI * 2); c.fill(); c.restore(); } });
    else ad = F.blank();
    const berries = p.adorno === 'acebo' ? F.draw(c => { const x = bb.x0 + Wo * 0.2, y = bb.y0 + Wo * 0.2, r = Wo * 0.05; for (const [dx, dy] of [[0, 0], [r * 1.6, r * 0.6], [r * 0.4, r * 1.7]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, Math.PI * 2); c.fill(); } }) : F.blank();
    const keep = dilate(F, pocket, 0.4); ad = sub(ad, keep); const be = sub(berries, keep);
    if (h.clear) { ad = sub(ad, h.clear); }
    for (const Lr of layers) Lr.mask = sub(Lr.mask, ad, be);
    layers.push(L(p.adorno === 'lazo' ? 'Lazo' : 'Hojas de acebo', ad, 0, ztop + 0.6, p.adorno === 'lazo' ? C.rojo : C.verde)); if (K.count(be)) layers.push(L('Bayas', be, 0, ztop + 1, C.rojo)); }
  return { F, layers };
}
/* llavero espejo con texto en arco */
function gEspejo(p) {
  const r0 = p.dEspejo / 2 + 0.25, R = r0 + p.banda; const F = frame(2 * R + 16, 2 * R + 16);
  const h = holeTab(F, F.disk(0, 0, R), p.agujero, p.dAg, undefined, undefined, p.movAg); const f = font(p.fuente);
  const rT = r0 + p.banda * 0.28; const sz = p.banda * 0.62;
  let T = F.blank(); if (p.texto) T = or(T, F.arcText(p.texto, f, sz, 0, 0, rT, false)); if (p.texto2) T = or(T, F.arcText(p.texto2, f, sz, 0, 0, rT + sz * 0.15, true));
  T = and(T, sub(F.disk(0, 0, R - 0.8), F.disk(0, 0, r0 + 0.6)));
  const cl = m => h.clear ? sub(m, h.clear) : m;
  return { F, layers: [L('Fondo', h.base, 0, 2, C.rojo), L('Aro (espejo dentro)', cl(sub(F.disk(0, 0, R), F.disk(0, 0, r0))), 2, 2 + p.hEspejo, C.rojo), L('Texto', cl(T), 2 + p.hEspejo, 2 + p.hEspejo + 0.8, C.blanco)] };
}
/* medallón flor con nombre en arco */
function gRosa(p) {
  const R = p.diametro / 2; const F = frame(2 * R + 16, 2 * R + 16);
  const outer = F.shape('ondulado', 0, 0, 2 * R, 2 * R); const h = holeTab(F, outer, p.agujero, p.dAg, undefined, undefined, p.movAg); const cl = m => h.clear ? sub(m, h.clear) : m;
  const cy = p.texto ? -R * 0.14 : 0; const rr = R * (p.texto ? 0.6 : 0.78); const layers = [L('Base', h.base, 0, 2.2, C.verde)];
  const rings = 5; let z = 2.2;
  for (let k = 0; k < rings; k++) { const sc = 1 - k * 0.19; const pet = F.draw(c => { c.translate(0, cy); c.rotate(k * 0.55); K.shapePath(c, 'flor', 0, 0, 2 * rr * sc, 2 * rr * sc); c.fill(); });
    const gap = F.draw(c => { c.translate(0, cy); c.rotate(k * 0.55); c.lineWidth = 0.7; const n = 8; c.beginPath(); for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n + Math.PI / n; c.moveTo(0, 0); c.lineTo(Math.cos(a) * rr * sc, Math.sin(a) * rr * sc); } c.stroke(); });
    const layer = sub(pet, k < rings - 1 ? gap : F.blank(), k > 0 ? F.blank() : F.blank()); layers.push(L('Pétalos ' + (k + 1), cl(sub(layer, ring(F, layer, 0.45))), z, z + 0.9 + k * 0.15, C.rosa)); z += 0.9 + k * 0.15; }
  layers.push(L('Centro', F.draw(c => { c.translate(0, cy); c.lineWidth = 0.8; c.beginPath(); for (let a = 0; a < 6 * Math.PI; a += 0.1) { const r = rr * 0.04 * a; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke(); }), z, z + 0.6, C.rosa));
  if (p.texto) { const f = font(p.fuente); const T = F.arcText(p.texto, f, R * 0.2, 0, -R * 0.1, R * 0.7, true); layers.push(L('Texto', cl(and(T, erode(F, outer, 1.5))), 2.2, 3.2, C.blanco)); }
  layers.push(L('Borde', cl(ring(F, outer, 1.6)), 2.2, 3.2, C.rosa));
  return { F, layers };
}
/* abrelatas: bolsillo horizontal abierto por la punta donde entra la anilla de la lata */
const RANURA = () => [num('grosor', 'Grosor del llavero', 6.4, 4.8, 9, 0.1), num('anchoR', 'Ancho de la ranura', 16, 12, 22, 0.2), num('baseR', 'Altura inicial de la ranura', 0.8, 0.4, 2, 0.1), num('altoR', 'Alto de la ranura', 2.6, 1.6, 3.6, 0.1), num('fondoR', 'Profundidad de la ranura', 16, 10, 24, 0.5), chk('circR', 'Alivio circular en la entrada', true)];
function abreCapas(F, base, pocket, p, color, nfcPocket) {
  const f = p.baseR || 0.8, sh = p.altoR || 2.6; let T = Math.max(p.grosor || 6.4, f + sh + 1.6); const c = color || C.blanco;
  const e = p.eNfc || 1; let zN = null; if (nfcPocket) { T = Math.max(T, f + sh + 0.8 + e + 0.8); zN = T - 0.8 - e; }
  const nota = nfcPocket ? ` Pon una pausa a ${(zN + e).toFixed(1)} mm (cuando el hueco NFC queda abierto, antes de taparlo) y mete la etiqueta.` : '';
  /* con Manifold: una sola pieza maciza con la ranura y el hueco NFC restados en 3D */
  if (K.hasCSG()) {
    try {
      const s = K.subtract(K.maskSolid(F, base, 0, T), K.maskSolid(F, pocket, f, f + sh), nfcPocket ? K.maskSolid(F, nfcPocket, zN, zN + e) : null);
      return { layers: [LM('Base', K.solidMesh(s), c)], T, nota };
    } catch (err) { console.warn('abrelatas: sin Manifold, se usan capas', err); }
  }
  /* sin Manifold: la misma geometría apilando capas */
  const out = [L('Base', base, 0, f, c), L('Base (ranura)', sub(base, pocket), f, f + sh, c)];
  if (nfcPocket) { if (zN > f + sh + 0.01) out.push(L('Base (techo)', base, f + sh, zN, c)); out.push(L('Base (hueco NFC)', sub(base, nfcPocket), zN, zN + e, c), L('Base (cierre)', base, zN + e, T, c)); }
  else out.push(L('Base (techo)', base, f + sh, T, c));
  return { layers: out, T, nota };
}
const NOTA_ABRE = 'Mete la anilla de la lata en la ranura de la punta y levanta el llavero para abrirla sin usar las uñas. La ranura se imprime sin soportes (es un puente corto).';
function gAbrelatas(p) {
  const L0 = p.largo, aR = p.anchoR, Wd = Math.max(p.anchoP, aR + 4.4); const F = frame(L0 + 10, Wd + 10); const x0 = -L0 / 2, x1 = L0 / 2;
  const body = F.draw(c => { c.beginPath(); c.moveTo(x0 + Wd / 2, -Wd / 2); c.lineTo(x1 - 3, -Wd / 2); c.quadraticCurveTo(x1, -Wd / 2, x1, -Wd / 2 + 3); c.lineTo(x1, Wd / 2 - 3); c.quadraticCurveTo(x1, Wd / 2, x1 - 3, Wd / 2); c.lineTo(x0 + Wd / 2, Wd / 2); c.arc(x0 + Wd / 2, 0, Wd / 2, Math.PI / 2, Math.PI * 1.5); c.closePath(); c.fill(); });
  const S = sub(body, F.disk(x0 + Wd / 2, 0, 2.6)); const pocket = F.rect(x1 - p.fondoR, -aR / 2, x1 + 3, aR / 2, 0.8);
  const S2 = p.circR ? sub(S, F.disk(x1, 0, aR * 0.28)) : S; const ab = abreCapas(F, S2, pocket, p, C.rosa);
  const f = font(p.fuente); const xa = x0 + Wd + 1, xb = x1 - 2; const tw = xb - xa; const t = lines(p.texto, 'Ana'); const sz = fitSize(t, f, tw, Wd * 0.62); const T = and(F.text(t, f, sz, (xa + xb) / 2, 0), erode(F, S2, 1.4));
  return { F, layers: [...ab.layers, L('Texto', T, ab.T, ab.T + 0.8, C.blanco)], note: NOTA_ABRE };
}
/* imagen con bordes altos (resina) */
function gResina(p) {
  const s = imgFit(p.img, p.ancho, p.ancho); const F = frame(s.w + 20, s.h + 20);
  const Lm = F.image(p.img, 0, 0, s.w, s.h, { thr: p.umbral });
  const O = fillHoles(F, close(F, dilate(F, Lm, 0.4), 2));
  const outer = dilate(F, O, p.pared);
  const h = holeTab(F, outer, p.agujero, p.dAg, undefined, undefined, p.movAg);
  const walls = or(outline(F, O, p.pared), dilate(F, and(Lm, O), 0.25));
  return { F, layers: [L('Fondo', h.base, 0, 1.6, C.marron), L('Paredes', h.clear ? sub(walls, h.hole) : walls, 1.6, 1.6 + p.hPared, C.oro)] };
}
/* topper de tarta */
function gTopper(p) {
  const f = font(p.fuente); const tn = lines(p.nombre, 'ELISA'); const dn = tdim(tn, f, p.ancho);
  const num = String(p.numero || '').trim(); const dN = num ? tdim([num], f, 1) : null; const sN = num ? dn.s * 1.7 : 0; const hN = num ? measure([num], f).h * sN : 0;
  const Ht = hN + dn.h - (num ? dn.h * 0.12 : 0); const Lp = p.largo;
  const F = frame(p.ancho + 2 * p.contorno + 10, Ht + 2 * p.contorno + Lp + 10);
  const y0 = -(Ht + Lp) / 2 + p.contorno; let T = F.blank();
  if (num) T = or(T, F.text([num], f, sN, 0, y0 + hN / 2));
  T = or(T, F.text(tn, f, dn.s, 0, y0 + Ht - dn.h / 2));
  if (p.icono) { const ic = [p.icono]; const fe = font('emoji'); const sz = dn.h * 1.1; const xi = num ? -p.ancho * 0.32 : 0; T = or(T, F.text(ic, fe, sz, xi, y0 + (num ? hN * 0.4 : -sz * 0.2))); }
  let base = close(F, dilate(F, T, p.contorno), 3);
  const xs = p.palitos == 2 ? [-p.ancho * 0.22, p.ancho * 0.22] : [0];
  for (const x of xs) { const e = extreme(F, base, 'bottom', x - 1, x + 1); const yb = e[1] - 4; const yE = yb + Lp; base = or(base, F.draw(c => { c.beginPath(); c.moveTo(x - 2.6, yb); c.lineTo(x + 2.6, yb); c.lineTo(x + 2.6, yE - 6); c.lineTo(x, yE); c.lineTo(x - 2.6, yE - 6); c.closePath(); c.fill(); })); }
  const layers = [L('Base', base, 0, p.grosor, C.rosa)]; if (p.capa > 0) layers.push(L('Texto', T, p.grosor, p.grosor + p.capa, C.blanco));
  return { F, layers };
}
/* topper circular con ventana para purpurina */
function gTopperCirc(p) {
  const R = p.diametro / 2; const f = font(p.fuente); const Lp = p.largo;
  const F = frame(2 * R + 24, 2 * R + Lp + 30);
  const cy = -Lp / 2; const D = F.disk(0, cy, R); const rim = ring(F, D, 4);
  const tn = lines(p.nombre, 'ELISA'); const dn = tdim(tn, f, 2 * R * 1.05); const Tn = F.text(tn, f, dn.s, 0, cy + R - dn.h * 0.15);
  const num = String(p.numero || '').trim(); const Tnum = num ? F.text([num], f, R * 0.95, R * 0.72, cy - R * 0.55) : F.blank();
  const T = or(Tn, Tnum); const outl = close(F, dilate(F, T, 2.5), 2);
  const e = extreme(F, or(D, outl), 'bottom', -1, 1); const stick = F.draw(c => { c.beginPath(); c.moveTo(-2.8, e[1] - 4); c.lineTo(2.8, e[1] - 4); c.lineTo(2.8, e[1] + Lp - 6); c.lineTo(0, e[1] + Lp); c.lineTo(-2.8, e[1] + Lp - 6); c.closePath(); c.fill(); });
  return { F, layers: [L('Fondo', or(D, stick), 0, 1.2, C.blanco), L('Aro (ventana)', or(rim, outl), 1.2, 5, C.rosa), L('Nombre y número', T, 5, 6.2, C.blanco)] };
}
function gPalillos(p) {
  const R = p.diametro / 2; const F = frame(2 * R + 8, 2 * R + 8); const g = p.base === 'gruesa' ? 7 : 2.6;
  const B = F.shape(p.forma, 0, 0, 2 * R, 2 * R); const tubo = sub(F.disk(0, 0, p.dPalillo / 2 + 3), F.disk(0, 0, p.dPalillo / 2 + 0.2));
  return { F, layers: [L('Base', B, 0, g, C.gris), L('Tubo', tubo, g, g + p.hTubo, C.gris)] };
}
function gSoporteFoto(p) {
  const f = font(p.fuente); const t = lines(p.texto, 'ELISA'); const d = tdim(t, f, p.ancho - 10);
  const dep = d.h + 14; const F = frame(p.ancho + 6, dep + 6);
  const B = F.rectC(0, 0, p.ancho, dep, 3); const ys = -dep / 2 + 5; const slot = F.rect(-p.ancho / 2 + 4, ys - 0.9, p.ancho / 2 - 4, ys + 0.9);
  const T = F.text(t, f, d.s, 0, dep / 2 - d.h / 2 - 3);
  return { F, layers: [L('Base', B, 0, 2, C.azul), L('Cuerpo con ranura', sub(B, slot), 2, p.alto, C.azul), L('Texto', and(T, erode(F, B, 1)), p.alto, p.alto + 1.2, C.blanco)] };
}
/* marco: cuadro con peana o portafotos colgante; foto deslizable */
function gMarco(p, o = {}) {
  const fw = p.fotoAncho, fh = p.fotoAlto, b = p.borde; const W = fw + 2 * b, H = fh + 2 * b + (p.texto ? b * 0.9 : 0);
  const tabW = Math.min(W * 0.5, 60); const st = p.peana && !o.colgar;
  const F = frame(W + 10, H + (st ? 34 : 14));
  const cy = st ? -14 : 4; const forma = p.forma;
  const Sout = F.shape(forma, 0, cy, W, H); const yTopPhoto = cy - H / 2 + b;
  const win = F.shape(forma === 'arco' ? 'arco' : forma === 'corazon' ? 'corazon' : 'rect', 0, yTopPhoto + fh / 2, fw - 6, fh - 6);
  const slide = F.rect(-fw / 2 - 0.3, cy - H / 2 - 5, fw / 2 + 0.3, yTopPhoto + fh + 0.3, 0);
  let back = Sout, cl = m => m;
  if (o.colgar) { const h = holeTab(F, Sout, 'arriba', 4); back = h.base; cl = m => h.clear ? sub(m, h.clear) : m; }
  const layers = [L('Trasera', back, 0, 1.4, C.blanco), L('Separador (la foto entra por arriba)', cl(sub(Sout, slide)), 1.4, 2.2, C.blanco), L('Frente', cl(sub(Sout, win)), 2.2, 4, C.rojo)];
  if (p.texto) { const f = font(p.fuente); const zone = F.rectC(0, cy + H / 2 - b * 0.95, W - 2 * b, b * 1.4); const s = fitSize(lines(p.texto, ''), f, W - 2 * b, b * 1.25); layers.push(L('Texto', and(F.text(lines(p.texto, ''), f, s, 0, cy + H / 2 - b * 0.95), zone), 4, 5, C.blanco)); }
  if (st) { const yb = cy + H / 2; const tab = tabMask(F, 0, yb, tabW, 7); layers[0].mask = or(layers[0].mask, tab); layers[1].mask = or(layers[1].mask, tab); layers[2].mask = or(layers[2].mask, tab); layers.push(...standParts(F, tabW, 4, 0, yb + 9)); }
  return { F, layers };
}
/* soporte de tarta (torno, 2 piezas) */
function gTarta(p) {
  const Rp = p.diametro / 2, Rf = p.dPie / 2, rc = p.dColumna / 2, H = p.alto; const layers = [];
  const F = frame(2 * Rp + 4, 2 * Rp + 4, { margin: 3, maxPx: 1100, res: 4 }); const plate = p.borde === 'ondulado' ? F.shape('ondulado', 0, 0, 2 * Rp, 2 * Rp) : F.disk(0, 0, Rp);
  const xp = -Rp - 4; layers.push(LM('Plato', mm(F, sub(plate, F.disk(0, 0, 6.4)), 0, 3, xp), C.blanco), LM('Plato (cara superior)', mm(F, plate, 3, 4.5, xp), C.blanco));
  if (p.borde === 'ondulado') layers.push(LM('Ribete', mm(F, ring(F, plate, 2), 4.5, 5.5, xp), C.rosa));
  const xf = Rf + 4 + p.estria; const m2 = K.newMesh();
  if (p.estrias > 0) { const prof = z => rc + (Rf - rc) * Math.pow(Math.max(0, 1 - z / (H * 0.9)), 1.6); K.tube((a, z) => prof(z) + p.estria * Math.max(0, 1 - z / H) * (0.5 + 0.5 * Math.cos(p.estrias * a)), null, 0, H, p.estrias * 8, Math.round(H / 0.8), xf, 0, m2); K.lathe([[0, H - 0.5], [6, H - 0.5], [6, H + 2.8], [0, H + 2.8]], xf, 0, 64, m2); }
  else K.lathe([[0, 0], [Rf, 0], [Rf, 3], [rc, 3 + (Rf - rc)], [rc, H], [6, H], [6, H + 2.8], [0, H + 2.8]], xf, 0, 128, m2);
  layers.push(LM('Pie', m2, C.rosa));
  return { layers, note: 'El plato se imprime con la cara de arriba hacia arriba; el pie encaja en el hueco central de debajo.' };
}
/* letrero multicapa a partir de imagen */
function gMulticapa(p) {
  const s = imgFit(p.img, p.ancho, p.ancho); const F = frame(s.w + 2 * p.offset + 8, s.h + 2 * p.offset + 8);
  const Lu = F.lum(p.img, 0, 0, s.w, s.h); const n = F.n; const O = new Uint8Array(n), D = new Uint8Array(n);
  const t1 = 0.93, t2 = p.umbral / 100; for (let i = 0; i < n; i++) { if (Lu[i] >= 0 && Lu[i] < t1) O[i] = 1; if (Lu[i] >= 0 && Lu[i] < t2) D[i] = 1; }
  const Of = fillHoles(F, close(F, O, 1)); const base = close(F, dilate(F, Of, p.offset), 2);
  return { F, layers: [L('Capa 1 (contorno)', base, 0, 3, C.oro), L('Capa 2 (silueta)', Of, 3, 4.6, C.lila), L('Capa 3 (detalles)', and(D, Of), 4.6, 5.6, C.blanco)] };
}
/* placa de dibujo (line art) / placa de rayas, con peana */
function gPlacaDibujo(p, o = {}) {
  const W = p.ancho, H = p.alto; const tabW = Math.min(W * 0.5, 50); const st = p.peana;
  const F = frame(W + 8, H + (st ? 34 : 8)); const cy = st ? -13 : 0;
  const S = F.shape(p.forma, 0, cy, W, H); const inner = erode(F, S, 2);
  let det;
  if (o.rayas) det = F.pattern(p.patron, p.sep, p.grosorLinea);
  else { const s = imgFit(p.img, W * 0.86, H * 0.86); det = F.image(p.img, 0, cy, s.w, s.h, { thr: p.umbral }); }
  let T = F.blank(); if (p.texto) { const f = font(p.fuente); const t = lines(p.texto, ''); const s = fitSize(t, f, W * 0.8, H * 0.35); T = F.text(t, f, s, 0, cy + (o.rayas ? 0 : H * 0.3)); }
  det = sub(and(det, inner), dilate(F, T, o.rayas ? 2.2 : 0.8));
  const layers = [L('Placa', S, 0, 2.4, o.rayas ? C.crema : C.blanco), L('Dibujo', or(det, ring(F, S, 1.4)), 2.4, 3.2, C.negro)];
  if (p.texto) layers.push(L('Texto', and(o.rayas ? dilate(F, T, 0) : T, inner), 2.4, 3.6, o.rayas ? C.marron : C.negro));
  if (st) { const yb = cy + H / 2; const tab = tabMask(F, 0, yb, tabW); layers[0].mask = or(layers[0].mask, tab); layers.push(...standParts(F, tabW, 2.4, 0, yb + 9)); }
  return { F, layers };
}
/* caja con tapa (y divisiones) */
function gCaja(p) {
  const W = p.ancho, D = p.fondo, g = 1.8, tol = 0.25; const F = frame(2 * W + 12, D + 4);
  const xb = -W / 2 - 4, xt = W / 2 + 4;
  const box = F.rectC(xb, 0, W, D, 4); let inner = erode(F, box, g);
  if (p.cols > 1 || p.filas > 1) { const div = F.draw(c => { c.lineWidth = 1.2; c.beginPath(); for (let i = 1; i < p.cols; i++) { const x = xb - W / 2 + i * W / p.cols; c.moveTo(x, -D / 2); c.lineTo(x, D / 2); } for (let j = 1; j < p.filas; j++) { const y = -D / 2 + j * D / p.filas; c.moveTo(xb - W / 2, y); c.lineTo(xb + W / 2, y); } c.stroke(); }); inner = sub(inner, div); }
  const lid = F.rectC(xt, 0, W, D, 4); const lip = sub(erode(F, lid, g + tol), erode(F, lid, g + tol + 1.4));
  let txt = F.blank(); if (p.texto) { const f = font(p.fuente); const t = lines(p.texto, ''); const s = fitSize(t, f, W * 0.8, D * 0.6); txt = and(F.text(t, f, s, xt, 0, { mirror: true }), erode(F, lid, 3)); }
  return { F, layers: [L('Caja: suelo', box, 0, 1.6, C.lila), L('Caja: paredes', sub(box, inner), 1.6, p.alto, C.lila), L('Tapa (cara superior abajo)', sub(lid, txt), 0, 0.6, C.lila), L('Nombre grabado', txt, 0, 0.6, C.blanco), L('Tapa', lid, 0.6, 2, C.lila), L('Tapa: encaje', lip, 2, 5, C.lila)] };
}
/* estuche tubular / bote con tapa (torno) */
function mm(F, mask, z0, z1, dx = 0, dy = 0) { const m = K.maskToMesh(F, mask, z0, z1); K.fixOrientation(m); return K.translateMesh(m, dx, dy); }
/* tapa con nombre incrustado: la cara superior se imprime contra la cama (texto en espejo) */
function capDisc(p, R, tt, cx, color) {
  const F = frame(2 * R + 2, 2 * R + 2, { margin: 3 }); const D = F.disk(0, 0, R); const out = [];
  if (p.nombre) { const f = font(p.fuente); const t = lines(p.nombre, ''); const s = fitSize(t, f, R * 1.45, R * 0.9); const T = and(F.text(t, f, s, 0, 0, { mirror: true }), erode(F, D, 1.2));
    out.push(LM('Tapa: cara superior', mm(F, sub(D, T), 0, 0.6, cx), color), LM('Nombre incrustado', mm(F, T, 0, 0.6, cx), C.blanco), LM('Tapa', mm(F, D, 0.6, tt, cx), color)); }
  else out.push(LM('Tapa', mm(F, D, 0, tt, cx), color));
  return out;
}
function gTubo(p, o = {}) {
  const Ri = p.dInt / 2, tol = p.holgura, f = 1.6; const layers = [];
  if (p.rosca) {
    const d = 0.9, P = p.paso || 2.5; const Ln = Math.min(o.bote ? 8 : 9, p.alto * 0.4); const Rn = Ri + Math.max(1.2, p.pared * 0.8); const Rci = Rn + tol; const R = Rci + d + Math.max(1.4, p.pared);
    const Hb = p.alto - Ln; const xb = -R - 4, xc = R + 4;
    const b = K.newMesh();
    if ((p.textura && p.textura !== 'no') || p.nombreCuerpo) {
      const C0 = 2 * Math.PI * R, Hc = Hb - f; const G = frame(C0, Hc, { margin: 1, maxPx: 700, res: 3 }); let D = G.blank();
      if (p.textura && p.textura !== 'no') D = G.pattern(p.textura, p.sep || 4, 0.9, 3);
      if (p.nombreCuerpo) { const fn = font(p.fuenteCuerpo || p.fuente); const t = [p.nombreCuerpo]; const sz = fitSize(t, fn, Hc * 0.8, C0 * 0.3); const T = G.text(t, fn, sz, 0, 0, { rot: -Math.PI / 2, mirror: false }); D = or(sub(D, dilate(G, T, 1.2)), T); }
      D = and(D, G.rect(-C0, -Hc / 2 + 1.5, C0, Hc / 2 - 1.5)); const smp = sampler(G, D);
      K.lathe([[0, 0], [R, 0], [R, f], [0, f]], xb, 0, 128, b);
      K.tube((a, z) => R - 0.6 * smp(a / (2 * Math.PI) * C0 - C0 / 2, -(z - f - Hc / 2)), () => Ri, f, Hb, Math.min(700, Math.round(C0 * 3)), Math.round(Hc * 3), xb, 0, b);
    } else K.lathe([[0, 0], [R, 0], [R, Hb], [Ri, Hb], [Ri, f], [0, f]], xb, 0, 128, b);
    const fade = (z, z0, z1) => Math.max(0, Math.min(1, (z - z0) / 1.2, (z1 - z) / 1.2));
    K.tube((a, z) => Rn + d * K.threadProfile(a, z, P, d) * fade(z, Hb, p.alto), () => Ri, Hb, p.alto, 128, Math.ceil(Ln / 0.12), xb, 0, b);
    layers.push(LM(o.bote ? 'Bote' : 'Cuerpo', b, C.oro));
    const tt = 1.6, Lc = o.bote ? Ln + 1 : Math.max(p.tapa, Ln + 3); const zt0 = tt + Lc - Ln - 0.3;
    layers.push(...capDisc(p, R, tt, xc, C.negro));
    const c = K.newMesh(); K.tube(() => R, (a, z) => z < zt0 ? Rci + d + 0.2 : Rci + d * K.threadProfile(a, z, P, d) * fade(z, zt0, tt + Lc), tt, tt + Lc, 128, Math.ceil(Lc / 0.12), xc, 0, c);
    layers.push(LM('Tapa: rosca', c, C.negro));
    return { layers, note: 'Rosca de paso ' + P + ' mm. Si aprieta, sube la holgura 0,1 mm.' };
  }
  const w = p.pared, R = Ri + w;
  if (o.bote) {
    const m1 = K.newMesh(); K.lathe([[0, 0], [R, 0], [R, p.alto], [Ri, p.alto], [Ri, f], [0, f]], -R - 4, 0, 128, m1); layers.push(LM('Bote', m1, C.oro));
    layers.push(...capDisc(p, R + 0.6, 2, R + 4, C.negro)); const pr = Ri - tol; const m2 = K.newMesh(); K.lathe([[pr - 1.4, 2], [pr, 2], [pr, 7], [pr - 1.4, 7]], R + 4, 0, 128, m2); layers.push(LM('Tapa: encaje', m2, C.negro));
  } else {
    const Rc = R + tol + w; const m1 = K.newMesh(); K.lathe([[0, 0], [R, 0], [R, p.alto], [Ri, p.alto], [Ri, f], [0, f]], -Rc - 3, 0, 96, m1); layers.push(LM('Cuerpo', m1, C.oro));
    layers.push(...capDisc(p, Rc, f, Rc + 3, C.negro)); const m2 = K.newMesh(); K.lathe([[R + tol, f], [Rc, f], [Rc, p.tapa], [R + tol, p.tapa]], Rc + 3, 0, 96, m2); layers.push(LM('Tapa: tubo', m2, C.negro));
  }
  return { layers };
}
function gFamilia(p) {
  const f = font(p.fuente); const names = lines(p.nombres, 'Familia'); const H = p.alto, gap = 7;
  const ws = names.map(n => tdim([n], f, 1)); const s = Math.min(...ws.map(d => 1 / d.h)) * H * 0.55; const Hk = p.forma && p.forma !== 'capsula' ? 1.6 : 1;
  const widths = names.map(n => Math.min(p.anchoMax, measure([n], f).w * s + H * 0.9));
  const tot = names.length * H * Hk + (names.length - 1) * gap; const F = frame(Math.max(...widths) * 1.1 + 8, tot + 14);
  let plates = F.blank(), T = F.blank();
  names.forEach((n, i) => { const cy = -tot / 2 + i * (H * Hk + gap) + H * Hk / 2; const fm = p.forma === 'mixto' ? (i === names.length - 1 ? 'huella' : 'corazon') : (p.forma || 'capsula'); let pl = fm === 'capsula' ? F.shape('capsula', 0, cy, widths[i], H) : F.shape(fm, 0, cy, fm === 'huella' ? H * 1.5 : Math.min(widths[i] * 0.95, H * 2.4), fm === 'huella' ? H * 1.5 : H * 1.6);
    const holes = []; const yt = extreme(F, pl, 'top', -2, 2)[1], yb2 = extreme(F, pl, 'bottom', -2, 2)[1]; if (i === 0) { pl = or(pl, F.disk(0, yt, 4.5)); holes.push(F.disk(0, yt - 1, 2)); } else { pl = or(pl, F.disk(0, yt + 3, 3.4)); holes.push(F.disk(0, yt + 3.2, 1.6)); } if (i < names.length - 1) { pl = or(pl, F.disk(0, yb2 - 3, 3.4)); holes.push(F.disk(0, yb2 - 3.2, 1.6)); }
    pl = sub(pl, ...holes); plates = or(plates, pl); const sz = fm === 'capsula' ? Math.min(s, (widths[i] - H * 0.9) / measure([n], f).w) : fitSize([n], f, (fm === 'huella' ? H * 1.5 : widths[i] * 0.95) * 0.6, H * Hk * (fm === 'huella' ? 0.25 : 0.38)); const ty = fm === 'corazon' ? cy - H * Hk * 0.08 : fm === 'huella' ? cy + H * Hk * 0.22 : cy; T = or(T, and(F.text([n], f, sz, 0, ty), sub(erode(F, pl, 1.2), ...holes.map(hh => dilate(F, hh, 2))))); });
  return { F, layers: [L('Placas', plates, 0, 3, C.marron), L('Nombres', T, 3, 4, C.blanco)] };
}
function gLitofania(p) {
  const s = imgFit(p.img, p.ancho, p.ancho * 1.5); const res = Math.min(4, 420 / Math.max(s.w, s.h)); const nx = Math.round(s.w * res) + 1, ny = Math.round(s.h * res) + 1;
  const c = K.canvas(nx, ny); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, nx, ny); x.drawImage(p.img, 0, 0, nx, ny);
  const d = x.getImageData(0, 0, nx, ny).data; const hm = new Float32Array(nx * ny); const step = 1 / res; const fb = p.marco * res;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i; let L = (0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2]) / 255; if (p.invertir) L = 1 - L;
    let z = p.eMax - (p.eMax - p.eMin) * L; if (i < fb || j < fb || i >= nx - fb || j >= ny - fb) z = p.eMax + (p.marco ? 0.6 : 0); hm[k] = z; }
  const m = K.heightMesh(hm, nx, ny, step); K.fixOrientation(m);
  return { layers: [LM('Litofanía', m, C.translucido)], note: 'Imprime en vertical, en blanco, relleno 100 %.' };
}
/* string art */
function gString(p, o = {}) {
  const forma = o.forma; const W = p.ancho, H = forma === 'corazon' ? W * 0.9 : p.alto; const tabW = Math.min(W * 0.4, 50);
  const F = frame(W + 8, H + (p.peana ? 34 : 8)); const cy = p.peana ? -13 : 0;
  const S = F.shape(forma, 0, cy, W, H); const inner = erode(F, S, p.marco);
  const f = font(p.fuente); const t = lines(p.texto, 'Aline'); const fit = forma === 'corazon' ? [0.62, 0.42] : [0.86, 0.6];
  const s = fitSize(t, f, W * fit[0], H * fit[1]); const T = and(F.text(t, f, s, 0, cy + (forma === 'corazon' ? -H * 0.06 : 0), { bold: 0.5 }), inner);
  const pt = forma === 'rect' ? 'radial' : 'verticales'; const hilos = F.draw(c => { c.lineWidth = p.hilo;
    if (pt === 'radial') { const n = Math.round(2 * (W + H) / p.sep); c.beginPath(); for (let k = 0; k < n; k++) { const a = k * 2 * Math.PI / n; c.moveTo(0, cy); c.lineTo(Math.cos(a) * W, cy + Math.sin(a) * W); } c.stroke(); }
    else { c.beginPath(); for (let x = -W / 2; x <= W / 2; x += p.sep) { c.moveTo(x, cy - H); c.lineTo(x, cy + H); } c.stroke(); } });
  const layers = [L('Marco', ring(F, S, p.marco), 0, p.grosor, C.rojo), L('Hilos', sub(and(hilos, inner), T), 0, 1.4, C.blanco), L('Texto', T, 0, p.grosor, C.blanco)];
  if (p.peana) { const yb = cy + H / 2; const tab = tabMask(F, 0, yb - 0.5, tabW); layers[0].mask = or(layers[0].mask, tab); layers.push(...standParts(F, tabW, p.grosor, 0, yb + 9)); }
  return { F, layers };
}
/* letra grande */
function gLetra(p, o = {}) {
  const fl = font(p.fuenteLetra); const ch = String(p.letra || 'M').trim().slice(0, 2) || 'M'; const m = measure([ch], fl); const s = p.alto / m.h; const Wl = m.w * s;
  const fn = font(p.fuente); const tn = lines(p.nombre, ''); const hasN = !!p.nombre && o.v !== 'hundido';
  const dn = hasN ? tdim(tn, fn, Wl * 1.25) : null;
  const lamp = o.v === 'lampara';
  const extraW = (hasN ? dn.w + 10 : 0) + (lamp ? Wl + 8 : 0);
  const F = frame(Wl + extraW + 8, Math.max(p.alto, hasN ? dn.h + 6 : 0) + 8);
  const lx = -extraW / 2; const Lm = F.text([ch], fl, s, lx, 0); const g = p.grosor, pw = p.pared, su = p.suelo;
  const layers = [];
  const nx = lx + Wl / 2 + 5 + (hasN ? dn.w / 2 : 0) + (lamp ? Wl + 8 : 0);
  switch (o.v) {
    case 'maciza': layers.push(L('Letra', Lm, 0, g, C.verde)); break;
    case 'hundido': { const nm = lines(p.nombre, 'rafael'); const s2 = p.vertical ? fitSize(nm, fn, p.alto * 0.85, Wl * 0.3) : fitSize(nm, fn, Wl * 0.9, p.alto * 0.25); const Tn = and(F.text(nm, fn, s2, lx, p.vertical ? 0 : p.alto * 0.12, { rot: p.vertical ? -Math.PI / 2 : 0 }), erode(F, Lm, 1.2)); layers.push(L('Letra', Lm, 0, g - 1.2, C.verde), L('Letra (cara)', sub(Lm, Tn), g - 1.2, g, C.verde), L('Nombre incrustado', Tn, g - 1.2, g, C.blanco)); break; }
    case 'textura': { const inn = erode(F, Lm, 1.6); const pt = and(F.pattern(p.patron, p.sep, p.grosorLinea), inn); layers.push(L('Letra', Lm, 0, g - 1, C.azul), L('Borde', ring(F, Lm, 1.6), g - 1, g, C.azul), L('Textura', pt, g - 1, g, C.celeste)); break; }
    case 'fondo': { const inn = erode(F, Lm, pw); const pt = and(F.pattern(p.patron, p.sep, p.grosorLinea), inn); layers.push(L('Suelo', Lm, 0, su, C.verde), L('Paredes', ring(F, Lm, pw), su, g, C.verde), L('Relieve del fondo', pt, su, su + 1.2, C.oro)); break; }
    case 'lampara': { const eb = extreme(F, erode(F, Lm, pw + 3.2), 'bottom'); layers.push(L('Trasera (agujero para cable)', sub(Lm, F.disk(eb[0], eb[1] - 0.5, 2.6)), 0, 1.6, C.rosa), L('Paredes', ring(F, Lm, pw), 1.6, g, C.rosa), L('Difusor (blanco)', shift(F, erode(F, Lm, 0), Wl + 8, 0), 0, 1.2, C.translucido)); break; }
    default: layers.push(L('Suelo', Lm, 0, su, C.oro), L('Paredes', ring(F, Lm, pw), su, g, C.marron));
  }
  if (hasN && p.unido && !lamp) { const Tn = F.text(tn, fn, dn.s * 0.9, lx + Wl * 0.08, p.alto * 0.2); layers.push(L('Nombre: contorno', close(F, dilate(F, Tn, 1.3), 1), 0, g + 1.2, C.blanco), L('Nombre', Tn, g + 1.2, g + 2.6, C.rosa)); return { F, layers, note: 'El nombre va unido a la letra: se imprime tumbada, de una pieza.' }; }
  if (hasN) { const Tn = F.text(tn, fn, dn.s, nx, 0); layers.push(L('Nombre: base', close(F, dilate(F, Tn, 1.4), 1), 0, 2, C.blanco), L('Nombre', Tn, 2, 3.4, C.rosa)); }
  return { F, layers, note: o.v === 'hundido' ? '' : (hasN ? 'El nombre se imprime aparte y se pega delante de la letra.' : '') };
}
/* placas QR */
function qrContent(p, v) {
  switch (v) {
    case 'wifi': { const e = s => String(s || '').replace(/([\\;,:"])/g, '\\$1'); return `WIFI:T:${p.cifrado};S:${e(p.ssid)};P:${e(p.clave)};;`; }
    case 'whatsapp': return `https://wa.me/${String(p.tel || '').replace(/\D/g, '')}${p.mensaje ? '?text=' + encodeURIComponent(p.mensaje) : ''}`;
    case 'redes': { const u = String(p.usuario || '').replace(/^@/, ''); return { instagram: `https://instagram.com/${u}`, tiktok: `https://www.tiktok.com/@${u}`, youtube: `https://youtube.com/@${u}`, facebook: `https://facebook.com/${u}`, x: `https://x.com/${u}` }[p.red]; }
    default: return p.url || 'https://';
  }
}
function gQR(p, o = {}) {
  const v = o.v || 'texto'; const W = p.ancho, m = W * 0.09, q = W - 2 * m; const f = font(p.fuente);
  const title = v === 'redes' ? '@' + String(p.usuario || '').replace(/^@/, '') : (p.titulo || ''); const tH = title ? W * 0.13 : 0;
  const logo = v === 'logo' || v === 'wifi' || v === 'resenas'; const lH = logo ? W * (v === 'resenas' ? 0.1 : 0.2) : 0; const sH = p.subtitulo ? W * 0.075 : 0;
  const top = p.forma === 'arco' ? W * 0.22 : m * 0.8;
  const H = top + (tH ? tH + m * 0.4 : 0) + (lH ? lH + m * 0.4 : 0) + q + (sH ? sH + m * 0.4 : 0) + m * 0.9;
  const tabW = Math.min(W * 0.5, 50); const F = frame(W + 8, H + (p.peana ? 34 : 8)); const y0 = -H / 2 - (p.peana ? 13 : 0);
  const S = F.shape(p.forma, 0, y0 + H / 2, W, H); let y = y0 + top; let D = F.blank();
  if (title) { const s = fitSize([title], f, q, tH); D = or(D, F.text([title], f, s, 0, y + tH / 2)); y += tH + m * 0.4; }
  if (lH) { if (v === 'wifi') D = or(D, K.wifiIcon(F, 0, y + lH * 0.05, lH, lH * 0.12)); else if (v === 'resenas') D = or(D, F.draw(c => { for (let k = -2; k <= 2; k++) { c.beginPath(); const pts = K.star(5, lH * 0.5, lH * 0.22, k * lH * 1.15, y + lH / 2); c.moveTo(...pts[0]); pts.forEach(pt => c.lineTo(...pt)); c.fill(); } }));
    else { const s = imgFit(p.img, q, lH); D = or(D, F.image(p.img, 0, y + lH / 2, s.w, s.h, { thr: p.umbral })); } y += lH + m * 0.4; }
  D = or(D, F.qr(qrContent(p, v), 0, y + q / 2, q)); y += q + m * 0.4;
  if (sH) { const s = fitSize([p.subtitulo], font('montserrat'), q, sH); D = or(D, F.text([p.subtitulo], font('montserrat'), s, 0, y + sH / 2)); }
  const layers = [L('Placa', S, 0, 3, C.blanco), L('QR y textos', and(D, erode(F, S, 1)), 3, 4, C.negro)];
  if (p.peana) { const yb = y0 + H; const tab = tabMask(F, 0, yb, tabW); layers[0].mask = or(layers[0].mask, tab); layers.push(...standParts(F, tabW, 3, 0, yb + 9)); }
  return { F, layers, note: 'Prueba a escanear la vista previa del QR antes de imprimir. Imprime el relieve en color oscuro.' };
}
function gQRLista(p) {
  const items = String(p.lista || '').split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a[0]).slice(0, 4);
  if (!items.length) items.push(['Web', 'https://']);
  const n = items.length, q = p.tamQR, gap = 8, lab = q * 0.18; const hor = p.orientacion === 'horizontal';
  const f = font(p.fuente); const tH = p.titulo ? q * 0.3 : 0; const m = 8;
  const cw = q, ch = q + lab + 3;
  const W = hor ? n * cw + (n - 1) * gap + 2 * m : cw + 2 * m; const H = (hor ? ch : n * ch + (n - 1) * gap) + 2 * m + (tH ? tH + 4 : 0) + (p.forma === 'arco' ? W * 0.3 : 0);
  const tabW = Math.min(W * 0.5, 60); const F = frame(W + 2 * p.offset + 8, H + 2 * p.offset + (p.peana ? 34 : 8)); const y0 = -H / 2 - (p.peana ? 13 : 0);
  const S = F.shape(p.forma, 0, y0 + H / 2, W, H); let D = F.blank(); let y = y0 + m + (p.forma === 'arco' ? W * 0.3 : 0);
  if (tH) { const s = fitSize([p.titulo], f, W - 2 * m, tH); D = or(D, F.text([p.titulo], f, s, 0, y + tH / 2)); y += tH + 4; }
  items.forEach((it, i) => { const x = hor ? -W / 2 + m + cw / 2 + i * (cw + gap) : 0; const yy = hor ? y : y + i * (ch + gap);
    D = or(D, F.qr(it[1] || it[0], x, yy + q / 2, q)); const s = fitSize([it[0]], font('montserrat'), q, lab); D = or(D, F.text([it[0]], font('montserrat'), s, x, yy + q + 2 + lab / 2)); });
  const layers = [];
  if (p.offset > 0) layers.push(L('Fondo (capa 1)', dilate(F, S, p.offset), 0, 2, C.azul));
  const z = p.offset > 0 ? 2 : 0; layers.push(L('Placa', S, z, z + 2.6, C.blanco), L('QR y textos', and(D, erode(F, S, 1)), z + 2.6, z + 3.6, C.negro));
  if (p.peana) { const yb = y0 + H + p.offset; const tab = tabMask(F, 0, yb, tabW); layers[0].mask = or(layers[0].mask, tab); layers.push(...standParts(F, tabW, z + 2.6, 0, yb + 9)); }
  return { F, layers };
}
/* adorno portarretrato navideño */
function gPortarretrato(p) {
  const W = p.ancho; const F = frame(W + 18, W * 1.25 + 18); const S = F.shape(p.forma, 0, 0, W, W * (p.forma === 'bola' ? 1.12 : 1));
  const fit = FIT[p.forma] || [0, 0, 0, 0]; const cy = W * (fit[3] || 0) * 0.6; const r = p.dFoto / 2;
  const h = holeTab(F, S, 'arriba', 4); const cl = m => h.clear ? sub(m, h.clear) : m;
  let T = F.blank(); if (p.texto) { const f = font(p.fuente); const s = fitSize([p.texto], f, W * 0.52, W * 0.12); T = and(F.text([p.texto], f, s, 0, cy + r + W * 0.09), erode(F, S, 1.5)); }
  return { F, layers: [L('Fondo', h.base, 0, 1.6, C.rojo), L('Marco (foto dentro)', cl(sub(S, F.disk(0, cy, r))), 1.6, 3.2, C.rojo), L('Detalle', cl(sub(and(ring(F, F.disk(0, cy, r + 2.2), 1.2), S), T)), 3.2, 4, C.oro), L('Texto', cl(T), 3.2, 4.2, C.blanco)] };
}
function gCopo(p) {
  const R = p.diametro / 2; const F = frame(2 * R + 16, 2 * R + 16); const f = font(p.fuente);
  const rg = ring(F, F.disk(0, 0, R), 2.6); const sf = and(K.snowflake(F, 0, 0, R - 1.5, 1.8, p.semilla), F.disk(0, 0, R));
  const t = lines(p.texto, 'Aline'); const s = fitSize(t, f, 2 * R * 0.9, R * 0.5); const T = and(F.text(t, f, s, 0, 0, { bold: 0.4 }), F.disk(0, 0, R + 1));
  const h = holeTab(F, or(rg, sf, dilate(F, T, 1.4)), 'arriba', 4);
  return { F, layers: [L('Copo', h.base, 0, 2.6, C.blanco), L('Nombre', h.clear ? sub(T, h.clear) : T, 2.6, 3.6, C.rojo)] };
}
/* lámpara LED de texto (@social) */
function gLampTexto(p) {
  const f = font(p.fuente); const t = lines(p.texto, '@usuario'); const d = tdim(t, f, p.ancho); const barW = p.ancho * 0.92, barH = 8;
  const dep = p.fondoP, L0 = barW + 16; const F = frame(Math.max(p.ancho, L0) + 8, d.h + barH + dep + 20);
  const yT = -(d.h + barH + dep + 12) / 2 + d.h / 2; const T = F.text(t, f, d.s, 0, yT); const bar = F.rect(-barW / 2, yT + d.h / 2 - 2.5, barW / 2, yT + d.h / 2 + barH, 1);
  const panel = or(close(F, dilate(F, T, 0.8), 1), bar);
  const yb = yT + d.h / 2 + barH + 8 + dep / 2; const blk = F.rectC(0, yb, L0, dep, 3); const slot = F.rectC(0, yb, barW + 0.6, p.grosor + 0.4);
  const chan = F.rectC(0, yb, L0 - 4, Math.min(dep - 3, p.tira + 1.2), 0); const walls = sub(blk, chan, F.rect(L0 / 2 - 3, yb - 2.5, L0 / 2 + 1, yb + 2.5));
  return { F, layers: [L('Panel (translúcido)', panel, 0, p.grosor, C.translucido), L('Peana: tapa (boca abajo)', sub(blk, slot), 0, 4, C.negro), L('Peana: canal para tira LED', walls, 4, p.altoP, C.negro)], note: 'La peana se imprime boca abajo. La tira LED (COB de ' + p.tira + ' mm) se pega en el canal, justo bajo la ranura del panel; el cable sale por el lateral.' };
}
/* cortador de galletas */
function gCortador(p) {
  const S0 = p.tam; const off = S0 / 2 + p.pestana + 8; const F = frame(p.sello ? 2 * (S0 + 2 * p.pestana + 10) : S0 + 2 * p.pestana + 10, S0 + 2 * p.pestana + 10);
  const cx = p.sello ? -off : 0, sx = off; const f = font(p.fuente); let O, det = null, T = null;
  if (p.modo === 'texto') { const t = lines(p.texto, 'Ana'); const s = fitSize(t, f, S0, S0); T = F.text(t, f, s, cx, 0); O = fillHoles(F, close(F, dilate(F, T, 2), 3)); }
  else if (p.modo === 'imagen') { const s = imgFit(p.img, S0, S0); const I = F.image(p.img, cx, 0, s.w, s.h, { thr: p.umbral }); O = fillHoles(F, close(F, dilate(F, I, 0.3), 1.5)); det = and(I, erode(F, O, 2)); }
  else { O = F.shape(p.forma, cx, 0, S0, S0); if (p.texto) { const t = lines(p.texto, ''); const fit = FIT[p.forma] || [.6, .5]; const s = fitSize(t, f, S0 * fit[0], S0 * fit[1]); T = and(F.text(t, f, s, cx + S0 * (fit[2] || 0), S0 * (fit[3] || 0)), erode(F, O, 3)); } }
  let blade = outline(F, O, p.pared), lip = outline(F, O, p.pared + p.pestana);
  if (p.hueco && p.hueco !== 'no') { const bb = bbox(F, O); const hs = Math.min(bb.bw, bb.bh) * p.tamHueco / 100; const fit = FIT[p.forma] || [0, 0, 0, 0]; const hy = p.modo === 'forma' ? S0 * (fit[3] || 0) : 0;
    const Hm = F.shape(p.hueco, cx, hy + p.posHueco, hs, hs); const ib = outline(F, Hm, p.pared); blade = or(blade, ib);
    const ribs = and(F.draw(c => { c.lineWidth = 3; c.beginPath(); c.moveTo(cx - S0, hy + p.posHueco); c.lineTo(cx + S0, hy + p.posHueco); c.stroke(); }), sub(dilate(F, O, p.pared + 0.5), Hm));
    lip = or(lip, ribs, outline(F, Hm, p.pared + 1.5)); }
  const layers = [L('Pestaña', lip, 0, 2, C.rosa), L('Cuchilla', blade, 2, p.alto, C.rosa)];
  if (det && p.marcas) layers.push(L('Marcas interiores', or(dilate(F, det, 0.3), F.blank()), 2, p.alto * 0.55, C.rosa));
  if (p.sello) { const plate = mirrorTo(F, erode(F, O, 0.8), cx, sx); const rel = det || T || F.blank(); layers.push(L('Sello: base', plate, 0, 3, C.lila), L('Sello: relieve', and(mirrorTo(F, rel, cx, sx), erode(F, plate, 1)), 3, 3 + p.relieve, C.lila)); }
  return { F, layers };
}
function gCortGrid(p) {
  const W = p.cols * p.celdaX, H = p.filas * p.celdaY; const F = frame(W + 2 * p.pestana + 8, H + 2 * p.pestana + 8);
  const box = F.rectC(0, 0, W, H, 1); const grid = F.draw(c => { c.lineWidth = p.pared; c.beginPath(); for (let i = 1; i < p.cols; i++) { const x = -W / 2 + i * p.celdaX; c.moveTo(x, -H / 2); c.lineTo(x, H / 2); } for (let j = 1; j < p.filas; j++) { const y = -H / 2 + j * p.celdaY; c.moveTo(-W / 2, y); c.lineTo(W / 2, y); } c.stroke(); });
  const blades = or(outline(F, box, p.pared), and(grid, box)); const ribs = or(outline(F, box, p.pared + p.pestana), and(dilate(F, grid, 1.2), box));
  return { F, layers: [L('Refuerzo', ribs, 0, 2, C.rosa), L('Cuchillas', blades, 2, p.alto, C.rosa)] };
}
/* sellos */
function gSello(p, o = {}) {
  const f = font(p.fuente);
  if (o.letras) {
    const chars = [...String(p.texto || 'ABC').replace(/\s/g, '')].slice(0, 30); const sz = p.tam, gap = 4; const cols = Math.min(chars.length, 6), rows = Math.ceil(chars.length / cols);
    const F = frame(cols * (sz + gap), rows * (sz + gap)); let base = F.blank(), rel = F.blank();
    chars.forEach((ch, i) => { const x = -cols * (sz + gap) / 2 + (i % cols + 0.5) * (sz + gap), y = -rows * (sz + gap) / 2 + ((i / cols | 0) + 0.5) * (sz + gap);
      const b = F.rectC(x, y, sz, sz, 2); base = or(base, b); const s = fitSize([ch], f, sz * 0.75, sz * 0.75); rel = or(rel, and(F.text([ch], f, s, x, y, { mirror: true }), erode(F, b, 1))); });
    return { F, layers: [L('Bases', base, 0, 3, C.rosa), L('Letras (espejo)', rel, 3, 3 + p.relieve, C.rosa)], note: 'Las letras salen en espejo para que el sello imprima al derecho.' };
  }
  const D = p.diametro; const F = frame(D + 10, D + 10); const forma = p.forma || 'circulo';
  const S = F.shape(forma, 0, 0, D, forma === 'rect' ? (p.alto || D * 0.6) : D); let R;
  if (p.modo === 'texto') { const t = lines(p.texto, 'Hecho con amor'); const fit = FIT[forma] || [.7, .55]; const s = fitSize(t, f, D * fit[0], (forma === 'rect' ? (p.alto || D * 0.6) : D) * fit[1]); R = F.text(t, f, s, 0, 0, { mirror: true }); }
  else { const s = imgFit(p.img, D * 0.82, D * 0.82); R = F.image(p.img, 0, 0, s.w, s.h, { thr: p.umbral, mirror: true }); }
  if (p.bordeSello) R = or(R, ring(F, erode(F, S, 1.2), 1));
  let zh = 0; const layers = [];
  if (p.mango) { const hh = forma === 'rect' ? Math.min(D, p.alto || D * 0.6) : D; const rp = Math.max(7, hh / 2 - 1.5), rs = Math.min(6, rp - 1), rk = Math.min(rp, 13); zh = (rp - rs) + 24;
    const m = K.newMesh(); K.lathe([[0, 0], [rk, 0], [rk, 2.5], [rs, 2.5 + (rk - rs)], [rs, zh - (rp - rs)], [rp, zh], [0, zh]], 0, 0, 64, m); layers.push(LM('Mango', m, C.gris)); }
  layers.push(L('Base', S, zh, zh + 3, C.lila), L('Relieve (espejo)', and(R, erode(F, S, 1)), zh + 3, zh + 3 + p.relieve, C.lila));
  return { F, layers, note: p.mango ? 'Se imprime en una pieza, con el mango apoyado en la cama y el relieve hacia arriba.' : '' };
}
/* letreros */
function gLetrero(p, o = {}) {
  const f = font(p.fuente); const t = lines(p.texto, 'NOAH'); const d = tdim(t, f, p.ancho);
  const F = frame(p.ancho + 2 * (p.contorno + (p.contorno2 || 0)) + 8, d.h + 2 * (p.contorno + (p.contorno2 || 0)) + 14);
  const T = F.text(t, f, d.s, 0, 0); let c1 = close(F, dilate(F, T, p.contorno), 1.5); let c2 = o.tres ? close(F, dilate(F, T, p.contorno + p.contorno2), 2) : null;
  const flat = (m) => { if (!p.pie) return m; const bb = bbox(F, m); return or(m, F.rect(bb.x0 + 2, bb.y1 - 5, bb.x1 - 2, bb.y1, 1)); };
  if (o.offset) { const base = flat(c1); return { F, layers: [L('Contorno', sub(base, T), 0, p.alto * 0.55, C.azul), L('Letras', T, 0, p.alto, C.blanco)] }; }
  if (o.tres) { c2 = flat(c2); return { F, layers: [L('Base', c2, 0, 3, C.negro), L('Contorno', c1, 3, 4.5, C.celeste), L('Letras', T, 4.5, 4.5 + p.alto, C.blanco)] }; }
  c1 = flat(c1); return { F, layers: [L('Base', c1, 0, 3, C.negro), L('Letras', T, 3, 3 + p.alto, C.blanco)] };
}
function gSeparadas(p, o = {}) {
  const f = font(p.fuente); const chars = [...String(p.texto || 'ELISA').replace(/\s/g, '')].slice(0, 16); const m = measure(['M'], f); const s = p.altura / m.h;
  const b = p.contorno + (o.tres ? p.contorno2 : 0); const ws = chars.map(ch => measure([ch], f).w * s + 2 * b); const gap = 4; const W = ws.reduce((a, c) => a + c, 0) + gap * (chars.length - 1);
  const F = frame(W + 6, p.altura + 2 * b + (o.plantilla ? p.altura + 2 * b + 14 : 6)); let x = -W / 2; let T = F.blank(), c1 = F.blank(), c2 = F.blank(); const ly = o.plantilla ? -(p.altura + 2 * b + 8) / 2 : 0;
  chars.forEach((ch, i) => { const cx = x + ws[i] / 2; const t = F.text([ch], f, s, cx, ly); T = or(T, t); c1 = or(c1, dilate(F, t, p.contorno)); if (o.tres) c2 = or(c2, dilate(F, t, b)); x += ws[i] + gap; });
  if (o.plantilla) { const yp = ly + p.altura / 2 + b + 8 + (p.altura + 2 * b) / 2; const pl = F.rectC(0, yp, W + 4, p.altura + 2 * b + 4, 3); const holes = shift(F, dilate(F, T, 0.4), 0, yp - ly);
    return { F, layers: [L('Letras: base', c1, 0, 3, C.azul), L('Letras', T, 3, 3 + p.alto, C.blanco), L('Plantilla de colocación', sub(pl, holes), 0, 1.6, C.gris)], note: 'Pega la plantilla en la pared, encaja las letras y retírala.' }; }
  if (o.tres) return { F, layers: [L('Base', c2, 0, 3, C.negro), L('Contorno', c1, 3, 4.5, C.celeste), L('Letras', T, 4.5, 4.5 + p.alto, C.blanco)] };
  return { F, layers: [L('Base', c1, 0, 3, C.negro), L('Letras', T, 3, 3 + p.alto, C.blanco)] };
}
function gDosLineas(p, o = {}) {
  const f = font(p.fuente), f2 = font(p.fuente2); const t1 = lines(p.texto, 'Feliz'), t2 = lines(p.texto2, 'PASCUA');
  const d1 = tdim(t1, f, p.ancho * 0.7), d2 = tdim(t2, f2, p.ancho); const iconH = o.icono ? (d1.h + d2.h) * 0.75 : 0; const H = d1.h + d2.h * 0.92;
  const b = p.contorno + (o.tres ? p.contorno2 : 0); const F = frame(p.ancho + iconH + 2 * b + 8, H + 2 * b + 8);
  const xo = -iconH / 2; let T = or(F.text(t1, f, d1.s, xo - p.ancho * 0.12, -H / 2 + d1.h / 2), F.text(t2, f2, d2.s, xo, H / 2 - d2.h / 2));
  if (o.corazon) T = or(T, F.shape('corazon', xo + p.ancho / 2 + d1.h * 0.1, -H / 2 + d1.h * 0.55, d1.h * 0.8, d1.h * 0.72));
  if (o.icono) { const s = imgFit(p.img, iconH, iconH); T = or(T, F.image(p.img, xo + p.ancho / 2 + iconH / 2 + 2, 0, s.w, s.h, { thr: p.umbral })); }
  const c1 = close(F, dilate(F, T, p.contorno), 2);
  if (o.tres) return { F, layers: [L('Base', close(F, dilate(F, T, b), 2.5), 0, 3, C.oro), L('Contorno', c1, 3, 4.5, C.lila), L('Texto', T, 4.5, 4.5 + p.alto, C.blanco)] };
  return { F, layers: [L('Base', c1, 0, 3, C.lila), L('Texto', T, 3, 3 + p.alto, C.blanco)] };
}
function gSocial(p, o = {}) {
  const f = font(p.fuente); const u = '@' + String(p.usuario || 'usuario').replace(/^@/, ''); const d = tdim([u], f, p.ancho);
  const qrS = o.qr ? d.h * 1.9 : 0; const W = p.ancho + (qrS ? qrS + 8 : 0); const F = frame(W + 2 * (p.contorno + 6), Math.max(d.h, qrS) + 2 * (p.contorno + 6) + 6);
  const T = F.text([u], f, d.s, -(qrS ? qrS + 8 : 0) / 2, 0);
  let Q = F.blank(); if (o.qr) Q = F.qr(qrContent({ red: p.red, usuario: p.usuario }, 'redes'), W / 2 - qrS / 2, 0, qrS);
  const layers = [];
  if (o.rect) { const R = F.rectC(0, 0, W + 2 * p.contorno + 6, Math.max(d.h, qrS) + 2 * p.contorno + 6, 4);
    if (o.tres) layers.push(L('Fondo', dilate(F, R, 2.5), 0, 2, C.negro), L('Placa', R, 2, 4, C.blanco), L('Texto', or(T, Q), 4, 4 + p.alto, C.negro));
    else layers.push(L('Placa', R, 0, 3, C.blanco), L('Texto', or(T, Q), 3, 3 + p.alto, C.negro));
  } else { const qpad = o.qr ? F.rectC(W / 2 - qrS / 2, 0, qrS + 4, qrS + 4, 1.5) : F.blank(); const all = or(T, qpad); const c1 = or(close(F, dilate(F, all, p.contorno), 2));
    if (o.tres) layers.push(L('Base', close(F, dilate(F, all, p.contorno + 2.5), 2.5), 0, 3, C.verde), L('Contorno', c1, 3, 4.5, C.blanco), L('Texto', or(T, Q), 4.5, 4.5 + p.alto, C.verde));
    else layers.push(L('Base', c1, 0, 3, C.verde), L('Texto', or(T, Q), 3, 3 + p.alto, C.blanco)); }
  if (o.qr) { const qz = layers[layers.length - 1]; qz.mask = or(T, Q); }
  return { F, layers };
}
function gProfesional(p) {
  const f = font(p.fuente), f2 = font('montserrat'); const t1 = lines(p.texto, 'LUANA RUIZ'), t2 = lines(p.texto2, 'ABOGADA');
  const d1 = tdim(t1, f, p.ancho), d2 = tdim(t2, f2, p.ancho * 0.45); const lH = p.logo ? d1.h * 1.6 : 0; const H = d1.h + d2.h + 4;
  const W = p.ancho + (lH ? lH + 6 : 0); const F = frame(W + 10, H + 26); const xo = (lH ? lH + 6 : 0) / 2;
  let T = or(F.text(t1, f, d1.s, xo, -H / 2 + d1.h / 2 - 6), F.text(t2, f2, d2.s, xo, H / 2 - d2.h / 2 - 6));
  if (p.logo) { const s = imgFit(p.img, lH, lH); T = or(T, F.image(p.img, -W / 2 + lH / 2, -6, s.w, s.h, { thr: p.umbral })); }
  const yb = H / 2 - 6 + 2; const bar = F.rect(-W / 2 - 3, yb, W / 2 + 3, yb + 6, 1.5);
  const conn = and(close(F, dilate(F, T, 1.2), 3), F.rect(-W, -H, W, yb + 1)); const piece = or(conn, bar);
  return { F, layers: [L('Base', piece, 0, 3, C.marron), L('Texto', T, 3, 3 + p.alto, C.crema)], note: 'Se imprime tumbada; la barra inferior permite dejarla de pie.' };
}
/* colorear */
function silueta(F, I) { return fillHoles(F, close(F, dilate(F, I, 0.5), 2)); }
function gColorear(p, o = {}) {
  const v = o.v; const s = imgFit(p.img, p.ancho, p.ancho); const pad = (p.offset || 0) + 10;
  const F = frame((v === '2partes' ? 2 : 1) * (s.w + 2 * pad) + 6, s.h + 2 * pad); const cx = v === '2partes' ? -(s.w / 2 + pad) : 0;
  const I = F.image(p.img, cx, 0, s.w, s.h, { thr: p.umbral }); const O = silueta(F, I); const lw = dilate(F, I, Math.max(0, p.grosorLinea / 2 - 0.3));
  switch (v) {
    case 'hundida-forma': { const S = F.shape(p.forma, 0, 0, s.w + 2 * p.offset, s.h + 2 * p.offset); const cut = and(lw, erode(F, S, 1.5)); return { F, layers: [L('Placa', S, 0, 2, C.crema), L('Placa (superficie)', sub(S, cut), 2, 3.4, C.crema)] }; }
    case 'hundida-offset': { const S = close(F, dilate(F, O, p.offset), 3); const cut = and(lw, erode(F, S, 1.5)); return { F, layers: [L('Placa', S, 0, 2, C.rosa), L('Placa (superficie)', sub(S, cut), 2, 3.4, C.rosa)] }; }
    case '2partes': { const outerR = F.rectC(cx, 0, s.w + 2 * pad - 4, s.h + 2 * pad - 4, 4); const hole = dilate(F, O, 0.3);
      const insL = shift(F, and(lw, O), -2 * cx, 0); const insB = shift(F, O, -2 * cx, 0);
      return { F, layers: [L('Marco: trasera', outerR, 0, 1.4, C.verde), L('Marco', sub(outerR, hole), 1.4, 4, C.verde), L('Pieza: base', insB, 0, 2.2, C.blanco), L('Pieza: líneas', and(insL, insB), 2.2, 3.4, C.negro)] }; }
    default: { const B = dilate(F, O, 1); return { F, layers: [L('Base', B, 0, 2, C.blanco), L('Líneas en relieve', or(and(lw, B), ring(F, B, 1.2)), 2, 3.6, C.blanco)] }; }
  }
}
function gPuzzle(p) {
  const W = p.ancho, H = p.alto; const cw = W / p.cols, ch = H / p.filas; const F = frame((p.bandeja ? 2 : 1) * (W + 10) + 4, H + 10); const cx = p.bandeja ? -(W / 2 + 5) : 0;
  const R = K.rng(p.semilla); const plate = F.rectC(cx, 0, W, H, 3);
  const edge = (c, x0, y0, x1, y1, s) => { const len = Math.hypot(x1 - x0, y1 - y0); c.save(); c.translate(x0, y0); c.rotate(Math.atan2(y1 - y0, x1 - x0)); c.scale(len, len);
    c.moveTo(0, 0); c.lineTo(0.4, 0); c.lineTo(0.42, 0.08 * s); const aL = Math.atan2(-0.12 * s, -0.08), aR = Math.atan2(-0.12 * s, 0.08); c.arc(0.5, 0.2 * s, 0.13, aL, aR, s > 0); c.lineTo(0.58, 0); c.lineTo(1, 0); c.restore(); };
  const cuts = F.draw(c => { c.lineWidth = p.corte; c.beginPath();
    for (let i = 1; i < p.cols; i++) for (let j = 0; j < p.filas; j++) { const x = cx - W / 2 + i * cw; edge(c, x, -H / 2 + j * ch, x, -H / 2 + (j + 1) * ch, R() < 0.5 ? 1 : -1); }
    for (let j = 1; j < p.filas; j++) for (let i = 0; i < p.cols; i++) { const y = -H / 2 + j * ch; edge(c, cx - W / 2 + i * cw, y, cx - W / 2 + (i + 1) * cw, y, R() < 0.5 ? 1 : -1); }
    c.lineWidth = p.corte; c.stroke(); });
  const pieces = sub(plate, cuts); const layers = [L('Piezas', pieces, 0, 3, C.azul)];
  if (p.dibujo) { const s = imgFit(p.img, W * 0.9, H * 0.9); layers.push(L('Dibujo', and(F.image(p.img, cx, 0, s.w, s.h, { thr: p.umbral }), erode(F, pieces, 0.6)), 3, 3.8, C.blanco)); }
  if (p.bandeja) { const tr = F.rectC(-cx, 0, W + 0.8 + 6, H + 0.8 + 6, 4); layers.push(L('Bandeja: fondo', tr, 0, 1.4, C.gris), L('Bandeja: borde', sub(tr, F.rectC(-cx, 0, W + 0.8, H + 0.8, 3)), 1.4, 4.4, C.gris)); }
  return { F, layers };
}
function gMultipartes(p) {
  const s = imgFit(p.img, p.ancho, p.ancho); const F = frame(2 * (s.w + 12) + 4, s.h + 12); const cx = -(s.w / 2 + 6);
  const I = dilate(F, F.image(p.img, cx, 0, s.w, s.h, { thr: p.umbral }), 0.4); const O = silueta(F, I); const cells = sub(O, I);
  const pcs = shift(F, erode(F, cells, 0.2), -2 * cx, 0);
  return { F, layers: [L('Bandeja', dilate(F, O, 1), 0, 1.4, C.negro), L('Líneas', or(and(I, O), ring(F, dilate(F, O, 1), 1.2)), 1.4, 4, C.negro), L('Piezas sueltas', pcs, 0, 2.4, C.rosa)], note: 'Cada pieza encaja en su hueco; imprímelas en los colores que quieras.' };
}
/* oficina */
function gPortalapices(p) {
  const W = p.ancho, D = p.fondo; const f = font(p.fuente); const t = lines(p.texto, 'LAURA'); const d = tdim(t, f, W * 0.95);
  const F = frame(W + 8, D + d.h + 22); const yB = -(d.h + 12) / 2; const box = F.shape(p.forma, 0, yB, W, D);
  const yN = yB + D / 2 + 8 + d.h / 2; const T = F.text(t, f, d.s, 0, yN); let dec = F.blank();
  if (p.corazones) { const n = Math.max(2, Math.round(W / 22)); for (let i = 0; i < n; i++) dec = or(dec, F.shape('corazon', -W / 2 + (i + 0.5) * W / n, yN - d.h / 2 - 3, 7, 6.3)); }
  const nb = close(F, dilate(F, or(T, dec), 2), 2);
  return { F, layers: [L('Bote: suelo', box, 0, 2, C.rosa), L('Bote: paredes', ring(F, box, p.pared), 2, p.alto, C.rosa), L('Nombre: base', nb, 0, 3, C.rosa), L('Nombre', or(T, dec), 3, 4.2, C.blanco)], note: 'El nombre se imprime aparte y se pega delante del bote.' };
}
function gMarcapaginas(p, o = {}) {
  const W = p.ancho, H = p.largo; const F = frame(W + 8, H + 8); const S = F.shape('marcapaginas', 0, 0, W, H); const hole = F.disk(0, -H / 2 + 6, 1.8);
  const inner = erode(F, S, 2); const f = font(p.fuente); const t = lines(p.texto, 'Lucía');
  const s = fitSize(t, f, H * 0.62, W * 0.62); const T = and(F.text(t, f, s, 0, H * 0.05, { rot: -Math.PI / 2 }), inner);
  let dec;
  if (o.estilo === 'silueta') { const ss = imgFit(p.img, W * 1.1, H * 0.32); const sil = F.image(p.img, 0, -H / 2 + ss.h / 2, ss.w, ss.h, { thr: p.umbral }); const body = F.rect(-W / 2, -H / 2 + ss.h * 0.85, W / 2, H / 2, 3);
    const S2 = or(sil, body); const T2 = and(F.text(t, f, fitSize(t, f, H * 0.55, W * 0.62), 0, H * 0.12, { rot: -Math.PI / 2 }), erode(F, body, 2));
    return { F, layers: [L('Base', S2, 0, 1.4, C.negro), L('Relieve', or(ring(F, S2, 1.2), ring(F, erode(F, body, 2.6), 0.8)), 1.4, 2.2, C.oro), L('Nombre', T2, 1.4, 2.4, C.oro)] }; }
  if (o.estilo === 'imagen') { const ss = imgFit(p.img, W * 0.8, H * 0.3); dec = F.image(p.img, 0, -H / 2 + 12 + ss.h / 2, ss.w, ss.h, { thr: p.umbral }); }
  else if (o.estilo === 'elegante') dec = ring(F, erode(F, S, 3), 0.8);
  else dec = F.pattern(o.estilo === 'geometrico' ? 'rombos' : 'floral', p.sep, 0.8, p.semilla || 3);
  dec = sub(and(dec, inner), dilate(F, T, 2), dilate(F, hole, 2));
  return { F, layers: [L('Base', sub(S, hole), 0, 1.4, C.lila), L('Relieve', or(dec, sub(ring(F, S, 1.2), dilate(F, hole, 1))), 1.4, 2.2, C.blanco), L('Nombre', T, 1.4, 2.4, C.blanco)] };
}
function gTarjeta(p) {
  const W = 85, H = 55; const F = frame(W + 6, H + 6); const S = F.rectC(0, 0, W, H, 3); const f = font(p.fuente), f2 = font('montserrat');
  const q = p.qr ? 30 : 0; const tw = W - 10 - (q ? q + 4 : 0); const xl = -W / 2 + 5 + tw / 2;
  const s1 = fitSize(lines(p.nombre, 'Nombre'), f, tw, 11); let T = F.text(lines(p.nombre, 'Nombre'), f, s1, xl, -H / 2 + 12, { align: 'left' });
  if (p.cargo) T = or(T, F.text([p.cargo], f2, Math.min(4, fitSize([p.cargo], f2, tw, 4.5)), xl, -H / 2 + 21, { align: 'left' }));
  const info = lines(p.datos, ''); if (p.datos) T = or(T, F.text(info, f2, Math.min(3.4, fitSize(info, f2, tw, 20, 1.5)), xl, H / 2 - 13, { align: 'left', lh: 1.5 }));
  if (q) T = or(T, F.qr(p.url || 'https://', W / 2 - 5 - q / 2, 0, q));
  const layers = [L('Tarjeta', S, 0, 1.2, C.lila), L('Texto', and(T, erode(F, S, 1)), 1.2, 1.8, C.blanco)];
  if (p.textura && p.textura !== 'no') layers.splice(1, 0, L('Textura', sub(and(F.pattern(p.textura, 1.6, 0.5, 2), erode(F, S, 1.4)), dilate(F, T, 1.2)), 1.2, 1.5, C.lila));
  return { F, layers };
}
function gSoporteTarjetas(p) {
  const W = 95, D = 32; const F = frame(W + 6, D + 6); const B = F.rectC(0, 0, W, D, 3); const f = font(p.fuente);
  const back = F.rect(-W / 2, -D / 2, W / 2, -D / 2 + 3.2, 1), lip = F.rect(-W / 2, D / 2 - 9, W / 2, D / 2, 1);
  const s = fitSize(lines(p.texto, '@marca'), f, W - 10, 6); const T = and(F.text(lines(p.texto, '@marca'), f, s, 0, D / 2 - 4.5), erode(F, lip, 0.8));
  return { F, layers: [L('Base', B, 0, 3, C.lila), L('Respaldo', back, 3, 26, C.lila), L('Frente', lip, 3, 9, C.lila), L('Texto', T, 9, 10, C.blanco)] };
}
function gOrganizador(p) {
  let outer, cells;
  if (p.tipo === 'hex') { const r = p.celda / Math.sqrt(3); const rows = p.filas, cols = p.cols; const W = cols * p.celda + p.celda / 2 + 6, H = rows * 1.5 * r + r + 6; const F = frame(W, H);
    const cs = []; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cs.push([-W / 2 + 3 + p.celda / 2 + i * p.celda + (j % 2 ? p.celda / 2 : 0), -H / 2 + 3 + r + j * 1.5 * r]);
    outer = F.draw(c => { for (const [x, y] of cs) { c.beginPath(); const pts = K.regPoly(6, (p.celda + p.pared) / Math.sqrt(3) + 0.05, Math.PI / 6, x, y); c.moveTo(...pts[0]); pts.forEach(q => c.lineTo(...q)); c.closePath(); c.fill(); } });
    cells = F.draw(c => { for (const [x, y] of cs) { c.beginPath(); const pts = K.regPoly(6, (p.celda - p.pared) / Math.sqrt(3), Math.PI / 6, x, y); c.moveTo(...pts[0]); pts.forEach(q => c.lineTo(...q)); c.closePath(); c.fill(); } });
    return { F, layers: [L('Suelo', outer, 0, p.suelo, C.verde), L('Paredes', sub(outer, cells), p.suelo, p.alto, C.verde)] }; }
  const W = p.cols * p.celda + p.pared, H = p.filas * p.celda + p.pared; const F = frame(W, H); outer = F.rectC(0, 0, W, H, 3); cells = F.blank();
  for (let j = 0; j < p.filas; j++) for (let i = 0; i < p.cols; i++) cells = or(cells, F.rectC(-W / 2 + p.pared / 2 + (i + 0.5) * p.celda, -H / 2 + p.pared / 2 + (j + 0.5) * p.celda, p.celda - p.pared, p.celda - p.pared, 1.5));
  return { F, layers: [L('Suelo', outer, 0, p.suelo, C.marron), L('Paredes', sub(outer, cells), p.suelo, p.alto, C.marron)] };
}


/* cierre de rosca para la bolsita de malla (Manifold): boquilla partida en dos mitades, tapón con aro para colgar y pinza en U.
   La boquilla va con su eje en +y desde y=0; mitad delantera en z>=0 y trasera girada 180° (se imprime y se le da la vuelta). */
const ROSCA = { R: 6.5, e: 0.7, rb: 3.3, L: 9, paso: 3 };
function cierreRosca(eMalla, holg) {
  const MF = K.mf(), k = K.keep, { R, e, rb, L, paso } = ROSCA, segs = 48;
  /* rosca: círculo descentrado extruido con giro → hélice de un filete (sin voladizos de más de 45°) */
  const helice = (r, h) => k(k(k(k(MF.CrossSection.circle(r, segs)).translate([e, 0])).extrude(h, Math.ceil(h / 0.12), 360 * h / paso)));
  const cuello = k(helice(R - e, L).subtract(k(MF.Manifold.cylinder(L + 2, rb, rb, segs)).translate([0, 0, -1])));
  const ejeY = k(cuello.rotate([-90, 0, 0]));
  const caja = (z0) => k(k(MF.Manifold.cube([60, 60, 30])).translate([-30, -30, z0]));
  const delantera = k(ejeY.intersect(caja(0))), trasera = k(k(ejeY.intersect(caja(-30))).rotate([0, 180, 0]));
  /* tapón: se imprime boca abajo; rosca interior con holgura; aro arriba para la cinta */
  const Rc = R + holg + 1.8, top = 1.6, Hc = L - 1.5 + top;
  let tapon = k(k(MF.Manifold.cylinder(Hc, Rc, Rc, segs)).subtract(k(helice(R - e + holg, Hc - top)).translate([0, 0, -0.01])));
  const aro = k(k(k(MF.Manifold.cylinder(2.4, 3.6, 3.6, 40)).subtract(k(MF.Manifold.cylinder(3, 1.7, 1.7, 32)).translate([0, 0, -0.3]))).rotate([90, 0, 0]));
  tapon = k(tapon.add(k(k(aro.translate([0, 1.2, 0])).translate([0, 0, Hc + 2.4]))));
  /* pinza en U: sujeta los dos bordes juntos (hueco = 2 grosores de malla + 0,15) */
  const g = 2 * eMalla + 0.15, w = 1.6, la = 7, an = 5;
  const pinza = k(k(MF.Manifold.cube([la + w, g + 2 * w, an])).subtract(k(MF.Manifold.cube([la + 1, g, an + 2])).translate([w, w, -1])));
  return { delantera, trasera, tapon, pinza, R, L, rb };
}

/* remache a presión para cerrar la bolsita: pin con cabeza + tapita en cúpula con agujero ciego (ajuste a presión) */
const REM = { rc: 3.2, rs: 1.2, hc: 1.2 };
function remache(eMalla, holg) {
  /* perfiles de revolución (r, z): una sola pieza limpia cada uno */
  const MF = K.mf(), k = K.keep, { rc, rs, hc } = REM; const Lp = 2 * eMalla + 2.2, hd = rc * 0.6, hh = rs + holg;
  const rev = pts => k(k(new MF.CrossSection([pts])).revolve(48));
  const pin = rev([[0, 0], [rc, 0], [rc, hc], [rs, hc], [rs, hc + Lp - 0.5], [rs * 0.7, hc + Lp], [0, hc + Lp]]);
  const domo = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; domo.push([rc * Math.cos(a), hc + hd * Math.sin(a)]); }
  domo[domo.length - 1][0] = 0;
  const tapa = rev([[hh, 0], [rc, 0], ...domo, [0, 2.4], [hh, 2.4]]);
  return { pin, tapa };
}

/* clip de cierre tipo pinza de pelo: el puente va metido en las ranuras de las dos mallas, las patas bajan una por cada cara
   hasta pasar el borde y allí la pata de delante engancha la de detrás. Se cierra apretando con el alicate (el gancho salta y hace clic)
   y se abre empujando el gancho hacia fuera. Se imprime ya cerrado, tumbado (alto = ancho de la pinza), con 0,3 mm de holgura en el gancho. */
function clipCierre(eMalla, L = 9) {
  const MF = K.mf(), k = K.keep; const w = 1.0, g = 2 * eMalla + 0.2, an = 5;
  const r = (x0, y0, x1, y1) => k(k(MF.CrossSection.square([x1 - x0, y1 - y0])).translate([x0, y0]));
  const hb = -w - 0.9;
  const una = k(new MF.CrossSection([[[L + 0.41, -w - 0.3], [L - 0.4, -w - 0.3], [L + 0.41, hb]]]));
  const cs = k(MF.CrossSection.union([r(-1.2, -w, 0.01, g + w), r(0, -w, L, 0), r(0, g, L + 1.2, g + w), r(L + 0.4, hb, L + 1.2, g + 0.01), una]));
  return k(cs.extrude(an));
}

/* imagen en color → capas por color (k-medias). Fondo = transparente, o el color que domina el borde de la imagen.
   Devuelve { all, capas: [{ m, hex }] } ordenadas de la más clara a la más oscura. */
function capasColor(F, img, cx, cy, iw, ih, nCol) {
  const d = F.rgba(img, cx, cy, iw, ih), { w, h } = F, n = w * h;
  /* rectángulo de la imagen, 2 píxeles hacia dentro para no leer el borde suavizado */
  const x0 = Math.max(1, Math.ceil((cx - iw / 2) * F.res + w / 2) + 2), x1 = Math.min(w - 2, Math.floor((cx + iw / 2) * F.res + w / 2) - 2), y0 = Math.max(1, Math.ceil((cy - ih / 2) * F.res + h / 2) + 2), y1 = Math.min(h - 2, Math.floor((cy + ih / 2) * F.res + h / 2) - 2);
  const dentro = new Uint8Array(n); for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const q = j * w + i; if (d[q * 4 + 3] >= 100) dentro[q] = 1; }
  /* fondo opaco: el color más repetido en el contorno del rectángulo de la imagen */
  const cnt = new Map(); const borde = (i, j) => { const q = (j * w + i) * 4; if (d[q + 3] < 100) return; const key = (d[q] >> 4) << 8 | (d[q + 1] >> 4) << 4 | d[q + 2] >> 4; cnt.set(key, (cnt.get(key) || 0) + 1); };
  for (let i = x0; i <= x1; i++) { borde(i, y0); borde(i, y1); } for (let j = y0; j <= y1; j++) { borde(x0, j); borde(x1, j); }
  let bg = null, best = 0; for (const [k2, v] of cnt) if (v > best) { best = v; bg = k2; }
  const per = 2 * (x1 - x0 + y1 - y0); if (bg !== null && best > per * 0.35) { const br = ((bg >> 8) << 4) + 8, bgG = (((bg >> 4) & 15) << 4) + 8, bb = ((bg & 15) << 4) + 8;
    for (let q = 0; q < n; q++) if (dentro[q]) { const k3 = q * 4; if (Math.abs(d[k3] - br) + Math.abs(d[k3 + 1] - bgG) + Math.abs(d[k3 + 2] - bb) < 60) dentro[q] = 0; } }
  /* k-medias en RGB sobre una muestra */
  const idx = []; for (let q = 0; q < n; q++) if (dentro[q]) idx.push(q); if (!idx.length) return { all: F.blank(), capas: [] };
  const paso = Math.max(1, Math.floor(idx.length / 15000)), mu = []; const px = q => [d[q * 4], d[q * 4 + 1], d[q * 4 + 2]];
  const dist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  mu.push(px(idx[Math.floor(idx.length / 2)]));
  while (mu.length < nCol) { let far = null, fd = -1; for (let t = 0; t < idx.length; t += paso) { const c = px(idx[t]); let m = Infinity; for (const u of mu) m = Math.min(m, dist(c, u)); if (m > fd) { fd = m; far = c; } } if (fd < 900) break; mu.push(far); }
  for (let it = 0; it < 12; it++) { const sum = mu.map(() => [0, 0, 0, 0]);
    for (let t = 0; t < idx.length; t += paso) { const c = px(idx[t]); let b = 0, bd = Infinity; mu.forEach((u, k4) => { const dd = dist(c, u); if (dd < bd) { bd = dd; b = k4; } }); const s2 = sum[b]; s2[0] += c[0]; s2[1] += c[1]; s2[2] += c[2]; s2[3]++; }
    sum.forEach((s2, k4) => { if (s2[3]) mu[k4] = [s2[0] / s2[3], s2[1] / s2[3], s2[2] / s2[3]]; }); }
  const ms = mu.map(() => new Uint8Array(n));
  for (const q of idx) { const c = px(q); let b = 0, bd = Infinity; mu.forEach((u, k4) => { const dd = dist(c, u); if (dd < bd) { bd = dd; b = k4; } }); ms[b][q] = 1; }
  const hex = u => '#' + u.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const capas = ms.map((m, k4) => { for (let i = 0; i < w; i++) { m[i] = 0; m[(h - 1) * w + i] = 0; } for (let j = 0; j < h; j++) { m[j * w] = 0; m[j * w + w - 1] = 0; } return { m, hex: hex(mu[k4]), lum: 0.299 * mu[k4][0] + 0.587 * mu[k4][1] + 0.114 * mu[k4][2] }; }).filter(c => K.count(c.m)).sort((a, b) => b.lum - a.lum);
  const all = F.blank(); for (const c of capas) for (let q = 0; q < n; q++) if (c.m[q]) all[q] = 1;
  return { all, capas };
}

/* termoformado: molde macho (cúpula + diseño) y hembra en espejo con holgura para la lámina */
function gTermo(p) {
  /* con diseño de imagen, la forma puede ser la silueta de la propia imagen (más un margen) */
  const sigue = p.diseno === 'imagen' && p.formaImg !== false && p.imgD, mg = p.margenImg ?? 3;
  const si = sigue ? imgFit(p.imgD, p.tam, p.tam) : null;
  const W = sigue ? si.w + 2 * mg : p.tam, Hs = sigue ? si.h + 2 * mg : (p.forma === 'cuadrado' || p.forma === 'circulo' || p.forma === 'flor') ? W : W * (p.forma === 'ovalo' ? 0.7 : 1);
  const enColor = p.diseno === 'imagen' && p.colorImg === 'color' && p.imgD;
  const imgM = (G, cx, cy, iw, ih) => enColor ? capasColor(G, p.imgD, cx, cy, iw, ih, p.nColores || 4).all : G.image(p.imgD, cx, cy, iw, ih, { thr: p.umbral });
  const silueta = (G) => { const im = imgM(G, 0, 0, si.w, si.h); return { im, S: dilate(G, K.fillHoles(G, close(G, im, 1.5)), mg) }; };
  const t = p.eva, H = p.alto, R = Math.max(1, p.redondeo), E = (p.estilo || 'liso') === 'liso' ? 0 : p.relieveD, sign = p.estilo === 'hundido' ? -1 : 1;
  /* molde "plano" (como el vídeo): hembra = bandeja con escalón para el borde de la malla; macho = placa con la silueta */
  const plano = (p.molde || 'plano') === 'plano', cierre = p.cierre || 'rosca';
  const remaches = p.malla && p.trasera !== 'no' && cierre === 'remaches';
  /* los remaches y la ranura del clip tienen que caer en la pestaña plana (no en la curva): pestaña más ancha */
  const conClip = p.malla && p.trasera !== 'no' && cierre === 'rosca';
  const pestana = remaches ? Math.max(p.pestana ?? 2, 7) : (p.pestana ?? 2);   /* la ranura del clip va en una orejita propia, no ensancha todo el borde */
  const escalon = pestana + 1, paredH = 4, padP = plano ? escalon + paredH : 0, guias = p.guias && !plano;
  const F = frame(W + 2 * t + 4 + 2 * padP, Hs + 2 * t + 4 + 2 * padP, { margin: guias ? 13 : 5, maxPx: Math.min(340, K.QUALITY.maxPx), res: Math.min(4, K.QUALITY.res) });
  let S;
  if (sigue) S = silueta(F).S;
  else S = F.shape(p.forma, 0, 0, W, Hs);
  /* tamaño del dibujo: escala el hueco que ocupa dentro de la forma (100 % = como antes); lo que se salga se recorta por el borde */
  const kD = (p.tamDiseno ?? 100) / 100, escF = f => [f[0] * kD, f[1] * kD, f[2], f[3]];
  const fit = escF(FIT[p.forma] || [.6, .45]); let D = F.blank();
  if (sigue) D = silueta(F).im;
  else if (p.diseno === 'texto') { const f = font(p.fuente); const tx = lines(p.texto, 'Feliz Navidad'); const s = fitSize(tx, f, W * fit[0], Hs * fit[1] * 1.3, 1.05); D = F.text(tx, f, s, W * (fit[2] || 0), Hs * (fit[3] || 0), { lh: 1.05 }); }
  else if (p.diseno === 'imagen') { const s = imgFit(p.imgD, W * fit[0], Hs * fit[1] * 1.4); D = imgM(F, W * (fit[2] || 0), Hs * (fit[3] || 0), s.w, s.h); }
  else if (p.diseno === 'copo') D = K.snowflake(F, W * (fit[2] || 0), Hs * (fit[3] || 0), Math.min(W * fit[0], Hs * fit[1] * 1.4) * 0.5, 1.8, p.semilla);
  else if (p.diseno === 'patron') D = F.pattern(p.patron, p.sep, 1.4, p.semilla);
  D = and(D, erode(F, S, R * 0.6 + 1));
  const n = F.n, res = F.res, w = F.w, h = F.h;
  const tray = p.perfil === 'bandeja'; const run = H / Math.tan((p.angulo || 70) * Math.PI / 180);
  const dome = (Sx, Rr, extra = 0) => { const Dd = K.edt(F, K.inv(F, Sx)); const o = new Float32Array(n); for (let i = 0; i < n; i++) if (Sx[i]) { const dd = Math.sqrt(Dd[i]) / res;
    if (tray) { const r0 = Math.min(1.5, run * 0.5); const x = dd - extra; let hh; if (x <= 0) hh = 0; else if (x < run) hh = H * x / run; else hh = H; if (x > run - r0 && x < run + r0) { const q = (x - (run - r0)) / (2 * r0); hh = H * ((run - r0) / run) + (H * r0 / run) * (2 * q - q * q); } o[i] = Math.min(H, hh); }
    else { const u = Math.min(1, dd / Rr); o[i] = H * Math.sqrt(1 - (1 - u) * (1 - u)); } } return o; };
  const emb = (M) => { const Dd = K.edt(F, K.inv(F, M)); const o = new Float32Array(n); for (let i = 0; i < n; i++) if (M[i]) o[i] = E * Math.min(1, Math.sqrt(Dd[i]) / res / 0.45); return o; };
  const base = p.base; const hm = dome(S, R), em = emb(D);
  /* tela que sobra al cubrir el borde: lo que mide la curva (o la pared) menos lo que ocupa en plano, más una pestaña plana */
  const ang = (p.angulo || 70) * Math.PI / 180, ea = Math.max(1, Math.min(R, Math.min(W, Hs) / 2));
  const curva = tray ? H / Math.sin(ang) - H / Math.tan(ang) : Math.PI / 4 * (3 * (ea + H) - Math.sqrt((3 * ea + H) * (ea + 3 * H))) - ea;
  const extra = Math.max(1, curva) + pestana;
  /* boquilla de rosca: en lo alto de la figura, en el borde de la malla */
  const rosca = p.malla && p.trasera !== 'no' && cierre === 'rosca' && K.hasCSG();
  const bS = bbox(F, S), cuelloXY = rosca ? [bS.cx, extreme(F, dilate(F, S, extra), 'top', bS.cx - 1, bS.cx + 1)[1]] : [0, 0];
  const male = new Float32Array(n); for (let i = 0; i < n; i++) male[i] = base + Math.max(0, hm[i] + sign * em[i]);
  let pins = null; const pinH = t + 3;
  if (guias) { pins = F.blank(); const px = F.W / 2 - 6.5, py = F.H / 2 - 6.5; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pins = or(pins, F.disk(sx * px, sy * py, 3)); for (let i = 0; i < n; i++) if (pins[i]) male[i] = base + pinH; }
  const parts = []; const step = 1 / res; const off = F.W / 2 + 4;
  const mesh = (arr, dx) => { const m = K.heightMesh(arr, w, h, step); for (let k = 0; k < m.pos.length; k += 3) m.pos[k] += dx; K.fixOrientation(m); return m; };
  const two = p.piezas === 'ambas';
  const off2 = plano ? F.W / 2 + 2 : off;
  parts.push(LM('Molde macho', plano ? K.translateMesh(K.maskHeightMesh(F, S, k => male[k] + 6, 0) /* +6 mm de placa: sobresale de la hembra y empuja la malla hasta el fondo */, two ? -off2 : 0, 0) : mesh(male, two ? -off : 0), C.azul));
  if (two) {
    const St = dilate(F, S, t); const ht = tray ? dome(St, R + t, t * 0.4) : dome(St, R + t); const Dt = sign > 0 ? dilate(F, D, t * 0.5) : erode(F, D, Math.min(t * 0.5, 0.4)); const et = emb(Dt);
    const Hb = Math.max(base + H + E + 3, pinH + 4); const fem = new Float32Array(n);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const src = j * w + (w - 1 - i); const depth = St[src] ? Math.max(0, ht[src] + sign * et[src]) : 0; fem[j * w + i] = Math.max(1.2, Hb - depth); }
    if (pins) { const ph = dilate(F, pins, 0.35); for (let i = 0; i < n; i++) if (ph[i]) fem[i] = Math.max(1.2, Hb - pinH - 0.6); }
    /* canal en la hembra para que no aplaste la boquilla al prensar la malla (en espejo, como la hembra) */
    if (rosca) { const c = F.rect(-cuelloXY[0] - ROSCA.R - 1, cuelloXY[1] - ROSCA.L - 30, -cuelloXY[0] + ROSCA.R + 1, cuelloXY[1] + 3, 1);
      for (let i = 0; i < n; i++) if (c[i]) fem[i] = Math.max(1.2, Math.min(fem[i], Hb - ROSCA.R - 1)); }
    if (plano) { /* escalón del grosor de la malla donde apoya su borde plano, y pared alrededor siguiendo la forma */
      const esc = K.mirrorTo(F, sub(dilate(F, St, escalon), St), 0, 0), fuera = K.mirrorTo(F, dilate(F, St, escalon + paredH), 0, 0);
      for (let i = 0; i < n; i++) if (esc[i]) fem[i] = Math.max(1.2, Math.min(fem[i], Hb - (p.malla ? p.eMalla : t)));
      parts.push(LM('Molde hembra (en espejo)', K.translateMesh(K.maskHeightMesh(F, fuera, k => fem[k], 0), off2, 0), C.rosa)); }
    else parts.push(LM('Molde hembra (en espejo)', mesh(fem, off), C.rosa));
  }
  if (p.malla) {
    const G = frame(W + 2 * extra + 6, Hs + 2 * extra + 6 + (conClip ? 16 : 0), { margin: 4, maxPx: Math.min(900, K.QUALITY.maxPx), res: Math.min(4, K.QUALITY.res) });
    const sg = sigue ? silueta(G) : null;
    let S2 = sigue ? sg.S : G.shape(p.forma, 0, 0, W, Hs); let flat = K.close(G, dilate(G, S2, extra), Math.min(3, extra));
    let D2 = G.blank(); const ff = escF(FIT[p.forma] || [.6, .45]);
    let capas = null;
    if (sigue && enColor) { const cc = capasColor(G, p.imgD, 0, 0, si.w, si.h, p.nColores || 4); capas = cc.capas; D2 = cc.all; }
    else if (sigue) D2 = dilate(G, sg.im, 0.3);
    else if (p.diseno === 'texto') { const f = font(p.fuente); const tx = lines(p.texto, 'Feliz Navidad'); const sz = fitSize(tx, f, W * ff[0], Hs * ff[1] * 1.3, 1.05); D2 = G.text(tx, f, sz, W * (ff[2] || 0), Hs * (ff[3] || 0), { lh: 1.05, bold: 0.5 }); }
    else if (p.diseno === 'imagen') { const sz = imgFit(p.imgD, W * ff[0], Hs * ff[1] * 1.4); if (enColor) { const cc = capasColor(G, p.imgD, W * (ff[2] || 0), Hs * (ff[3] || 0), sz.w, sz.h, p.nColores || 4); capas = cc.capas; D2 = cc.all; } else D2 = dilate(G, G.image(p.imgD, W * (ff[2] || 0), Hs * (ff[3] || 0), sz.w, sz.h, { thr: p.umbral }), 0.3); }
    else if (p.diseno === 'copo') D2 = K.snowflake(G, W * (ff[2] || 0), Hs * (ff[3] || 0), Math.min(W * ff[0], Hs * ff[1] * 1.4) * 0.5, 2.2, p.semilla);
    D2 = and(D2, erode(G, flat, p.bordeMalla + 1));
    /* dibujo más robusto: engorda solo las líneas finas hasta el grosor mínimo y quita trocitos sueltos (se rompían al despegarlo de la cama) */
    if (capas) { /* en color: cada zona se queda con su color; los trocitos sueltos de cada color se quitan (vuelven a ser malla) */
      const lim = Math.round(3 * G.res * G.res), ok = erode(G, flat, p.bordeMalla + 1); D2 = G.blank();
      capas = capas.map(c => { let m = and(c.m, ok), keep = G.blank(); for (const cc of K.components(G, m, lim)) keep = or(keep, cc); D2 = or(D2, keep); return { m: keep, hex: c.hex }; }).filter(c => K.count(c.m)); }
    else if (K.count(D2)) { const rr = (p.minDiseno ?? 1.4) / 2; const fino = sub(D2, K.open(G, D2, rr)); D2 = and(or(D2, dilate(G, fino, rr * 0.8)), erode(G, flat, p.bordeMalla + 1));
      let lim = G.blank(); for (const c of K.components(G, D2, Math.round(4 * G.res * G.res))) lim = or(lim, c); D2 = lim; }
    const lat = G.pattern(p.rejilla, p.paso, p.hilo, 1); const rim = ring(G, flat, p.bordeMalla);
    let solid = rim;
    let pegC = null;
    if (p.anilla) { const fb = bbox(G, flat); const km = Math.max(-1, Math.min(1, (+p.movColgar || 0) / 100)) * 0.85;   /* mover la pestaña por el borde de arriba */
      const e = km ? extreme(G, flat, 'top', fb.cx + km * fb.bw / 2 - 1, fb.cx + km * fb.bw / 2 + 1) : extreme(G, flat, 'top', fb.cx + fb.bw * 0.12, fb.cx + fb.bw * 0.32); const peg = G.rectC(e[0], e[1] - 2, 5, 9, 1.5); pegC = e; const pegHole = G.disk(e[0], e[1] - 4, 1.3); solid = or(solid, sub(peg, pegHole)); flat = or(flat, sub(peg, pegHole)); }
    /* remaches: pastillas macizas con agujero repartidas por la pestaña plana (no arriba, donde va el colgador) */
    let agujeros = G.blank(); const ptsR = [];
    if (remaches) { const mid = erode(G, flat, pestana / 2); const fb = bbox(G, mid);
      const dentro = (x, y) => { const i = Math.floor(x * G.res + G.w / 2), j = Math.floor(y * G.res + G.h / 2); return i >= 0 && j >= 0 && i < G.w && j < G.h && mid[j * G.w + i]; };
      let per = 0; const rg = ring(G, mid, 1); for (let i = 0; i < G.n; i++) per += rg[i]; per /= G.res * G.res;
      const nR = Math.max(4, Math.min(12, Math.round(per / 40))); const Rmax = Math.hypot(fb.bw, fb.bh);
      for (let k2 = 0; k2 < nR; k2++) { const a = -Math.PI / 2 + (k2 + 0.5) * 2 * Math.PI / nR; let last = null;
        for (let r = 0; r < Rmax; r += 0.25) { const x = fb.cx + r * Math.cos(a), y = fb.cy + r * Math.sin(a); if (dentro(x, y)) last = [x, y]; }
        if (last && !(pegC && Math.hypot(last[0] - pegC[0], last[1] - pegC[1]) < 9)) ptsR.push(last); }
      for (const q of ptsR) { solid = or(solid, G.disk(q[0], q[1], REM.rc + 0.2)); agujeros = or(agujeros, G.disk(q[0], q[1], REM.rs + 0.25)); }
      solid = and(sub(solid, agujeros), flat); }
    const dsg = p.disenoMalla === 'macizo' ? D2 : or(and(lat, D2), ring(G, D2, 0.6));
    const body = sub(or(and(lat, flat), solid), D2, agujeros); const two2 = p.trasera !== 'no'; const dy = -(F.H / 2 + G.H / 2 + 2), dxF = two2 ? -(G.W / 2 + 2) : 0, dxB = G.W / 2 + 2;
    let pins = G.blank();
    if (two2 && cierre === 'pivotes') { const mid = erode(G, flat, p.bordeMalla / 2); const fb = bbox(G, mid); const pts = [extreme(G, mid, 'left'), extreme(G, mid, 'right'), extreme(G, mid, 'bottom'), extreme(G, mid, 'top', fb.x0, fb.cx - fb.bw * 0.1)];
      for (const q of pts) pins = or(pins, G.disk(q[0], q[1], 0.85)); }
    /* boca de la boquilla: paso abierto en el borde para meter las chuches */
    let boca = G.blank(); const nx = cuelloXY[0], ny = extreme(G, flat, 'top', cuelloXY[0] - 1, cuelloXY[0] + 1)[1];
    /* base maciza alrededor del pie de la boquilla (la boquilla se mete 3 mm en ella) y paso abierto para las chuches */
    let base = G.blank(); const fondoBase = Math.max(5.5, p.bordeMalla + 3);
    if (rosca) { base = G.rect(nx - ROSCA.R - 1.5, ny - 0.5, nx + ROSCA.R + 1.5, ny + fondoBase, 1.5); boca = G.rect(nx - ROSCA.rb, ny - 2, nx + ROSCA.rb, ny + fondoBase + 1, 0.5); }
    /* boquilla de rosca: cada mitad se funde con su malla para que salgan en una sola pieza (no se separan al imprimir ni al mover) */
    let bq = null;
    if (rosca) {
      const cr = cierreRosca(p.eMalla, p.holgRosca ?? 0.35); const y0 = -ny - 3;   /* coordenadas de malla: y hacia arriba; 3 mm metida en la base */
      const yc = dy - G.H / 2 - 14;
      bq = { del: K.solidMesh(K.keep(cr.delantera.translate([nx + dxF, y0 + dy, 0]))), tras: K.solidMesh(K.keep(cr.trasera.translate([-nx + dxB, y0 + dy, 0]))),
        tapon: K.solidMesh(K.keep(cr.tapon.translate([-12, yc, 0]))), pinzas: K.solidMesh(K.keep(cr.pinza.translate([4, yc - 5, 0]))) };
    }
    const conBoquilla = (nombre, malla, b) => { const u = b && K.unionMeshes([malla, b]); if (u) return [LM(nombre + ' (con boquilla)', u, p.colorMalla || C.rojo)];
      return b ? [LM(nombre, malla, p.colorMalla || C.rojo), LM('Boquilla de ' + nombre.toLowerCase(), b, p.colorMalla || C.rojo)] : [LM(nombre, malla, p.colorMalla || C.rojo)]; };
    /* el dibujo se apoya en una capa fina del color de la malla (la primera capa) que lo une a ella por toda su superficie;
       antes solo tocaba la malla por los lados y se soltaba al despegarlo de la cama. Se ve por arriba, donde el texto se lee al derecho */
    /* cierre de abajo (con la rosca): en las dos mallas, una zona maciza en el borde con una ranura en el mismo sitio;
       el clip atraviesa las dos ranuras y se engancha (como en el vídeo) */
    let oreja = G.blank(), agOreja = G.blank(), clip = false, dClip = 5;
    if (rosca && two2) { const fb = bbox(G, flat); const [xb, yb] = extreme(G, flat, 'bottom', fb.cx - 1.5, fb.cx + 1.5);
      /* orejita redonda que sale del borde de abajo con la ranura dentro: así el resto de la malla no necesita pestaña ancha */
      const yo = yb + 1.5; dClip = 0; agOreja = G.rect(xb - 3.1, yo - 1, xb + 3.1, yo + 1, 0.3);
      oreja = or(G.disk(xb, yo, 5.5), and(G.rect(xb - 5.5, yb - 5, xb + 5.5, yo, 1.5), dilate(G, flat, 0.3))); clip = true; }
    /* el dibujo no se mete en la base de la boquilla, su paso ni la orejita del clip (con dibujos grandes se pisaban y la malla salía abierta) */
    const zona = dilate(G, or(base, boca, oreja), 0.8), bodyX = K.count(and(D2, zona)) ? sub(or(and(lat, flat), solid), sub(D2, zona), agujeros) : body;
    const dMask = sub(dsg, solid, zona), ancla = K.count(D2) && !p.dbg ? Math.min(0.24, p.eMalla / 3) : 0;
    /* red de seguridad: si una malla sale con aristas sueltas (pasa con algunas alineaciones de píxeles), se repasa la máscara y se rehace */
    const mmOk = (mask, z0, z1, dx, dyy) => { let m = mask, me = null;
      for (let t = 0; t < 3; t++) { me = mm(G, m, z0, z1, dx, dyy); if (!K.hasCSG() || K.checkMesh(me).ok) return me; m = t === 0 ? close(G, m, 0.25) : K.open(G, m, 0.25); }
      return me; };
    let mallaF = mmOk(sub(or(bodyX, K.count(and(D2, zona)) ? and(zona, flat) : G.blank(), base, oreja), boca, agOreja), 0, p.eMalla, dxF, dy);
    if (ancla) { const capa = mm(G, dMask, 0, ancla, dxF, dy); const u = K.unionMeshes([mallaF, capa]); mallaF = u || K.mergeMeshes([mallaF, capa]); }
    parts.push(...conBoquilla('Malla delantera', mallaF, bq && bq.del));
    if (capas) capas.forEach((c, i) => { const m = and(c.m, dMask); if (K.count(m)) parts.push(LM('Malla delantera: color ' + (i + 1), mm(G, m, ancla, p.eMalla, dxF, dy), c.hex)); });
    else if (K.count(D2)) parts.push(LM('Malla delantera: diseño', mm(G, dMask, ancla, p.eMalla, dxF, dy), C.blanco));
    if (two2) { if (K.count(pins)) parts.push(LM('Pivotes de cierre', mm(G, pins, p.eMalla, p.eMalla + 2, dxF, dy), p.colorMalla || C.rojo));
      /* la trasera es la misma figura en espejo: se voltea la malla 3D (exacto), no la máscara (el volteo de píxeles dejaba aristas sueltas) */
      const backU = sub(or(and(lat, flat), solid, base, oreja), boca, agujeros, agOreja, dilate(G, pins, 0.2));
      const mB = mmOk(backU, 0, p.eMalla, 0, 0); for (let q = 0; q < mB.pos.length; q += 3) mB.pos[q] = -mB.pos[q]; K.fixOrientation(mB);
      const back = K.translateMesh(mB, dxB, dy);
      parts.push(...conBoquilla('Malla trasera (en espejo)', back, bq && bq.tras)); }
    if (clip) { const yc = dy - G.H / 2 - 14; parts.push(LM('Pinza de cierre', K.solidMesh(K.keep(clipCierre(p.eMalla, 9).translate([6, yc, 0]))), C.rosa)); }
    if (remaches && ptsR.length && K.hasCSG()) { const rm = remache(p.eMalla, p.holgRem ?? 0.1); const yc = dy - G.H / 2 - 6, sep = 2 * REM.rc + 3, x0 = -(ptsR.length - 1) * sep / 2;
      const fila = (s3, y) => K.union(ptsR.map((_, i) => K.keep(s3.translate([x0 + i * sep, y, 0]))));
      parts.push(LM('Remaches: pines', K.solidMesh(fila(rm.pin, yc)), C.negro), LM('Remaches: tapitas', K.solidMesh(fila(rm.tapa, yc - sep)), C.negro)); }
    if (bq) {
      parts.push(LM('Tapón de rosca', bq.tapon, C.blanco));
    }
  }
  return { layers: parts, note: (p.malla ? 'Imprime las mallas en plano. Calienta cada una (pistola de calor o agua muy caliente) y presiónala entre el macho y la hembra; la trasera sale en espejo, así que se pone en el molde dada la vuelta. ' + (remaches ? 'Junta las dos mallas por la pestaña haciendo coincidir los agujeros, mete las chuches, pasa un pin por cada agujero y presiona su tapita hasta que quede firme (si entra floja o no entra, cambia el ajuste del remache). Imprime los remaches a 0,12–0,16 mm. ' : rosca ? 'Junta las dos mallas por el borde: las medias boquillas forman una boquilla con rosca; mete las chuches por ella, enrosca el tapón arriba (su aro sirve para colgarlo con una cinta) y abajo mete el puente de la pinza por las dos ranuras, con una pata por cada cara, y apriétala con un alicate hasta que el gancho haga clic por debajo del borde; para abrirla, empuja el gancho hacia fuera. Imprime tapón y pinza a 0,16 mm. ' : p.malla && p.trasera !== 'no' && p.cierre !== 'no' ? 'Después une las dos por el borde encajando los pivotes. ' : '') : '') + 'Calienta la lámina (EVA o goma) y présala entre el macho y la hembra dada la vuelta. El grosor de lámina ajusta la holgura.' + (guias ? ' Recorta la lámina para que no tape los cuatro pivotes de las esquinas.' : '') };
}


/* ===================== modelos con geometría curva ===================== */
function sampler(F, m, blur = true) {
  const { w, h, res } = F; const f = new Float32Array(w * h);
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i; f[k] = blur ? (4 * m[k] + 2 * (m[k - 1] + m[k + 1] + m[k - w] + m[k + w]) + m[k - w - 1] + m[k - w + 1] + m[k + w - 1] + m[k + w + 1]) / 16 : m[k]; }
  return (x, y) => { const fx = x * res + w / 2 - 0.5, fy = y * res + h / 2 - 0.5; const i = Math.floor(fx), j = Math.floor(fy); if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return 0; const a = fx - i, b = fy - j; const k = j * w + i; return f[k] * (1 - a) * (1 - b) + f[k + 1] * a * (1 - b) + f[k + w] * (1 - a) * b + f[k + w + 1] * a * b; };
}
/* rodillo de textura */
function gRodillo(p) {
  const R = p.diametro / 2, Lr = p.largo, C0 = 2 * Math.PI * R, band = 6;
  const F = frame(C0, Lr, { margin: 1, maxPx: 1000, res: 4 });
  let D;
  if (p.diseno === 'texto') { const f = font(p.fuente); const t = lines(p.texto, 'Hecho a mano'); const s = fitSize(t, f, C0 * 0.85, (Lr - 2 * band) * 0.8); D = F.text(t, f, s, 0, 0, { mirror: true }); }
  else if (p.diseno === 'imagen') {
    const Hz = Lr - 2 * band, ar = (p.img.height || 1) / (p.img.width || 1);
    if (p.cubrir === 'repetir') {
      /* número entero de copias en la vuelta para que no quede costura; en vertical, las filas que quepan */
      const n = Math.max(1, Math.round(C0 / p.tamImg)), tw = C0 / n, th = tw * ar; const tiles = [];
      const rows = Math.ceil(Hz / th / 2) + 1; for (let j = -rows; j <= rows; j++) for (let i = 0; i < n; i++) tiles.push([-C0 / 2 + tw * (i + 0.5), j * th, tw, th]);
      D = F.image(p.img, 0, 0, 0, 0, { thr: p.umbral, mirror: true, tiles });
    } else if (p.cubrir === 'estirar') D = F.image(p.img, 0, 0, C0, Hz, { thr: p.umbral, mirror: true });
    else { const ss = imgFit(p.img, C0 * 0.85, Hz * 0.85); D = F.image(p.img, 0, 0, ss.w, ss.h, { thr: p.umbral, mirror: true }); }
  }
  else D = F.pattern(p.patron, p.sep, p.grosorLinea, p.semilla);
  D = and(D, F.rect(-C0, -Lr / 2 + band, C0, Lr / 2 - band));
  const smp = sampler(F, D); const sign = p.estilo === 'hundido' ? -1 : 1; const Rb = sign > 0 ? R : R + p.relieve;
  const z0 = 0; const segs = Math.min(900, Math.round(C0 * 4)), nz = Math.min(800, Math.round(Lr * 4));
  const m = K.tube((a, z) => Rb + sign * p.relieve * smp(a / (2 * Math.PI) * C0 - C0 / 2, z - Lr / 2), () => p.eje / 2 + 0.15, z0, Lr, segs, nz, 0, 0);
  const layers = [LM('Rodillo', m, C.lila)];
  if (p.guias) { for (const [i, x] of [[0, Rb + p.masa + 8], [1, -(Rb + p.masa + 8)]]) { const g = K.newMesh(); K.lathe([[Rb + 0.25, 0], [Rb + 0.25 + p.masa + 1.6, 0], [Rb + 0.25 + p.masa + 1.6, band - 1], [Rb + 0.25, band - 1]], x * 1.2 + (i ? -R : R), 0, 128, g); layers.push(LM('Guía de grosor ' + (i + 1), g, C.gris)); } }
  return { layers, note: 'Imprime el rodillo de pie. Pasa una varilla o un lápiz de ' + p.eje + ' mm por el centro como eje.' + (p.guias ? ' Las guías se meten en los extremos lisos y fijan el grosor de la masa en ' + p.masa + ' mm.' : '') };
}
/* cortador con eyector (émbolo) */
function gEyector(p) {
  const S0 = p.tam, wl = p.pared, H = p.alto, off = S0 + 2 * wl + 10;
  const F = frame(2 * off + S0 + 30, S0 + 2 * wl + 6, { maxPx: 1100 });
  const shape = (cx) => { let S = F.shape(p.forma, cx, 0, S0, p.forma === 'ovalo' ? S0 * 0.72 : S0); if (p.redondeo > 0) S = K.open(F, S, p.redondeo); return S; };
  const S = shape(-off), outer = dilate(F, S, wl);
  const layers = [L('Cortador: tapa', sub(outer, F.disk(-off, 0, 3.3)), 0, 2, C.rosa), L('Cortador: pared', sub(outer, S), 2, H, C.rosa)];
  const Pl = erode(F, shape(0), p.holgura); const hole = F.disk(0, 0, 2.95);
  let Dm = F.blank(); const fit = FIT[p.forma] || [.6, .5];
  if (p.diseno === 'texto') { const f = font(p.fuente); const t = lines(p.texto, 'M'); const s = fitSize(t, f, S0 * fit[0], S0 * fit[1] * 1.2); Dm = F.text(t, f, s, 0, 0, { mirror: true }); }
  else if (p.diseno === 'imagen') { const ss = imgFit(p.img, S0 * 0.62, S0 * 0.62); Dm = F.image(p.img, 0, 0, ss.w, ss.h, { thr: p.umbral, mirror: true }); }
  Dm = and(Dm, erode(F, Pl, 1.5));
  layers.push(L('Émbolo: base', sub(Pl, hole), 0, 1.6, C.lila));
  if (p.cara === 'cupula') {
    const sd = K.signedDist(F, Pl); const bb = bbox(F, Pl); const Rr = Math.min(bb.bw, bb.bh) / 2; const T0 = 1.6 + 1.2 + p.hondo;
    const mesh = K.maskHeightMesh(F, Pl, k => { const din = Math.max(0, -sd[k]); const u = Math.min(1, din / (Rr * 0.85)); return T0 - p.hondo * Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))) + (Dm[k] ? p.relieve : 0); }, 1.6);
    layers.push(LM('Émbolo: cara cóncava', mesh, C.lila));
  } else layers.push(L('Émbolo', Pl, 1.6, 3, C.lila), L('Émbolo: relieve (espejo)', Dm, 3, 3 + p.relieve, C.lila));
  const len = H + 4; const rod = K.newMesh(); K.lathe([[0, 0], [2.8, 0], [2.8, len], [7, len], [7, len + 5], [0, len + 5]], off, 0, 48, rod); layers.push(LM('Varilla (pegar al émbolo)', rod, C.gris));
  return { F, layers, note: 'Mete la varilla por el agujero de la tapa del cortador y pégala al émbolo. Corta, empuja la varilla y la pieza sale con el dibujo marcado.' };
}
/* rosa 3D */
function gRosa3D(p) {
  const D = p.diametro, H = p.alto, n = p.capas, m0 = p.petalos, t = p.grosorP; const petals = K.newMesh();
  for (let k = 0; k < n; k++) { const fr = n > 1 ? k / (n - 1) : 0; const cnt = m0 + k; const hk = H * (1 - 0.3 * fr); const lean = (4 + p.apertura * fr) * Math.PI / 180; const rb = Math.max(D * 0.05, (D * 0.46 - hk * Math.sin(lean) - 0.06 * hk) * fr + D * 0.05 * (1 - fr)); const span = 2 * Math.PI / cnt * 1.35; const rot = k * 0.93;
    for (let j = 0; j < cnt; j++) { const tc = rot + j * 2 * Math.PI / cnt;
      const S = (u, v) => { const th = tc + u * span / 2 * (0.72 + 0.28 * v); const z = 1.6 + v * hk * Math.cos(lean) * (1 - 0.2 * u * u * v); const rho = rb + v * hk * Math.sin(lean) + 0.06 * hk * Math.pow(v, 3) * fr + 0.05 * hk * (1 - u * u) * Math.sin(Math.PI * v); return [rho * Math.cos(th), rho * Math.sin(th), z]; };
      const N = (u, v) => { const th = tc + u * span / 2 * (0.72 + 0.28 * v); return [Math.cos(th), Math.sin(th), 0]; };
      K.shell(S, N, t, 10, 12, petals); } }
  const bud = K.newMesh(); const r0 = D * 0.07; K.lathe([[0, 0.5], [r0, 0.5], [r0 * 1.15, H * 0.4], [r0 * 0.7, H * 0.72], [0, H * 0.8]], 0, 0, 48, bud);
  const F = frame(D + 6, D + 6, { margin: 4 }); const Rb = D * 0.4; let base = F.disk(0, 0, Rb); const layers = [];
  if (p.base === 'coletero') base = sub(base, F.rectC(-Rb * 0.55, 0, 3, Rb * 0.9, 1), F.rectC(Rb * 0.55, 0, 3, Rb * 0.9, 1));
  layers.push(L('Base', base, 0, 2, C.verde));
  return { F, layers: [...layers, LM('Pétalos', petals, C.rosa), LM('Botón central', bud, C.rosa)], note: p.base === 'coletero' ? 'Pasa la goma del coletero por las dos ranuras de la base.' : '' };
}
/* mini micrófono */
function gMicro(p) {
  const Rh = p.dCabeza / 2, Rt = p.dMango / 2, Rb = Rt * 0.78, L0 = p.largo, rs = 4, dep = 8; const arc = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI / 2; arc.push([Rh * Math.cos(a), Rh * Math.sin(a)]); }
  const top = K.newMesh(); K.lathe([[0, 0], ...arc.slice(0, -1), [0, Rh]], -2 * Rh - 6, 0, 96, top);
  const bot = K.newMesh(); K.lathe([[rs, 0], ...arc.slice(0, -1), [0, Rh], [0, dep], [rs, dep]], 0, 0, 96, bot);
  const handle = K.newMesh(); K.lathe([[0, 0], [Rb, 0], [Rb, 2], [Rt, L0], [rs - 0.15, L0], [rs - 0.15, L0 + dep - 0.6], [0, L0 + dep - 0.6]], 2 * Rh + 6, 0, 96, handle);
  const layers = [LM('Cabeza (mitad superior)', top, C.gris), LM('Cabeza (mitad inferior)', bot, C.gris), LM('Mango', handle, C.negro)];
  let F = null;
  if (p.nombre) { const Rc = Rt + 9; F = frame(2 * Rc + 4, 2 * Rc + 4, { margin: 3 }); const ringM = sub(F.disk(0, 0, Rc), F.disk(0, 0, Rt - 0.4)); const f = font(p.fuente);
    const T = and(F.arcText(p.nombre, f, 5.5, 0, 0, Rt + 3.2, false), ringM); layers.push(LM('Collarín', mm(F, ringM, 0, 3, 0, -2 * Rh - 10), C.rosa), LM('Nombre', mm(F, T, 3, 3.8, 0, -2 * Rh - 10), C.blanco)); }
  return { layers, note: 'La cabeza son dos medias esferas (imprímelas con la cara plana abajo y pégalas). El mango encaja en la mitad inferior; el collarín con el nombre sube por el mango hasta que ajusta.' };
}
/* contador de rascar */
function gRascar(p) {
  let vals = p.modo === 'numeros' ? [...Array(p.cantidad)].map((_, i) => String(i + 1)) : String(p.valores || '').split(/[\n,;]+/).map(v => v.trim()).filter(Boolean);
  if (!vals.length) vals = ['1']; const cols = Math.min(p.cols, vals.length), rows = Math.ceil(vals.length / cols), c = p.celda, m = 6;
  const f = font(p.fuente); const tH = p.titulo ? c * 1.6 : 0; const W = cols * c + 2 * m, H = rows * c + 2 * m + (tH ? tH + 4 : 0) + 6;
  const F = frame(W, H); const plate = F.rectC(0, 0, W, H, 4); const y0 = -H / 2 + m + 6 + (tH ? tH + 4 : 0); const x0 = -cols * c / 2;
  const holes = or(F.disk(-W / 2 + 6, -H / 2 + 6, 2), F.disk(W / 2 - 6, -H / 2 + 6, 2));
  const grid = F.draw(cx => { cx.lineWidth = 0.9; cx.strokeRect(x0, y0, cols * c, rows * c); cx.beginPath(); for (let i = 1; i < cols; i++) { cx.moveTo(x0 + i * c, y0); cx.lineTo(x0 + i * c, y0 + rows * c); } for (let j = 1; j < rows; j++) { cx.moveTo(x0, y0 + j * c); cx.lineTo(x0 + cols * c, y0 + j * c); } cx.stroke(); });
  const nums = F.draw(cx => { cx.textAlign = 'center'; cx.textBaseline = 'middle'; vals.forEach((v, i) => { const col = i % cols, row = i / cols | 0; let sz = c * 0.5; cx.font = `700 ${sz}px "Montserrat", sans-serif`; const wv = cx.measureText(v).width; if (wv > c * 0.8) { sz *= c * 0.8 / wv; cx.font = `700 ${sz}px "Montserrat", sans-serif`; } cx.fillText(v, x0 + (col + 0.5) * c, y0 + (row + 0.5) * c + sz * 0.05); }); });
  const layers = [L('Placa', sub(plate, holes), 0, 2, C.blanco), L('Cuadrícula', sub(or(grid, ring(F, plate, 1.4)), holes), 2, 2.8, C.marron), L('Valores', nums, 2, 2.5, C.marron)];
  if (tH) { const s = fitSize(lines(p.titulo, ''), f, W - 2 * m - 10, tH); layers.push(L('Título', F.text(lines(p.titulo, ''), f, s, 0, -H / 2 + m + 6 + tH / 2), 2, 3, C.marron)); }
  return { F, layers, note: 'Tapa cada casilla con pegatina o pintura de rascar; cuando ahorres esa cantidad, rasca.' };
}
/* trofeo */
function gTrofeo(p) {
  const W = p.ancho, Hf = p.alto; const f = font(p.fuente); const t = lines(p.texto, '100K'); const dt = tdim(t, f, W * 0.8); const ih = Hf - dt.h - 4; const ss = imgFit(p.img, W, ih);
  const baseW = W + 30, baseD = 34; const F = frame(baseW + 4, Hf + baseD + 30); const yTop = -(Hf + baseD + 22) / 2;
  const sil = fillHoles(F, close(F, F.image(p.img, 0, yTop + ss.h / 2, ss.w, ss.h, { thr: p.umbral }), 2)); const det = F.image(p.img, 0, yTop + ss.h / 2, ss.w, ss.h, { thr: p.umbral });
  const T = F.text(t, f, dt.s, 0, yTop + ih + 4 + dt.h / 2); const sb = bbox(F, sil); const bridge = sb ? F.rect(-Math.min(6, ss.w / 4), sb.y1 - Math.min(8, ss.h / 3), Math.min(6, ss.w / 4), yTop + ih + 4 + dt.h * 0.5, 1) : F.blank(); const bodyM = close(F, dilate(F, or(sil, T, bridge), 1.6), 3); const yb = yTop + Hf + 2; const tabW = Math.min(W * 0.5, 50);
  const fig = or(bodyM, F.rect(-tabW / 2, extreme(F, bodyM, 'bottom', -2, 2)[1] - 3, tabW / 2, yb + 7, 0.5));
  const y1 = yb + 12; const big = F.rectC(0, y1 + baseD / 2, baseW, baseD, 3), small = F.rectC(0, y1 + baseD / 2 - 3, baseW - 14, baseD - 12, 2); const slot = F.rectC(0, y1 + baseD / 2 - 7, tabW + 0.6, 4.4);
  const layers = [L('Figura', fig, 0, 4, C.oro), L('Figura: detalles', or(and(sub(det, ring(F, sil, 0.1)), erode(F, sil, 0.8)), T), 4, 5, C.negro), L('Peana', big, 0, 6, C.negro), L('Peana: escalón', sub(small, slot), 6, 14, C.negro)];
  if (p.subtitulo) { const s2 = fitSize([p.subtitulo], font('montserrat'), baseW - 24, 5); layers.push(L('Texto de la peana', and(F.text([p.subtitulo], font('montserrat'), s2, 0, y1 + baseD / 2 + 3), small), 14, 14.8, C.oro)); }
  return { F, layers, note: 'La figura se imprime tumbada y se encaja de pie en la ranura de la peana.' };
}
/* cuenco a partir de forma o imagen */
function gCuenco(p) {
  const S0 = p.tam, A = p.abertura; const F = frame(S0 + 2 * A + 6, S0 + 2 * A + 6, { maxPx: 520, res: 4 });
  let S; if (p.modo === 'imagen') { const ss = imgFit(p.img, S0, S0); S = fillHoles(F, close(F, F.image(p.img, 0, 0, ss.w, ss.h, { thr: p.umbral }), 3)); S = K.open(F, S, 1); } else S = F.shape(p.forma, 0, 0, S0, S0);
  const sd = K.signedDist(F, S); const slabs = []; const dz = 0.8;
  slabs.push(mm(F, K.level(sd, -1e9, 0), 0, p.suelo));
  for (let z = p.suelo; z < p.alto - 1e-6; z += dz) { const z1 = Math.min(p.alto, z + dz); const r = A * Math.pow((z1) / p.alto, 1.5); const rg = K.level(sd, r - p.pared, r); if (K.count(rg)) slabs.push(mm(F, rg, z, z1)); }
  const rim = K.level(sd, A - p.pared - 1, A + 0.6); slabs.push(mm(F, rim, p.alto, p.alto + 1.2));
  return { layers: [LM('Cuenco', K.mergeMeshes(slabs), C.celeste)], note: 'Imprime sin soportes; las paredes se abren poco a poco.' };
}
/* exhibidor de uñas */
function handPath(c, W, H, cy) {
  const pw = W * 0.62, ph = H * 0.42; const pb = cy + H / 2; c.beginPath(); K.roundRect(c, -pw / 2, pb - ph, pw, ph, pw * 0.22); c.fill();
  const fing = [[-0.36, 0.78, 0.17], [-0.12, 0.92, 0.18], [0.12, 0.88, 0.18], [0.34, 0.72, 0.16]]; const tips = [];
  for (const [fx, fl, fw] of fing) { const x = fx * W, L0 = fl * H * 0.62, w = fw * W; const yb = pb - ph + w * 0.6; c.beginPath(); K.roundRect(c, x - w / 2, yb - L0, w, L0 + 2, w / 2); c.fill(); tips.push([x, yb - L0 + w * 0.75, w]); }
  c.save(); c.translate(-pw / 2 + 2, pb - ph * 0.45); c.rotate(-0.85); const tw = 0.18 * W, tl = H * 0.36; c.beginPath(); K.roundRect(c, -tw / 2, -tl, tw, tl, tw / 2); c.fill(); c.restore();
  { const a = -0.85, ox = -pw / 2 + 2, oy = pb - ph * 0.45, L1 = tl - tw * 0.75; tips.push([ox + L1 * Math.sin(a), oy - L1 * Math.cos(a), tw]); }
  return tips;
}
function gExhibidor(p) {
  const W = p.ancho, H = p.alto; const tabW = Math.min(W * 0.4, 50); const F = frame(W + 10, H + (p.peana ? 34 : 8)); const cy = p.peana ? -13 : 0;
  let plate, pads = F.blank(); let textZone;
  if (p.forma === 'mano') { let tips = []; plate = F.draw(c => { tips = handPath(c, W, H, cy); }); tips.forEach(([x, y, w]) => { pads = or(pads, F.draw(c => { c.beginPath(); c.ellipse(x, y, w * 0.34, w * 0.5, 0, 0, Math.PI * 2); c.fill(); })); }); textZone = [0, cy + H / 2 - H * 0.2, W * 0.5, H * 0.18]; }
  else { plate = F.rectC(0, cy, W, H, 5); const n = p.cols, r = p.filas; const tH = H * 0.16; const cw = (W - 12) / n, ch = (H - 12 - tH) / r;
    for (let j = 0; j < r; j++) for (let i = 0; i < n; i++) { const x = -W / 2 + 6 + (i + 0.5) * cw, y = cy - H / 2 + 6 + tH + (j + 0.5) * ch; pads = or(pads, F.draw(c => { c.beginPath(); c.ellipse(x, y, Math.min(cw, ch * 0.7) * 0.32, Math.min(ch, cw * 1.4) * 0.38, 0, 0, Math.PI * 2); c.fill(); })); }
    textZone = [0, cy - H / 2 + 6 + tH / 2, W - 16, tH]; }
  let T = F.blank(); if (p.texto) { const f = font(p.fuente); const s = fitSize(lines(p.texto, ''), f, textZone[2], textZone[3]); T = and(F.text(lines(p.texto, ''), f, s, textZone[0], textZone[1]), erode(F, plate, 1.5)); }
  const layers = [L('Placa', plate, 0, 3, C.rosa), L('Apoyos para uñas', and(pads, erode(F, plate, 0.8)), 3, 4.2, C.blanco), L('Texto', T, 3, 4, C.blanco)];
  if (p.peana) { const yb = extreme(F, plate, 'bottom')[1]; const tab = tabMask(F, 0, yb - 1, tabW); layers[0].mask = or(layers[0].mask, tab); layers.push(...standParts(F, tabW, 3, 0, yb + 8)); }
  return { F, layers, note: 'Pega las uñas de muestra en los apoyos con masilla adhesiva.' };
}
/* caja de pañuelos estriada (para rollo de papel) */
function gPanuelos(p) {
  const Ri = p.dInt / 2, R = Ri + p.pared, dep = p.estria, n = p.estrias, tol = p.holgura; const Rl = R + dep;
  const body = K.newMesh(); K.tube((a, z) => R + dep * (0.5 + 0.5 * Math.cos(n * a)), () => Ri, 0, p.alto, n * 8, 2, -Rl - 5, 0, body); K.lathe([[0, 0], [Ri + 0.2, 0], [Ri + 0.2, 2], [0, 2]], -Rl - 5, 0, 128, body);
  const layers = [LM('Cuerpo estriado', body, C.lila)]; const rh = p.dHueco / 2;
  const F = frame(2 * Rl + 2, 2 * Rl + 2, { margin: 3 }); const D = sub(F.disk(0, 0, Rl), F.disk(0, 0, rh)); const cx = Rl + 5;
  if (p.nombre) { const f = font(p.fuente); const T0 = and(F.arcText(p.nombre, f, Math.min(9, (Rl - rh) * 0.35), 0, 0, rh + (Rl - rh) * 0.45, false), D); const T = mirrorTo(F, T0, 0, 0);
    layers.push(LM('Tapa: cara superior', mm(F, sub(D, T), 0, 0.6, cx), C.lila), LM('Nombre incrustado', mm(F, T, 0, 0.6, cx), C.blanco), LM('Tapa', mm(F, D, 0.6, 2.4, cx), C.lila)); }
  else layers.push(LM('Tapa', mm(F, D, 0, 2.4, cx), C.lila));
  const lip = K.newMesh(); K.lathe([[Ri - tol - 1.6, 2.4], [Ri - tol, 2.4], [Ri - tol, 10], [Ri - tol - 1.6, 10]], cx, 0, 128, lip); layers.push(LM('Tapa: encaje', lip, C.lila));
  return { layers, note: 'El rollo va dentro y el papel sale por el agujero de la tapa (quítale el cartón del centro).' };
}
/* carrete de filamento mini con NFC */
function gCarrete(p) {
  const R = p.diametro / 2, wd = p.ancho; const F = frame(2 * R + 16, 2 * R + 16); const Dk = F.disk(0, 0, R);
  const h = holeTab(F, Dk, 'arriba', 4.5); const fl = h.base; const pocket = F.disk(0, 0, p.dNfc / 2 + 0.3);
  const spokes = F.draw(c => { for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + Math.PI / 6; c.beginPath(); c.ellipse(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78, R * 0.1, R * 0.1, 0, 0, Math.PI * 2); c.fill(); } });
  const fl2 = p.dNfc / 2 + 0.3 < R * 0.62 ? sub(fl, spokes) : fl; const z1 = 2, z2 = z1 + wd;
  const fil = F.disk(0, 0, R - 2.2); const grooves = F.draw(c => { c.lineWidth = 0.35; for (let r = R * 0.45; r < R - 2.2; r += 1.0) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); } });
  const layers = [L('Brida inferior', fl2, 0, z1, C.negro), L('Filamento', fil, z1, z2, p.colorFil || C.rojo), L('Brida superior', fl2, z2, z2 + 0.8, C.negro), L('Brida (hueco NFC: pausa)', sub(fl2, pocket), z2 + 0.8, z2 + 0.8 + p.eNfc, C.negro), L('Brida (tapa)', fl2, z2 + 0.8 + p.eNfc, z2 + 2.2 + p.eNfc, C.negro)];
  if (p.nombre) { const f = font(p.fuente); const T = and(F.arcText(p.nombre, f, R * 0.22, 0, 0, R * 0.68, true), erode(F, fl2, 1)); layers.push(L('Nombre', T, z2 + 2.2 + p.eNfc, z2 + 2.8 + p.eNfc, C.blanco)); }
  return { F, layers, note: 'Pausa al empezar la capa "Brida (tapa)" para meter la etiqueta NFC.' };
}


/* ===================== ampliación: abrelatas, rattan, llavero de imagen, rosa con nombre… ===================== */
/* cabeza decorativa reutilizable: devuelve { base, capas:[{name,mask,dz,color}] } centrada en (0,cy) */
function cabeza(F, p, cy, size) {
  const f = font(p.fuente); const capas = []; let sil, agujero = null;
  switch (p.cabeza) {
    case 'imagen': { const s = imgFit(p.img, size, size); const I = F.image(p.img, 0, cy, s.w, s.h, { thr: p.umbral }); sil = fillHoles(F, close(F, I, 1.5));
      const Lu = F.lum(p.img, 0, cy, s.w, s.h); const dark = new Uint8Array(F.n); for (let i = 0; i < F.n; i++) if (sil[i] && Lu[i] >= 0 && Lu[i] < 0.35) dark[i] = 1;
      capas.push({ name: 'Imagen', mask: sil, dz: 1, color: p.color2 || C.rosa }); if (K.count(and(dark, erode(F, sil, 0.6)))) capas.push({ name: 'Detalles', mask: and(dilate(F, dark, 0.2), erode(F, sil, 0.6)), dz: 1.6, color: C.negro }); break; }
    case 'texto': { const t = lines(p.texto, '@tumarca'); const s = fitSize(t, f, size * 0.86, size * 0.42); const T = F.text(t, f, s, 0, cy); const bb = bbox(F, T);
      sil = F.rectC(0, cy, (bb ? bb.bw : size) + 8, Math.max(size * 0.42, (bb ? bb.bh : 10) + 7), 4); capas.push({ name: 'Figura', mask: sil, dz: 0.6, color: p.color2 || C.blanco }, { name: 'Texto', mask: T, dz: 1.2, color: p.color3 || C.rosa }); break; }
    case 'flor': { sil = F.shape('flor', 0, cy, size, size); capas.push({ name: 'Pétalos', mask: sub(sil, F.disk(0, cy, size * 0.2)), dz: 0.6, color: p.color2 || C.lila }, { name: 'Centro', mask: F.disk(0, cy, size * 0.18), dz: 1.2, color: C.oro });
      const pet = F.draw(c => { c.lineWidth = 0.7; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; c.beginPath(); c.moveTo(Math.cos(a) * size * 0.22, cy + Math.sin(a) * size * 0.22); c.lineTo(Math.cos(a) * size * 0.46, cy + Math.sin(a) * size * 0.46); c.stroke(); } });
      capas[0].mask = sub(capas[0].mask, pet); break; }
    case 'lazo_rosa': { const z = cinta(F, cy, size); sil = z.sil; agujero = z.agujero; capas.push({ name: 'Lazo', mask: z.lazo, dz: 0.8, color: p.color2 || C.rosa }); break; }
    case 'esmalte': { sil = F.shape('esmalte', 0, cy, size * 0.62, size); const ic = p.texto ? p.texto : '♥'; const s = fitSize([ic], f, size * 0.42, size * 0.32); capas.push({ name: 'Bote', mask: sub(sil, F.rect(-size, cy - size, size, cy - size * 0.08)), dz: 0.6, color: p.color2 || C.rosa }, { name: 'Tapón', mask: and(sil, F.rect(-size, cy - size, size, cy - size * 0.1)), dz: 0.6, color: C.negro }, { name: 'Icono', mask: and(F.text([ic], f, s, 0, cy + size * 0.2), erode(F, sil, 1.6)), dz: 1.2, color: C.blanco }); break; }
    default: { sil = F.shape(p.cabeza, 0, cy, size, size); capas.push({ name: 'Figura', mask: sil, dz: 0.8, color: p.color2 || C.rosa }); if (p.texto) { const t = lines(p.texto, ''); const fit = FIT[p.cabeza] || [.6, .45]; const s = fitSize(t, f, size * fit[0], size * fit[1]); capas.push({ name: 'Texto', mask: and(F.text(t, f, s, 0, cy + size * (fit[3] || 0)), erode(F, sil, 1.2)), dz: 1.4, color: C.blanco }); } }
  }
  return { sil, capas, agujero };
}
/* lazo solidario como cinta: bucle abierto, dos tiras cruzadas (la que baja hacia la derecha va por encima) y colas en uve.
   Centrado en (0,cy); size = alto total. Devuelve la silueta y el lazo con la línea de separación en el cruce. */
function cinta(F, cy, size) {
  const k = size / 116, bw = 21;   /* unidades de diseño: 116 de alto, cinta de 21 de ancho */
  const P = (x, y) => [x * k, cy + y * k];
  const tiraA = c => { c.moveTo(...P(-33, 54)); c.lineTo(...P(11, -4)); c.bezierCurveTo(...P(37, -30), ...P(31, -56), ...P(0, -56)); };
  const tiraB = c => { c.moveTo(...P(0, -56)); c.bezierCurveTo(...P(-31, -56), ...P(-37, -30), ...P(-11, -4)); c.lineTo(...P(33, 54)); };
  const trazo = (fn) => F.draw(c => { c.lineWidth = bw * k; c.lineCap = 'butt'; c.lineJoin = 'round'; c.beginPath(); fn(c); c.stroke(); });
  /* colas en uve: muesca triangular en cada extremo */
  const uve = F.draw(c => { for (const [ex, ey, fx, fy] of [[-33, 54, 11, -4], [33, 54, -11, -4]]) {
    const L = Math.hypot(ex - fx, ey - fy), dx = (ex - fx) / L, dy = (ey - fy) / L, nx = -dy, ny = dx, h = bw * 0.62;
    c.beginPath(); c.moveTo(...P(ex + nx * h + dx * 2, ey + ny * h + dy * 2)); c.lineTo(...P(ex - dx * 9, ey - dy * 9)); c.lineTo(...P(ex - nx * h + dx * 2, ey - ny * h + dy * 2)); c.closePath(); c.fill(); } });
  const A = sub(trazo(tiraA), uve), B = sub(trazo(tiraB), uve);
  /* la separación solo en el cruce: el tramo recto de la tira de encima */
  const recto = sub(trazo(c => { c.moveTo(...P(-11, -4)); c.lineTo(...P(33, 54)); }), uve);
  const lazo = or(sub(A, dilate(F, recto, 0.6)), B);
  /* sitio para la anilla: en mitad de la tira izquierda del bucle */
  return { sil: or(A, B), lazo, agujero: P(-26, -38) };
}
const anillaFuera = (F, base, bb, lado, mov) => holeTab(F, base, lado, 4, undefined, undefined, mov);
function gAbrelatas2(p) {
  const size = p.tam, aR = p.anchoR || 16, Wb = aR + 4.4, fondo = p.fondoR || 16, Lb = fondo + 6, ext = Math.max(6, fondo * 0.45);
  const F = frame(Math.max(size + 2 * p.borde, Wb) + 2 * ext + 20, size + Lb + 2 * p.borde + 20);
  /* rectángulo [x0,x1]×[y0,y1] en cualquier orden */
  const caja = (x0, y0, x1, y1, r) => F.draw(c => { c.beginPath(); K.roundRect(c, Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), r); c.fill(); });
  /* boca de la ranura M (en el borde) y dirección u hacia dentro.
     arriba / izquierda / derecha: escondida, entrando desde el borde de la figura (si cabe);
     abajo, o de lado cuando no cabe: en una lengüeta corta que sobresale ext mm */
  const plan = (pos) => {
    const cy = pos === 'abajo' ? -Lb / 2 - 2 : 0; const hd = cabeza(F, p, cy, size); const outline = K.fillHoles(F, close(F, dilate(F, hd.sil, p.borde), 2));
    if (pos === 'abajo') {
      const yB = extreme(F, outline, 'bottom')[1] + ext; const yT = Math.min(cy, yB - fondo - 3);
      return { pos, cy, hd, outline, M: [0, yB], u: [0, -1], base: close(F, or(outline, caja(-Wb / 2, yT, Wb / 2, yB, 2.5)), 1.5) };
    }
    const lado = pos === 'izq' ? -1 : 1;
    const M = pos === 'arriba' ? [0, extreme(F, outline, 'top')[1]] : [extreme(F, outline, pos === 'izq' ? 'left' : 'right', cy - Wb / 2, cy + Wb / 2)[0], cy];
    const u = pos === 'arriba' ? [0, 1] : [-lado, 0];
    /* paredes a los dos lados de la ranura (sin contar los 3 primeros mm de la boca): tienen que caer dentro de la figura */
    const d0 = 3, paredes = pos === 'arriba'
      ? sub(caja(-Wb / 2, M[1] + d0, Wb / 2, M[1] + fondo, 0), caja(-aR / 2, M[1], aR / 2, M[1] + fondo + 1, 0))
      : sub(caja(M[0] - lado * d0, cy - Wb / 2, M[0] - lado * fondo, cy + Wb / 2, 0), caja(M[0], cy - aR / 2, M[0] - lado * (fondo + 1), cy + aR / 2, 0));
    const fuera = K.count(sub(paredes, outline)) / Math.max(1, K.count(paredes));
    if (fuera <= 0.1) return { pos, cy, hd, outline, M, u, base: outline, escondida: true };
    if (pos === 'arriba') return null;
    const Mx = M[0] + lado * ext, xT = lado < 0 ? Math.max(0, Mx + fondo + 3) : Math.min(0, Mx - fondo - 3);
    return { pos, cy, hd, outline, M: [Mx, cy], u, base: close(F, or(outline, caja(xT, cy - Wb / 2, Mx, cy + Wb / 2, 2.5)), 1.5) };
  };
  let aviso = ''; let pl = plan(p.posR || 'abajo');
  if (!pl) { pl = plan('abajo'); aviso = ' Esta figura es estrecha por arriba y la ranura no cabe escondida detrás: se ha puesto abajo.'; }
  const { cy, hd, outline, M, u } = pl; let base = pl.base;
  const bb0 = bbox(F, outline);
  /* anilla: automática (arriba, o a la izquierda si la ranura va arriba; en el lazo, dentro de la cinta) o donde se elija */
  const lado = !p.anilla || p.anilla === 'auto' ? (pl.pos === 'arriba' ? 'izq' : 'arriba') : p.anilla;
  const h = lado === 'no' ? { base, clear: null }
    : (!p.anilla || p.anilla === 'auto') && pl.pos === 'arriba' && hd.agujero ? { base: sub(base, F.disk(hd.agujero[0], hd.agujero[1], 2)), clear: F.disk(hd.agujero[0], hd.agujero[1], 2.3) }
    : anillaFuera(F, base, bb0, lado, p.movAn || 0);
  base = h.base; const cl = m => h.clear ? sub(m, h.clear) : m;
  if (p.circR) base = sub(base, F.disk(M[0], M[1], aR * 0.28));
  /* ranura: desde 3 mm fuera de la boca hasta la profundidad pedida, hacia dentro */
  const A = [M[0] - u[0] * 3, M[1] - u[1] * 3], B = [M[0] + u[0] * fondo, M[1] + u[1] * fondo];
  const pocket = u[0] ? F.rect(A[0], M[1] - aR / 2, B[0], M[1] + aR / 2, 0.8) : F.rect(M[0] - aR / 2, A[1], M[0] + aR / 2, B[1], 0.8);
  const ab = abreCapas(F, base, pocket, p, p.color1 || C.blanco, p.nfc ? F.disk(0, cy, p.dNfc / 2 + 0.3) : null); const g = ab.T; const layers = ab.layers;
  const first = new Set(['Imagen', 'Pétalos', 'Bote', 'Figura', 'Tapón', 'Lazo']); const top = Math.max(...hd.capas.filter(cp => first.has(cp.name)).map(cp => cp.dz), 0);
  for (const cp of hd.capas) { const m = cl(and(cp.mask, erode(F, outline, 0.4))); if (!K.count(m)) continue; if (first.has(cp.name)) layers.push(L(cp.name, m, g, g + cp.dz, cp.color)); else layers.push(L(cp.name, m, g + top, g + top + cp.dz * 0.6, cp.color)); }
  return { F, layers, note: NOTA_ABRE + ab.nota + aviso };
}
/* rattan */
function rattanPiece(F, M, p) { const fr = ring(F, M, p.marco); const inner = erode(F, M, p.marco - 0.6); const rt = and(F.pattern('rattan', p.paso, 1, 1), inner); return { fr, rt }; }
function gRattan(p, o = {}) {
  const fl = font(p.fuente); const layers = [];
  if (o.v === 'panel') { const F = frame(p.ancho + 4, p.alto + 4); const M = F.rectC(0, 0, p.ancho, p.alto, 3); const r = rattanPiece(F, M, p); return { F, layers: [L('Marco', r.fr, 0, p.grosor, C.blanco), L('Rattan', r.rt, 0, p.grosorRattan, C.crema)] }; }
  if (o.v === 'letras') {
    const chars = [...String(p.texto || 'ELISA').replace(/\s/g, '')].slice(0, 12); const s = p.altura / measure(['M'], fl).h; const ws = chars.map(ch => measure([ch], fl).w * s + 4); const gap = 6; const W = ws.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    const F = frame(W, p.altura + 6); let x = -W / 2, fr = F.blank(), rt = F.blank(), holes = F.blank();
    chars.forEach((ch, i) => { const M = F.text([ch], fl, s, x + ws[i] / 2, 0); const r = rattanPiece(F, M, p); fr = or(fr, r.fr); rt = or(rt, r.rt); x += ws[i] + gap; });
    return { F, layers: [L('Marcos', fr, 0, p.grosor, C.rosa), L('Rattan', rt, 0, p.grosorRattan, C.crema)], note: 'Cada letra es una pieza. Para colgarlas usa cinta adhesiva de doble cara o masilla.' };
  }
  const ch = String(p.letra || 'E').trim().slice(0, 1) || 'E'; const s = p.altura / measure([ch], fl).h; const Wl = measure([ch], fl).w * s;
  const fn = font(p.fuenteNombre); const tn = lines(p.nombre, ''); const dn = p.nombre ? tdim(tn, fn, Wl * 1.3) : null;
  const F = frame(Math.max(Wl, dn ? dn.w : 0) + 14, p.altura + (o.v === 'base' ? 40 : 14)); const cy = o.v === 'base' ? -14 : 0;
  const M = F.text([ch], fl, s, 0, cy); const r = rattanPiece(F, M, p); let fr = r.fr;
  if (dn) { const Tn = F.text(tn, fn, dn.s, 0, cy + p.altura * 0.18, { bold: 0.4 }); const outl = close(F, dilate(F, Tn, 1.3), 1); layers.push(L('Nombre: contorno', outl, 0, p.grosor + 1, C.blanco), L('Nombre', Tn, p.grosor + 1, p.grosor + 2.2, C.rosa)); }
  if (o.v === 'pared') { for (const sx of [-1, 1]) { const e = extreme(F, M, 'top', sx * Wl * 0.3 - 3, sx * Wl * 0.3 + 3); const tab = sub(F.disk(e[0], e[1] + p.marco / 2, 3.2), F.disk(e[0], e[1] + p.marco / 2, 1.3)); fr = or(fr, tab); } }
  layers.unshift(L('Marco', fr, 0, p.grosor, C.verde), L('Rattan', r.rt, 0, p.grosorRattan, C.crema));
  if (o.v === 'base') { const yb = extreme(F, M, 'bottom')[1]; const tabW = Math.min(Wl * 0.6, 50); layers[0].mask = or(layers[0].mask, and(tabMask(F, 0, yb - 0.5, tabW), sub(F.rect(-Wl, yb - 1, Wl, yb + 7), F.blank()))); layers.push(...standParts(F, tabW, p.grosor, 0, yb + 9)); }
  return { F, layers, note: o.v === 'pared' ? 'Pasa un cordón por las dos anillas de arriba para colgarla.' : '' };
}
/* llavero a partir de una imagen */
function gLlaveroImagen(p) {
  const s = imgFit(p.img, p.tam, p.tam); const tH = p.texto ? p.tam * 0.28 : 0; const F = frame(p.tam + 2 * p.borde + 14, p.tam + tH + 2 * p.borde + 18);
  const cy = -tH / 2; const Lu = F.lum(p.img, 0, cy, s.w, s.h); const n = F.n; const sil = new Uint8Array(n), mid = new Uint8Array(n), dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const v = Lu[i]; if (v < 0) continue; if (v < 0.94) sil[i] = 1; if (v < 0.62) mid[i] = 1; if (v < 0.3) dark[i] = 1; }
  let S = fillHoles(F, close(F, sil, 1.2)); if (imgHasAlphaSafe(p.img)) S = fillHoles(F, close(F, F.image(p.img, 0, cy, s.w, s.h, { mode: 'alpha' }), 1.2));
  let T = F.blank(); if (p.texto) { const f = font(p.fuente); const t = lines(p.texto, ''); const sz = fitSize(t, f, p.tam * 1.1, tH); T = F.text(t, f, sz, 0, cy + s.h / 2 + tH / 2 + 1); }
  let base = close(F, dilate(F, or(S, T), p.borde), 2); const h = holeTab(F, base, p.agujero, p.dAg, undefined, undefined, p.movAg); base = h.base; const cl = m => h.clear ? sub(m, h.clear) : m;
  const layers = [];
  if (p.nfc) { const pocket = F.disk(0, cy, p.dNfc / 2 + 0.3); layers.push(L('Base', base, 0, 0.8, C.blanco), L('Base (hueco NFC: pausa)', sub(base, pocket), 0.8, 0.8 + p.eNfc, C.blanco), L('Base (cierre)', base, 0.8 + p.eNfc, 2.2 + p.eNfc, C.blanco)); }
  else layers.push(L('Base', base, 0, 2.4, C.blanco));
  const z = layers[layers.length - 1].z1;
  layers.push(L('Color 1', cl(sub(S, mid)), z, z + 0.8, p.c1 || C.rosa), L('Color 2', cl(and(sub(mid, dark), S)), z, z + 1.2, p.c2 || C.rojo), L('Color 3 (oscuro)', cl(and(dark, S)), z, z + 1.6, C.negro));
  if (p.texto) layers.push(L('Texto', cl(T), z, z + 1, C.negro));
  return { F, layers: layers.filter(Lr => K.count(Lr.mask)), note: (p.nfc ? 'Pausa al empezar "Base (cierre)" para meter la etiqueta NFC. ' : '') + 'Los colores salen de los tonos de la imagen (claros, medios y oscuros).' };
}
function imgHasAlphaSafe(img) { try { const c = K.canvas(48, 48); const x = c.getContext('2d'); x.drawImage(img, 0, 0, 48, 48); const d = x.getImageData(0, 0, 48, 48).data; let t = 0; for (let k = 3; k < d.length; k += 4) if (d[k] < 200) t++; return t > 48 * 48 * 0.02; } catch (e) { return false; } }
/* rosa de línea con nombre */
function rosaLinea(F, cx, cy, R, lw) {
  return F.draw(c => { c.lineWidth = lw; c.beginPath(); for (let a = 0; a < 4.6 * Math.PI; a += 0.08) { const r = R * 0.05 * a; c.lineTo(cx + Math.cos(a) * r * 0.95, cy - R * 0.12 + Math.sin(a) * r * 0.75); } c.stroke();
    c.beginPath(); c.arc(cx, cy - R * 0.05, R * 0.78, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); c.beginPath(); c.arc(cx - R * 0.25, cy - R * 0.2, R * 0.6, Math.PI * 0.9, Math.PI * 1.6); c.stroke(); c.beginPath(); c.arc(cx + R * 0.25, cy - R * 0.2, R * 0.6, Math.PI * 1.4, Math.PI * 2.1); c.stroke();
    c.beginPath(); c.arc(cx, cy, R, Math.PI * 0.05, Math.PI * 0.95); c.stroke(); c.beginPath(); c.arc(cx, cy - R * 0.15, R * 0.98, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    c.beginPath(); c.moveTo(cx - R, cy - R * 0.1); c.quadraticCurveTo(cx - R * 1.05, cy + R * 0.6, cx - R * 0.4, cy + R * 0.85); c.stroke(); c.beginPath(); c.moveTo(cx + R, cy - R * 0.1); c.quadraticCurveTo(cx + R * 1.05, cy + R * 0.6, cx + R * 0.4, cy + R * 0.85); c.stroke(); });
}
function gRosaNombre(p) {
  const f = font(p.fuente); const t = lines(p.texto, 'mamá'); const d = tdim(t, f, p.ancho); const R = Math.max(d.h * 0.85, 6); const F = frame(p.ancho + 2 * R + 30, Math.max(d.h, 2 * R) + 18);
  const x0 = -(p.ancho + 2 * R + 4) / 2 + R; const rose = rosaLinea(F, x0, 0, R, Math.max(1, R * 0.12)); const T = F.text(t, f, d.s, x0 + R + 3 + p.ancho / 2, 0, { bold: 0.3 });
  const tb = bbox(F, T); const tail = F.draw(c => { c.lineWidth = 1.3; c.beginPath(); c.moveTo(tb.x1 - 1.5, tb.y1 - d.h * 0.25); c.quadraticCurveTo(tb.x1 + 5, tb.y1 - d.h * 0.1, tb.x1 + 10, tb.y1 - d.h * 0.45); c.stroke(); });
  const all = or(rose, T, tail); let base = close(F, dilate(F, all, p.borde), 1.5); const h = holeTab(F, base, p.agujero, p.dAg, undefined, undefined, p.movAg); base = h.base;
  return { F, layers: [L('Base', base, 0, 2.4, C.blanco), L('Rosa y nombre', h.clear ? sub(all, h.clear) : all, 2.4, 3.4, C.rosa)] };
}
/* varios llaveros de una vez (uno por nombre) */
function gVarios(p, genOne) {
  const names = lines(p.nombres, 'Leo').slice(0, 9); const cols = Math.min(3, names.length); const layers = []; let gx = 0, gy = 0, rowH = 0, x = 0; const sp = 4; const pieces = [];
  for (const nm of names) { const r = genOne({ ...p, texto: nm }); pieces.push(r); }
  const W = pieces.map(r => r.F.W - 10); const H = pieces.map(r => r.F.H - 10); const colW = Math.max(...W) + sp, rowHh = Math.max(...H) + sp; const rows = Math.ceil(names.length / cols);
  pieces.forEach((r, i) => { const cx = ((i % cols) - (cols - 1) / 2) * colW, cy = -(((i / cols) | 0) - (rows - 1) / 2) * rowHh;
    for (const Lr of r.layers) { const m = K.maskToMesh(r.F, Lr.mask, Lr.z0, Lr.z1); K.fixOrientation(m); K.translateMesh(m, cx, cy); const ex = layers.find(q => q.name === Lr.name); if (ex) ex.mesh = K.mergeMeshes([ex.mesh, m]); else layers.push(LM(Lr.name, m, Lr.color)); } });
  return { layers };
}


/* sellos de plastilina con su caja */
function gSellosPlastilina(p) {
  const icons = String(p.iconos || '⭐').split(/[,\s]+/).filter(Boolean).slice(0, 12); const D = p.diametro, n = icons.length, cols = Math.min(4, n), rows = Math.ceil(n / cols), sp = D + 4;
  const showBox = p.caja; const boxW = cols * (D + 3) + 6, boxH = rows * (D + 3) + 6; const W = cols * sp + (showBox ? boxW + 10 : 0), H = Math.max(rows * sp, showBox ? boxH : 0);
  const F = frame(W, H); const x0 = -W / 2; let base = F.blank(), rel = F.blank(), rim = F.blank(); const fe = font('emoji'), ft = font(p.fuente);
  icons.forEach((ic, i) => { const x = x0 + (i % cols + 0.5) * sp, y = -rows * sp / 2 + ((i / cols | 0) + 0.5) * sp; const d = F.disk(x, y, D / 2); base = or(base, d); rim = or(rim, ring(F, d, 1.4));
    const isEmoji = /\p{Extended_Pictographic}/u.test(ic); const f = isEmoji ? fe : ft; const s = fitSize([ic], f, D * 0.62, D * 0.62); rel = or(rel, and(F.text([ic], f, s, x, y, { mirror: true }), erode(F, d, 2.4))); });
  const layers = [L('Sellos', base, 0, 3, C.blanco), L('Dibujo (espejo)', rel, 3, 3 + p.relieve, C.lila), L('Borde', rim, 3, 3 + p.relieve, C.lila)];
  if (showBox) { const bx = x0 + cols * sp + 10 + boxW / 2; const box = F.rectC(bx, 0, boxW, boxH, 4); let wells = F.blank(); for (let i = 0; i < cols * rows; i++) wells = or(wells, F.disk(bx - boxW / 2 + 3 + (i % cols + 0.5) * (D + 3), -boxH / 2 + 3 + ((i / cols | 0) + 0.5) * (D + 3), D / 2 + 0.5));
    layers.push(L('Caja: fondo', box, 0, 1.6, C.verde), L('Caja: huecos', sub(box, wells), 1.6, 1.6 + 3 + p.relieve + 1, C.verde)); }
  return { F, layers, note: 'Presiona cada sello sobre la plastilina; los dibujos salen al derecho. La caja guarda los sellos con el dibujo hacia arriba.' };
}
/* archivos de prueba */
function gTestTolerancia(p) {
  const cs = [0.1, 0.2, 0.3, 0.4, 0.5]; const d = p.diametro, sp = d + 8; const F = frame(cs.length * sp + 8, 2 * sp + 22); const f = font('montserrat');
  const plate = F.rectC(0, -sp / 2 - 4, cs.length * sp + 4, sp + 12, 3); let holes = F.blank(), labels = F.blank(), pins = F.blank();
  cs.forEach((c, i) => { const x = (i - (cs.length - 1) / 2) * sp; holes = or(holes, F.disk(x, -sp / 2 - 6, (d + c) / 2)); labels = or(labels, F.text([c.toFixed(1)], f, 3.6, x, -sp / 2 + 5));
    pins = or(pins, F.disk(x, sp / 2 + 4, d / 2)); });
  return { F, layers: [L('Placa con agujeros', sub(plate, holes, labels), 0, 5, C.gris), L('Placa: números', labels, 0, 4.4, C.gris), L('Pivotes', pins, 0, 12, C.naranja)], note: 'Mete el pivote en cada agujero: el primero en el que entra sin forzar es la holgura que debes usar (0,1 a 0,5 mm).' };
}
function gTestCubo(p) {
  const a = p.lado; const F = frame(a + 4, a + 4); const sq = F.rectC(0, 0, a, a, 0.4); const f = font('montserrat');
  const T = or(F.text(['XY'], f, a * 0.28, 0, 0), F.draw(c => { c.lineWidth = 1; c.beginPath(); c.moveTo(-a * 0.35, a * 0.35); c.lineTo(a * 0.35, a * 0.35); c.lineTo(a * 0.27, a * 0.29); c.moveTo(a * 0.35, a * 0.35); c.lineTo(a * 0.27, a * 0.41); c.moveTo(-a * 0.35, a * 0.35); c.lineTo(-a * 0.35, -a * 0.35); c.lineTo(-a * 0.41, -a * 0.27); c.moveTo(-a * 0.35, -a * 0.35); c.lineTo(-a * 0.29, -a * 0.27); c.stroke(); }));
  return { F, layers: [L('Cubo', sq, 0, a - 0.6, C.gris), L('Cara superior', sub(sq, T), a - 0.6, a, C.gris)], note: 'Mide el cubo con un calibre: debe dar ' + a + ' mm en X, Y y Z. Si no, ajusta los pasos (e-steps) o la escala.' };
}
function gTestPuentes(p) {
  const spans = [10, 20, 30, 40, 50]; const F = frame(spans.reduce((s, x) => s + x + 8, 0) + 8, 20); let x = -(spans.reduce((s, v) => s + v + 8, 0)) / 2; let pil = F.blank(), br = F.blank();
  for (const s of spans) { pil = or(pil, F.rectC(x + 3, 0, 6, 10), F.rectC(x + s + 5, 0, 6, 10)); br = or(br, F.rect(x, -5, x + s + 8, 5)); x += s + 8 + 4; }
  return { F, layers: [L('Base', br, 0, 1, C.gris), L('Pilares', pil, 1, 10, C.gris), L('Puentes', br, 10, 11.4, C.naranja)], note: 'Prueba de puentes de 10 a 50 mm: mira a partir de qué largo cuelga el filamento.' };
}
function gTestRosca(p) {
  const cs = [0.2, 0.3, 0.4]; const R = p.diametro / 2, d = 0.9, P = 2.5, L0 = 14, layers = []; const bolt = K.newMesh(), nut = K.newMesh(); const sp = 2 * R + 14;
  cs.forEach((c, i) => { const x = (i - 1) * sp; const fade = z => Math.max(0, Math.min(1, z / 1.2, (L0 + 4 - z) / 1.2));
    K.lathe([[0, 0], [R + 3, 0], [R + 3, 4], [0, 4]], x, -sp / 2, 64, bolt); K.tube((a, z) => R - d + d * K.threadProfile(a, z, P, d) * fade(z - 4), null, 4, 4 + L0, 96, Math.ceil(L0 / 0.12), x, -sp / 2, bolt);
    const Rh = R + 5; K.tube(a => { const k = ((a % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6; return Rh / Math.cos(k); }, (a, z) => R - d + c + d * K.threadProfile(a, z, P, d), 0, 8, 96, Math.ceil(8 / 0.12), x, sp / 2, nut); });
  layers.push(LM('Tornillos', bolt, C.gris), LM('Tuercas (holgura 0,2 · 0,3 · 0,4)', nut, C.naranja));
  return { layers, note: 'Tuercas de izquierda a derecha con holgura 0,2, 0,3 y 0,4 mm. Usa en botes y estuches la que enrosque suave.' };
}

/* ===================================================== CATÁLOGO ===================================================== */
const MODELS = {};
function M(id, name, desc, params, gen, extra = {}) { MODELS[id] = { id, name, desc, params, gen, ...extra }; }
const UMB = num('umbral', 'Umbral de imagen', 55, 5, 95, 1, { unit: '%' });
const NOMBRE_BASE = [txt('texto', 'Texto', 'Maria'), fnt(), num('ancho', 'Ancho del texto', 55, 25, 140), num('borde', 'Contorno', 2.5, 1, 6), num('hBase', 'Grosor base', 3, 1.5, 6), num('hTexto', 'Relieve del texto', 1.2, 0.4, 4, 0.2)];
const PLACA = (o = {}) => [
  ...(o.forma ? [] : [shp(o.def || 'circulo', o.formas || ['circulo', 'ovalo', 'ondulado', 'ovalo_ondulado', 'corazon', 'estrella', 'hexagono', 'cuadrado', 'capsula', 'hueso', 'pez', 'flor', 'nube'])]),
  num('ancho', 'Ancho', o.ancho || 45, 20, 120), ...(o.cuadrada ? [] : [num('alto', 'Alto', o.alto || 45, 15, 120)]),
  txt('texto', 'Texto', o.texto ?? 'Luna'), ...(o.linea2 !== false ? [txt('texto2', 'Segunda línea', o.texto2 ?? '')] : []), fnt('fuente', 'Fuente', o.fuente || 'fredoka'),
  ...(o.icono ? [txt('icono', 'Icono (emoji)', o.icono)] : []), num('borde', 'Borde en relieve', o.borde ?? 1.6, 0, 4, 0.2), num('hBase', 'Grosor base', 2.6, 1.2, 6, 0.2), num('hRel', 'Relieve', 1, 0.4, 3, 0.2),
  ...HOLE(o.agujero || 'arriba'), ...(o.glaseado ? [chk('glaseado', 'Línea de glaseado', true)] : []),
];
const CHAPA = (iman, o = {}) => [shp(o.forma || 'ondulado', ['circulo', 'ondulado', 'cuadrado', 'corazon', 'flor', 'hexagono', 'octogono', 'estrella', 'casa', 'arbol', 'bola', 'galleta']), sel('adorno', 'Adorno', o.adorno || 'no', { no: 'Sin adorno', lazo: 'Lazo navideño', acebo: 'Acebo' }),
  sel('dChapa', 'Ø de la chapa', 58, { 25: '25 mm', 32: '32 mm', 38: '38 mm', 44: '44 mm', 56: '56 mm', 58: '58 mm' }), num('holgura', 'Holgura', 0.3, 0, 1, 0.1), num('hChapa', 'Grosor de la chapa', 4.5, 2, 9, 0.5), num('pared', 'Pared', 2.4, 1.2, 6, 0.2), num('labio', 'Pestaña que sujeta', 1, 0.4, 2, 0.1), ...(iman ? [] : HOLE())];

// Llaveros
M('ll-nombre', 'Llavero de nombre', 'Nombre con contorno, en dos colores.', [...NOMBRE_BASE, ...HOLE('izq')], p => gNombre(p));
M('ll-3col', 'Llavero de nombre a 3 colores', 'Base, contorno intermedio y letras.', [...NOMBRE_BASE, num('borde2', 'Segundo contorno', 2, 0.8, 5), num('hMedio', 'Grosor contorno', 1, 0.4, 3, 0.2), ...HOLE('izq')], p => gNombre(p, { tres: true }));
M('ll-superpuesto', 'Llavero de nombres superpuestos', 'Dos palabras cruzadas con base común.', [txt('texto', 'Nombre', 'Elisa'), fnt(), txt('texto2', 'Segunda palabra', 'Borges'), fnt('fuente2', 'Fuente 2', 'luckiest'), num('escala2', 'Tamaño 2ª palabra', 0.75, 0.4, 1.2, 0.05, { unit: '×' }), num('ancho', 'Ancho', 55, 30, 140), num('borde', 'Contorno', 2.5, 1, 5), num('hBase', 'Grosor base', 3, 1.5, 6), num('hTexto', 'Relieve', 1.2, 0.4, 3, 0.2), ...HOLE('izq')], p => gSuperpuestos(p));
M('ll-icono', 'Llavero de nombre y logo', 'Nombre con una imagen o logo al lado.', [...NOMBRE_BASE, img('img', 'Logo / icono', 'logo'), UMB, ...HOLE('izq')], p => gNombre(p, { icono: true }));
M('ll-rect', 'Llavero rectangular con nombre', 'Placa con borde y nombre.', PLACA({ def: 'capsula', ancho: 55, alto: 22, texto: 'Elisa', linea2: false, borde: 1.2, agujero: 'izq', formas: ['capsula', 'rect', 'cuadrado', 'ovalo'] }), p => gPlaca(p, { c1: C.marron }));
M('ll-completo', 'Llavero con nombre completo', 'Nombre y apellidos en dos líneas.', PLACA({ def: 'rect', ancho: 60, alto: 28, texto: 'Aline', texto2: 'García López', borde: 1, agujero: 'izq', formas: ['rect', 'capsula', 'cuadrado'] }), p => gPlaca({ ...p, escala2: 0.5 }, { c1: C.rojo }));
M('ll-nfc-dibujo', 'Llavero NFC con dibujo', 'Hueco NFC escondido y tu dibujo o logo en relieve.', [...PLACA({ def: 'cuadrado', ancho: 42, cuadrada: true, texto: 'Hola', linea2: false, borde: 1.2 }), chk('conImagen', 'Con dibujo', true), img('img', 'Dibujo / logo', 'logo'), UMB, num('dNfc', 'Ø etiqueta NFC', 25, 15, 35), num('eNfc', 'Grosor hueco NFC', 1, 0.4, 2, 0.1)], p => gPlaca({ ...p, alto: p.ancho, nfc: true, escala2: 0.4 }, { c1: C.azul }), { note: 'Pausa la impresión al empezar la capa "Tapa" y mete la etiqueta.' });
M('ll-nfc', 'Llavero con hueco NFC', 'Placa con hueco interior para una etiqueta NFC.', [...PLACA({ def: 'cuadrado', ancho: 40, cuadrada: true, texto: '', linea2: false, icono: '📱', borde: 1.2 }), num('dNfc', 'Ø etiqueta NFC', 25, 15, 35), num('eNfc', 'Grosor hueco NFC', 1, 0.4, 2, 0.1)], p => gPlaca({ ...p, alto: p.ancho, nfc: true }, { c1: C.naranja }), { note: 'Pausa la impresión al empezar la capa "Tapa" y mete la etiqueta.' });
M('ll-conejo', 'Llavero conejo con nombre', 'Silueta de conejo con nombre.', PLACA({ forma: true, ancho: 40, alto: 52, texto: 'Leo', linea2: false, borde: 1.2, fuente: 'pacifico' }), p => gPlaca(p, { forma: 'conejo', c1: C.lila }));
M('ll-zanahoria', 'Llavero zanahoria con nombre', 'Zanahoria con el nombre en el cuerpo.', PLACA({ forma: true, ancho: 62, alto: 26, texto: 'Noah', linea2: false, borde: 0, agujero: 'izq', fuente: 'pacifico' }), p => gPlaca(p, { forma: 'zanahoria', c1: C.naranja }));
M('ll-espejo', 'Llavero con espejo y texto', 'Aro para un espejito redondo con texto alrededor.', [num('dEspejo', 'Ø del espejo', 50, 25, 80), num('banda', 'Ancho del aro', 9, 6, 14), num('hEspejo', 'Profundidad', 2.4, 1, 5, 0.2), txt('texto', 'Texto superior', 'MAFALDA'), txt('texto2', 'Texto inferior', 'BEST MOM'), fnt('fuente', 'Fuente', 'montserrat'), ...HOLE('der')], p => gEspejo(p));
M('ll-rosa', 'Llavero flor con texto', 'Medallón ondulado con flor y nombre en arco.', [num('diametro', 'Diámetro', 48, 30, 80), txt('texto', 'Texto', 'mejor mamá'), fnt('fuente', 'Fuente', 'fredoka'), ...HOLE()], p => gRosa(p));
M('ll-resina', 'Imagen con bordes altos (resina)', 'Contorno y líneas de la imagen en relieve para rellenar con resina.', [img('img', 'Imagen (línea)', 'dibujo'), UMB, num('ancho', 'Tamaño', 50, 25, 120), num('pared', 'Grosor de pared', 1.4, 0.8, 3, 0.2), num('hPared', 'Altura de pared', 2, 1, 5, 0.2), ...HOLE()], p => gResina(p));
M('ll-abrelatas', 'Abrelatas sencillo', 'Palanca con nombre, sin figura.', [txt('texto', 'Texto', 'Ana'), fnt('fuente', 'Fuente', 'luckiest'), num('largo', 'Largo', 70, 50, 100), num('anchoP', 'Ancho', 22, 16, 32), ...RANURA()], p => gAbrelatas(p));
M('chapa-llavero', 'Llavero para chapa', 'Marco a medida para una chapa (botón de alfiler).', CHAPA(false), p => gChapa(p));
M('chapa-iman', 'Imán de nevera para chapa', 'Marco con el fondo abierto: lo sujeta el imán de la chapa.', CHAPA(true), p => gChapa(p, { iman: true }));
M('chapa-nav-llavero', 'Llavero navideño para chapa', 'Marco con forma navideña y lazo o acebo.', CHAPA(false, { forma: 'bola', adorno: 'lazo' }), p => gChapa(p));
M('chapa-nav-iman', 'Imán navideño para chapa', 'Imán de nevera con adorno de Navidad.', CHAPA(true, { forma: 'cuadrado', adorno: 'acebo' }), p => gChapa(p, { iman: true }));
M('chapa-test', 'Test de tamaño de chapa', 'Aros de prueba para afinar la holgura.', [sel('dChapa', 'Ø de la chapa', 58, { 25: '25 mm', 32: '32 mm', 38: '38 mm', 44: '44 mm', 56: '56 mm', 58: '58 mm' }), num('hChapa', 'Altura', 3, 2, 8)], p => gChapa(p, { test: true }));
M('ll-estuche', 'Estuche de pintalabios con nombre', 'Tubo con rosca, textura y nombre grabado en el cuerpo y la tapa.', [num('dInt', 'Ø interior', 20, 10, 40), num('alto', 'Alto cuerpo', 70, 30, 120), num('tapa', 'Alto tapa', 30, 10, 60), num('pared', 'Pared', 1.6, 1, 3, 0.2), num('holgura', 'Holgura', 0.3, 0, 0.8, 0.05), chk('rosca', 'Cierre con rosca', true), num('paso', 'Paso de rosca', 2.5, 1.5, 4, 0.5, { show: p => p.rosca }), txt('nombre', 'Nombre en la tapa', 'Ana'), fnt('fuente', 'Fuente del nombre', 'fredoka'), sel('textura', 'Textura del cuerpo', 'no', { no: 'Lisa', rombos: 'Rombos', panal: 'Panal', floral: 'Floral', ondas: 'Ondas', verticales: 'Estrías', mosaico: 'Mosaico' }, { show: p => p.rosca }), txt('nombreCuerpo', 'Nombre en el cuerpo (vertical)', 'Ana', { show: p => p.rosca }), fnt('fuenteCuerpo', 'Fuente del cuerpo', 'pacifico', { show: p => p.rosca && p.nombreCuerpo })], p => gTubo(p));
M('ll-portapeine', 'Portapeine de pestañas', 'Tubo largo y fino con tapa de rosca.', [num('dInt', 'Ø interior', 12, 6, 25), num('alto', 'Alto cuerpo', 110, 50, 180), num('tapa', 'Alto tapa', 35, 10, 60), num('pared', 'Pared', 1.4, 1, 3, 0.2), num('holgura', 'Holgura', 0.3, 0, 0.8, 0.05), chk('rosca', 'Cierre con rosca', true), num('paso', 'Paso de rosca', 2.5, 1.5, 4, 0.5, { show: p => p.rosca }), txt('nombre', 'Nombre en la tapa', ''), fnt('fuente', 'Fuente del nombre', 'fredoka'), sel('textura', 'Textura del cuerpo', 'no', { no: 'Lisa', rombos: 'Rombos', panal: 'Panal', floral: 'Floral', ondas: 'Ondas', verticales: 'Estrías', mosaico: 'Mosaico' }, { show: p => p.rosca }), txt('nombreCuerpo', 'Nombre en el cuerpo (vertical)', '', { show: p => p.rosca }), fnt('fuenteCuerpo', 'Fuente del cuerpo', 'pacifico', { show: p => p.rosca && p.nombreCuerpo })], p => gTubo(p));
M('bote-peq', 'Bote pequeño con tapa', 'Contenedor redondo con tapa de rosca y nombre.', [num('dInt', 'Ø interior', 30, 10, 80), num('alto', 'Alto', 25, 10, 80), num('pared', 'Pared', 1.6, 1, 3, 0.2), num('holgura', 'Holgura', 0.3, 0, 0.8, 0.05), chk('rosca', 'Cierre con rosca', true), num('paso', 'Paso de rosca', 2.5, 1.5, 4, 0.5, { show: p => p.rosca }), txt('nombre', 'Nombre en la tapa', 'Ana'), fnt('fuente', 'Fuente del nombre', 'fredoka'), sel('textura', 'Textura del cuerpo', 'no', { no: 'Lisa', rombos: 'Rombos', panal: 'Panal', floral: 'Floral', ondas: 'Ondas', verticales: 'Estrías', mosaico: 'Mosaico' }, { show: p => p.rosca }), txt('nombreCuerpo', 'Nombre en el cuerpo (vertical)', '', { show: p => p.rosca }), fnt('fuenteCuerpo', 'Fuente del cuerpo', 'pacifico', { show: p => p.rosca && p.nombreCuerpo })], p => gTubo(p, { bote: true }));
M('bote-grande', 'Bote grande con tapa', 'Contenedor redondo grande con tapa de rosca y textura.', [num('dInt', 'Ø interior', 70, 30, 150), num('alto', 'Alto', 60, 20, 150), num('pared', 'Pared', 2, 1, 4, 0.2), num('holgura', 'Holgura', 0.3, 0, 0.8, 0.05), chk('rosca', 'Cierre con rosca', true), num('paso', 'Paso de rosca', 2.5, 1.5, 4, 0.5, { show: p => p.rosca }), txt('nombre', 'Nombre en la tapa', 'Galletas'), fnt('fuente', 'Fuente del nombre', 'fredoka'), sel('textura', 'Textura del cuerpo', 'no', { no: 'Lisa', rombos: 'Rombos', panal: 'Panal', floral: 'Floral', ondas: 'Ondas', verticales: 'Estrías', mosaico: 'Mosaico' }, { show: p => p.rosca }), txt('nombreCuerpo', 'Nombre en el cuerpo (vertical)', '', { show: p => p.rosca }), fnt('fuenteCuerpo', 'Fuente del cuerpo', 'pacifico', { show: p => p.rosca && p.nombreCuerpo })], p => gTubo(p, { bote: true }));
M('ll-familia', 'Colgante de nombres familiares', 'Una placa por nombre (corazones, huella…), unidas con anillas.', [area('nombres', 'Nombres (uno por línea)', 'Familia\nAline\nAlex\nElisa\nToby'), sel('forma', 'Forma de las placas', 'mixto', { mixto: 'Corazones y huella al final', corazon: 'Corazones', capsula: 'Cápsulas', ovalo: 'Óvalos', nube: 'Nubes' }), fnt('fuente', 'Fuente', 'pacifico'), num('alto', 'Alto de placa', 18, 10, 30), num('anchoMax', 'Ancho máximo', 70, 30, 140)], p => gFamilia(p));

// Cumpleaños
M('topper', 'Topper de tarta', 'Número, nombre e icono, con palitos.', [txt('numero', 'Número / texto grande', '3'), txt('nombre', 'Nombre', 'ELISA'), txt('icono', 'Icono (emoji)', '👑'), fnt('fuente', 'Fuente', 'luckiest'), num('ancho', 'Ancho del nombre', 110, 50, 200), num('contorno', 'Contorno', 3, 1, 6), num('grosor', 'Grosor', 2.6, 1.6, 5, 0.2), num('capa', 'Capa de texto (0 = una pieza)', 1, 0, 3, 0.2), sel('palitos', 'Palitos', 2, { 1: 'Uno', 2: 'Dos' }), num('largo', 'Largo palitos', 60, 30, 100)], p => gTopper(p));
M('topper-circ', 'Topper circular con ventana', 'Aro con hueco para purpurina, número y nombre.', [txt('numero', 'Número', '3'), txt('nombre', 'Nombre', 'ELISA'), fnt('fuente', 'Fuente', 'luckiest'), num('diametro', 'Diámetro', 100, 60, 180), num('largo', 'Largo palito', 55, 30, 100)], p => gTopperCirc(p));
M('palillos', 'Soporte para palillos', 'Base con tubo para sujetar figuras en palillo.', [shp('circulo', ['circulo', 'flor', 'estrella', 'corazon', 'hexagono']), num('diametro', 'Tamaño base', 55, 30, 100), sel('base', 'Base', 'fina', { fina: 'Fina', gruesa: 'Gruesa' }), num('dPalillo', 'Ø palillo', 4, 2, 8, 0.2), num('hTubo', 'Alto tubo', 22, 10, 50)], p => gPalillos(p));
M('soporte-foto', 'Soporte de foto con nombre', 'Base con ranura para una foto o tarjeta.', [txt('texto', 'Texto', 'ELISA'), fnt('fuente', 'Fuente', 'luckiest'), num('ancho', 'Ancho', 90, 50, 180), num('alto', 'Alto base', 9, 6, 16)], p => gSoporteFoto(p));
M('cuadro', 'Cuadro con marco y peana', 'Marco con foto o tela deslizable y peana.', [shp('arco', ['rect', 'arco', 'cuadrado']), num('fotoAncho', 'Ancho de foto', 70, 30, 150), num('fotoAlto', 'Alto de foto', 90, 30, 200), num('borde', 'Borde', 8, 4, 16), txt('texto', 'Texto inferior', 'Elisa'), fnt('fuente', 'Fuente', 'pacifico'), STAND()], p => gMarco(p));
M('cuadro-tela', 'Cuadro de tela', 'Marco en el que la tela o lámina entra por arriba y queda tensa.', [shp('rect', ['rect', 'arco', 'cuadrado']), num('fotoAncho', 'Ancho de la tela', 80, 30, 150), num('fotoAlto', 'Alto de la tela', 100, 30, 200), num('borde', 'Borde', 9, 4, 16), txt('texto', 'Texto inferior', 'Elisa'), fnt('fuente', 'Fuente', 'pacifico'), STAND()], p => gMarco(p), { note: 'Corta la tela 1 mm más pequeña que la medida y deslízala por la ranura superior; queda tensa entre la trasera y el frente.' });
M('tarta', 'Soporte de tarta', 'Plato con borde ondulado y pie estriado, encajables.', [num('diametro', 'Ø plato', 180, 80, 250), sel('borde', 'Borde del plato', 'ondulado', { ondulado: 'Ondulado', liso: 'Liso' }), num('dPie', 'Ø pie', 110, 50, 150), num('dColumna', 'Ø columna', 36, 16, 60), num('alto', 'Alto', 70, 20, 150), cnt('estrias', 'Estrías del pie (0 = liso)', 28, 0, 60), num('estria', 'Profundidad de estría', 4, 1, 8)], p => gTarta(p));
M('multicapa', 'Letrero multicapa desde imagen', 'Tres capas a partir de una imagen.', [img('img', 'Imagen', 'color'), UMB, num('ancho', 'Tamaño', 110, 40, 200), num('offset', 'Contorno exterior', 3, 1, 8)], p => gMulticapa(p));

// Recuerdito
M('placa-lineart', 'Placa de dibujo (line art)', 'Dibujo en relieve sobre placa con peana.', [img('img', 'Dibujo', 'dibujo'), UMB, shp('arco', ['rect', 'arco', 'circulo', 'cuadrado']), num('ancho', 'Ancho', 80, 40, 160), num('alto', 'Alto', 100, 40, 200), txt('texto', 'Texto', ''), fnt('fuente', 'Fuente', 'pacifico'), STAND()], p => gPlacaDibujo(p));
M('placa-rayas', 'Placa de rayas con peana', 'Fondo de rayas o textura y nombre.', [shp('arco', ['arco', 'rect', 'circulo', 'cuadrado']), num('ancho', 'Ancho', 70, 40, 160), num('alto', 'Alto', 90, 40, 200), pat('verticales'), num('sep', 'Separación', 3, 1.5, 10), num('grosorLinea', 'Grosor línea', 1, 0.6, 3, 0.1), txt('texto', 'Texto', 'Café'), fnt('fuente', 'Fuente', 'lobster'), STAND()], p => gPlacaDibujo(p, { rayas: true }));
M('caja', 'Caja con tapa', 'Caja rectangular con tapa encajable y nombre grabado.', [num('ancho', 'Ancho', 80, 30, 150), num('fondo', 'Fondo', 60, 30, 150), num('alto', 'Alto', 30, 10, 100), cnt('cols', 'Divisiones (columnas)', 1, 1, 6), cnt('filas', 'Divisiones (filas)', 1, 1, 6), txt('texto', 'Nombre en la tapa', 'Pegatinas'), fnt('fuente', 'Fuente', 'fredoka')], p => gCaja(p));
M('caja-sellos', 'Caja organizadora con divisiones', 'Caja con compartimentos (sellos, plastilina…).', [num('ancho', 'Ancho', 120, 30, 200), num('fondo', 'Fondo', 80, 30, 200), num('alto', 'Alto', 25, 10, 100), cnt('cols', 'Columnas', 3, 1, 8), cnt('filas', 'Filas', 2, 1, 8), txt('texto', 'Nombre en la tapa', 'Sellos'), fnt('fuente', 'Fuente', 'fredoka')], p => gCaja(p));
M('galleta', 'Adorno galleta', 'Figuras tipo galleta con glaseado y nombre.', PLACA({ def: 'galleta', ancho: 55, alto: 65, texto: 'Noa', linea2: false, borde: 0, glaseado: true, fuente: 'pacifico', formas: ['galleta', 'corazon', 'estrella', 'arbol', 'casa', 'bola', 'campana', 'lazo', 'circulo', 'nube'] }), p => gPlaca(p, { c1: C.marron }));
M('medallon', 'Medallón con nombre', 'Placa con forma, icono y texto.', PLACA({ def: 'corazon', ancho: 50, alto: 46, texto: 'Mamá', texto2: '2026', icono: '🌸' }), p => gPlaca(p, { c1: C.rosa }));
M('litofania', 'Litofanía', 'Foto que se ve al trasluz.', [img('img', 'Foto', 'foto'), num('ancho', 'Ancho', 100, 40, 180), num('eMin', 'Grosor mínimo', 0.8, 0.4, 2, 0.1), num('eMax', 'Grosor máximo', 3.2, 1.5, 6, 0.1), num('marco', 'Marco', 3, 0, 8), chk('invertir', 'Invertir', false)], p => gLitofania(p));

// String art
const STR = [txt('texto', 'Texto', 'Maria'), fnt('fuente', 'Fuente', 'pacifico'), num('ancho', 'Ancho', 130, 60, 220), num('grosor', 'Grosor', 4, 2, 8, 0.2), num('marco', 'Ancho del marco', 4, 2, 8), num('sep', 'Separación de hilos', 2.4, 1.5, 6, 0.1), num('hilo', 'Grosor de hilo', 0.6, 0.4, 1.2, 0.05), STAND()];
M('sa-corazon', 'String art: corazón', 'Corazón con hilos verticales y nombre.', STR, p => gString(p, { forma: 'corazon' }));
M('sa-rect', 'String art: rectángulo', 'Rectángulo con hilos en rayos.', [...STR, num('alto', 'Alto', 70, 30, 150)], p => gString(p, { forma: 'rect' }));
M('sa-social', 'String art: @usuario', 'Cápsula alargada con tu @.', [...STR.map(x => x.k === 'texto' ? { ...x, def: '@tumarca' } : x.k === 'ancho' ? { ...x, def: 170 } : x), num('alto', 'Alto', 40, 25, 100)], p => gString(p, { forma: 'capsula' }));

// Letra grande
const LETRA = (o = {}) => [txt('letra', 'Letra', o.letra || 'M'), fnt('fuenteLetra', 'Fuente de la letra', 'anton'), num('alto', 'Alto de la letra', 100, 40, 220), num('grosor', 'Grosor / profundidad', o.grosor || 20, 5, 60),
  ...(o.paredes ? [num('pared', 'Pared', 2, 1.2, 4, 0.2), num('suelo', 'Suelo', 1.6, 1, 4, 0.2)] : []), ...(o.patron ? [pat(o.patron), num('sep', 'Separación', 4, 2, 12), num('grosorLinea', 'Grosor línea', 1, 0.6, 3, 0.1)] : []),
  txt('nombre', 'Nombre', o.nombre ?? 'mom'), fnt('fuente', 'Fuente del nombre', 'pacifico'), ...(o.unible ? [chk('unido', 'Nombre unido a la letra (una sola pieza)', true)] : [])];
M('letra-nombre', 'Letra grande con nombre', 'Letra maciza con el nombre unido o aparte.', LETRA({ nombre: 'elisa', unible: true }), p => gLetra(p, { v: 'maciza' }));
M('letra-hundido', 'Letra grande con nombre incrustado', 'El nombre va incrustado a ras en otro color.', [...LETRA({ nombre: 'rafael' }), chk('vertical', 'Nombre en vertical', true)], p => gLetra(p, { v: 'hundido' }));
M('letra-resina', 'Letra grande con borde (resina / brillo)', 'Letra hueca con paredes para rellenar.', LETRA({ paredes: true, nombre: 'aline', grosor: 12, unible: true }), p => gLetra(p, { v: 'resina' }));
M('letra-textura', 'Letra grande con textura', 'Cara superior con relieve de patrón.', LETRA({ patron: 'zigzag', nombre: 'lara', unible: true }), p => gLetra(p, { v: 'textura' }));
M('letra-fondo', 'Letra grande con fondo texturizado', 'Letra hueca con relieve en el fondo.', LETRA({ paredes: true, patron: 'panal', nombre: 'mattia', grosor: 12, unible: true }), p => gLetra(p, { v: 'fondo' }));
M('letra-floral', 'Letra grande floral', 'Letra hueca con flores en el fondo.', LETRA({ paredes: true, patron: 'floral', nombre: 'mom', grosor: 12, unible: true }), p => gLetra(p, { v: 'fondo' }));
M('letra-lampara', 'Lámpara de letra grande', 'Letra hueca para tira LED, difusor y nombre.', LETRA({ paredes: true, nombre: 'elisa', grosor: 30 }), p => gLetra(p, { v: 'lampara' }), { note: 'Imprime el difusor en blanco o natural; la tira LED va pegada por dentro de las paredes.' });

// QR
const QRB = (o = {}) => [shp(o.forma || 'rect', ['rect', 'arco', 'cuadrado']), num('ancho', 'Ancho', 80, 50, 160), fnt('fuente', 'Fuente del título', 'montserrat'), ...(o.titulo !== false ? [txt('titulo', 'Título', o.titulo || 'Escanéame')] : []), txt('subtitulo', 'Texto inferior', o.sub ?? ''), STAND()];
M('qr-texto', 'Placa QR con texto', 'Enlace a lo que quieras, con título.', [txt('url', 'Enlace', 'https://mariaba.pages.dev'), ...QRB({ titulo: 'Mi portfolio', sub: 'mariaba.pages.dev' })], p => gQR(p, { v: 'texto' }));
M('qr-logo', 'Placa QR con logo', 'QR con tu logo encima.', [txt('url', 'Enlace', 'https://'), img('img', 'Logo', 'logo'), UMB, ...QRB({ titulo: 'Mi marca' })], p => gQR(p, { v: 'logo' }));
M('qr-wifi', 'Placa QR del Wi-Fi', 'Conectarse escaneando, sin teclear la clave.', [txt('ssid', 'Nombre de la red', 'MiCasa'), txt('clave', 'Contraseña', ''), sel('cifrado', 'Seguridad', 'WPA', { WPA: 'WPA/WPA2/WPA3', WEP: 'WEP', nopass: 'Abierta' }), ...QRB({ titulo: 'Wi-Fi', sub: 'Escanea para conectarte' })], p => gQR(p, { v: 'wifi' }));
M('qr-whatsapp', 'Placa QR de WhatsApp', 'Abre un chat contigo.', [txt('tel', 'Teléfono (con prefijo)', '34600000000'), txt('mensaje', 'Mensaje inicial', 'Hola!'), ...QRB({ titulo: 'WhatsApp', sub: 'Escríbenos' })], p => gQR(p, { v: 'whatsapp' }));
M('qr-resenas', 'Placa QR de reseñas', 'Enlace a tu ficha de reseñas, con estrellas.', [txt('url', 'Enlace de reseñas', 'https://'), ...QRB({ titulo: '¡Valóranos!', sub: 'Tu opinión nos ayuda' })], p => gQR(p, { v: 'resenas' }));
M('qr-redes', 'Placa QR de redes sociales', 'Instagram, TikTok, YouTube…', [sel('red', 'Red', 'instagram', { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', x: 'X' }), txt('usuario', 'Usuario', 'tumarca'), ...QRB({ titulo: false, sub: 'Síguenos' })], p => gQR(p, { v: 'redes' }));
M('qr-pago', 'Placa QR de enlace de pago', 'Para un enlace de pago o tienda.', [txt('url', 'Enlace de pago', 'https://'), ...QRB({ titulo: 'Paga aquí', sub: '' })], p => gQR(p, { v: 'texto' }));
M('qr-lista', 'Lista de códigos QR', 'Varios QR en una placa (vertical u horizontal).', [area('lista', 'Etiqueta | enlace (uno por línea, máx. 4)', 'Instagram | https://instagram.com/tumarca\nWeb | https://tumarca.com\nWhatsApp | https://wa.me/34600000000'), txt('titulo', 'Título', 'Encuéntranos'), fnt('fuente', 'Fuente', 'montserrat'), sel('orientacion', 'Orientación', 'horizontal', { horizontal: 'Horizontal', vertical: 'Vertical' }), shp('rect', ['rect', 'arco', 'cuadrado']), num('tamQR', 'Tamaño de cada QR', 40, 25, 80), num('offset', 'Capa de fondo (0 = sin)', 0, 0, 8), STAND()], p => gQRLista(p));
M('qr-lista-capas', 'Lista de QR en capas', 'Igual, con una capa de fondo de otro color.', [area('lista', 'Etiqueta | enlace (uno por línea, máx. 4)', 'Wi-Fi | WIFI:T:WPA;S:MiCasa;P:clave;;\nWhatsApp | https://wa.me/34600000000\nWeb | https://tumarca.com'), txt('titulo', 'Título', 'Hola'), fnt('fuente', 'Fuente', 'montserrat'), sel('orientacion', 'Orientación', 'vertical', { horizontal: 'Horizontal', vertical: 'Vertical' }), shp('arco', ['rect', 'arco', 'cuadrado']), num('tamQR', 'Tamaño de cada QR', 32, 25, 80), num('offset', 'Capa de fondo', 4, 0, 8), STAND()], p => gQRLista(p));

// Navidad
M('nav-portarretrato', 'Adorno portarretrato', 'Adorno con hueco redondo para foto y nombre.', [shp('bola', ['bola', 'estrella', 'corazon', 'arbol', 'circulo', 'campana']), num('ancho', 'Tamaño', 75, 45, 120), num('dFoto', 'Ø de la foto', 40, 20, 80), txt('texto', 'Texto', 'Navidad 2026'), fnt('fuente', 'Fuente', 'pacifico')], p => gPortarretrato(p));
M('nav-portafotos', 'Portafotos colgante', 'Marco con la foto deslizable y anilla.', [shp('rect', ['rect', 'arco', 'cuadrado']), num('fotoAncho', 'Ancho de foto', 60, 30, 150), num('fotoAlto', 'Alto de foto', 80, 30, 200), num('borde', 'Borde', 7, 4, 16), txt('texto', 'Texto inferior', 'Feliz Navidad'), fnt('fuente', 'Fuente', 'pacifico')], p => gMarco({ ...p, peana: false }, { colgar: true }));
M('nav-copo', 'Adorno copo de nieve con nombre', 'Aro con copo y nombre.', [txt('texto', 'Nombre', 'Aline'), fnt('fuente', 'Fuente', 'pacifico'), num('diametro', 'Diámetro', 75, 45, 120), cnt('semilla', 'Variante del copo', 3, 1, 50)], p => gCopo(p));
M('nav-galleta', 'Adornos de galleta navideños', 'Muñeco de jengibre, estrella, árbol, casita…', PLACA({ def: 'galleta', ancho: 55, alto: 65, texto: 'Noa', linea2: false, borde: 0, glaseado: true, fuente: 'pacifico', formas: ['galleta', 'estrella', 'arbol', 'casa', 'bola', 'campana', 'lazo', 'corazon', 'copo'] }), p => gPlaca(p, { c1: C.marron }));
M('nav-medallon', 'Bola de Navidad con nombre', 'Adorno plano con nombre y año.', PLACA({ def: 'bola', ancho: 60, alto: 66, texto: 'Noa', texto2: '2026', icono: '⭐', formas: ['bola', 'estrella', 'arbol', 'campana', 'casa', 'copo'] }), p => gPlaca(p, { c1: C.rojo }));

// Mascotas
const PET = (forma, ancho, alto, extra = {}) => [...PLACA({ forma: true, ancho, alto, texto: extra.texto || 'Luigi', texto2: '600 000 000', fuente: 'luckiest', borde: 1.2, ...extra }), num('escala2', 'Tamaño 2ª línea', 0.4, 0.25, 0.8, 0.05, { unit: '×' })];
M('pet-ovalada', 'Placa ovalada', 'Placa clásica con nombre y teléfono.', PET('ovalo', 42, 28), p => gPlaca(p, { forma: 'ovalo', c1: C.lila }));
M('pet-ondulada', 'Placa ovalada ondulada', 'Con el borde ondulado.', PET('ovalo_ondulado', 44, 30, { texto: 'Cacau' }), p => gPlaca(p, { forma: 'ovalo_ondulado', c1: C.lila }));
M('pet-hueso', 'Placa hueso', 'La de toda la vida para perros.', PET('hueso', 48, 26, { texto: 'Feijão', agujero: 'izq' }), p => gPlaca(p, { forma: 'hueso', c1: C.lila }));
M('pet-pez', 'Placa pez', 'Pensada para gatos.', [...PET('pez', 48, 30, { texto: 'Geleia', agujero: 'izq' })], p => gPlaca(p, { forma: 'pez', c1: C.lila }));
M('pet-huella', 'Placa huella', 'Huella con el nombre.', PET('huella', 40, 40, { texto: 'Toby' }), p => gPlaca(p, { forma: 'huella', c1: C.lila }));
M('pet-forma', 'Placa con cualquier forma', 'Usa tu propia silueta (PNG con fondo transparente o dibujo negro).', [img('img', 'Silueta', 'silueta'), UMB, ...PET('imagen', 45, 45, { texto: 'Luigi' })], p => gPlaca(p, { forma: 'imagen', c1: C.lila }));

// Lámparas
M('lamp-social', 'Lámpara LED @usuario', 'Panel con tu @ que se ilumina desde la peana.', [txt('texto', 'Texto', '@tumarca'), fnt('fuente', 'Fuente', 'righteous'), num('ancho', 'Ancho del texto', 160, 80, 240), num('grosor', 'Grosor del panel', 3, 2, 6, 0.2), num('fondoP', 'Fondo de la peana', 22, 16, 40), num('altoP', 'Alto de la peana', 18, 12, 30), sel('tira', 'Ancho tira LED', 8, { 5: '5 mm', 8: '8 mm (COB)', 10: '10 mm (COB)', 12: '12 mm' })], p => gLampTexto(p));

// Cortadores
M('cortador', 'Cortador de galletas', 'Desde forma, texto o imagen; con sello opcional.', [sel('modo', 'Contorno desde', 'forma', { forma: 'Forma', texto: 'Silueta del texto', imagen: 'Imagen' }), shp('conejo', ['circulo', 'corazon', 'estrella', 'conejo', 'flor', 'nube', 'galleta', 'arbol', 'casa', 'lazo', 'hueso', 'pez', 'huella', 'cuadrado', 'hexagono', 'gota'], 'forma', 'Forma'),
  txt('texto', 'Texto (sello / silueta)', 'Ana'), fnt('fuente', 'Fuente', 'fredoka'), img('img', 'Imagen', 'silueta', { show: p => p.modo === 'imagen' }), { ...UMB, show: p => p.modo === 'imagen' }, chk('marcas', 'Marcas interiores (imagen)', true, { show: p => p.modo === 'imagen' }),
  num('tam', 'Tamaño', 70, 30, 140), num('alto', 'Altura de corte', 14, 8, 25), num('pared', 'Grosor de cuchilla', 0.9, 0.6, 1.6, 0.1), num('pestana', 'Pestaña superior', 3, 1.5, 6), chk('sello', 'Incluir sello de marcado', true), num('relieve', 'Relieve del sello', 2.5, 1, 5, 0.5), sel('hueco', 'Hueco interior', 'no', { no: 'Sin hueco', corazon: 'Corazón', circulo: 'Círculo', estrella: 'Estrella', flor: 'Flor' }), num('tamHueco', 'Tamaño del hueco', 25, 10, 50, 1, { unit: '%', show: p => p.hueco !== 'no' }), num('posHueco', 'Posición vertical del hueco', 10, -40, 40, 1, { show: p => p.hueco !== 'no' })], p => gCortador(p));
M('cortador-hueco', 'Cortador con hueco interior', 'Galleta con un hueco (corazón, círculo…) recortado dentro.', [sel('modo', 'Contorno desde', 'forma', { forma: 'Forma', texto: 'Silueta del texto', imagen: 'Imagen' }), shp('conejo', ['circulo', 'corazon', 'estrella', 'conejo', 'flor', 'nube', 'galleta', 'arbol', 'casa', 'hueso', 'huella', 'cuadrado'], 'forma', 'Forma'), txt('texto', 'Texto', ''), fnt('fuente', 'Fuente', 'fredoka'), img('img', 'Imagen', 'silueta', { show: p => p.modo === 'imagen' }), { ...UMB, show: p => p.modo === 'imagen' }, chk('marcas', 'Marcas interiores', false), num('tam', 'Tamaño', 80, 30, 140), num('alto', 'Altura de corte', 14, 8, 25), num('pared', 'Cuchilla', 0.9, 0.6, 1.6, 0.1), num('pestana', 'Pestaña', 3, 1.5, 6), chk('sello', 'Sello', false), num('relieve', 'Relieve', 2.5, 1, 5, 0.5), sel('hueco', 'Hueco interior', 'corazon', { corazon: 'Corazón', circulo: 'Círculo', estrella: 'Estrella', flor: 'Flor' }), num('tamHueco', 'Tamaño del hueco', 22, 10, 50, 1, { unit: '%' }), num('posHueco', 'Posición vertical del hueco', 12, -40, 40, 1)], p => gCortador(p));
M('cort-grid', 'Cortador de rectángulos en cuadrícula', 'Corta muchas porciones iguales de una vez.', [cnt('cols', 'Columnas', 4, 1, 10), cnt('filas', 'Filas', 3, 1, 10), num('celdaX', 'Ancho de porción', 30, 10, 80), num('celdaY', 'Alto de porción', 30, 10, 80), num('alto', 'Altura', 18, 8, 30), num('pared', 'Cuchilla', 0.9, 0.6, 1.6, 0.1), num('pestana', 'Refuerzo exterior', 3, 1.5, 6)], p => gCortGrid(p));
const SELLO = (o = {}) => [sel('modo', 'Contenido', o.modo || 'imagen', { imagen: 'Imagen', texto: 'Texto' }), img('img', 'Imagen', 'logo', { show: p => p.modo === 'imagen' }), { ...UMB, show: p => p.modo === 'imagen' }, txt('texto', 'Texto', o.texto || 'Hecho a mano', { show: p => p.modo === 'texto' }), fnt('fuente', 'Fuente', 'pacifico', { show: p => p.modo === 'texto' }),
  ...(o.forma ? [shp(o.forma, ['circulo', 'rect', 'cuadrado', 'corazon', 'flor', 'nube'])] : []), num('diametro', o.forma ? 'Ancho' : 'Diámetro', o.d || 40, 15, 120), ...(o.forma ? [num('alto', 'Alto (rectángulo)', 30, 10, 120)] : []), num('relieve', 'Relieve', o.rel || 2, 0.6, 5, 0.2), chk('bordeSello', 'Borde', o.borde ?? true), chk('mango', 'Mango', o.mango ?? true)];
M('sello-circ', 'Sello circular de imagen', 'Logo o dibujo en espejo para estampar.', SELLO(), p => gSello(p));
M('sello-brig', 'Sello pequeño para dulces', 'Sello de 30 mm para brigadeiros y bombones.', SELLO({ d: 28, rel: 1.4 }), p => gSello(p));
M('sello-letras', 'Sellos de letras y números', 'Un sello por carácter.', [txt('texto', 'Letras / números', 'FELIZ 26'), fnt('fuente', 'Fuente', 'luckiest'), num('tam', 'Tamaño', 18, 10, 35), num('relieve', 'Relieve', 2.5, 1, 5, 0.5)], p => gSello(p, { letras: true }));
M('sello-molde-img', 'Sello de molde desde imagen', 'Para goma EVA, fondant o arcilla.', SELLO({ forma: 'rect', d: 70, rel: 3, mango: false, borde: false }), p => gSello(p));
M('sello-molde-txt', 'Sello de molde desde texto', 'Texto en espejo para marcar.', SELLO({ forma: 'rect', modo: 'texto', d: 80, texto: 'Massa EVA', rel: 3, mango: false, borde: false }), p => gSello(p));

// Letreros
const LET = (o = {}) => [txt('texto', 'Texto', o.texto || 'NOAH'), fnt('fuente', 'Fuente', o.fuente || 'luckiest'), num('ancho', 'Ancho', o.ancho || 150, 50, 240), num('contorno', 'Contorno', 3, 1, 8), ...(o.tres ? [num('contorno2', 'Segundo contorno', 3, 1, 8)] : []), num('alto', 'Altura de letras', o.alto || 6, 1, 20), chk('pie', 'Base plana (para dejarlo de pie)', true)];
M('let-2', 'Letrero de palabra (2 colores)', 'Base de contorno y letras en relieve.', LET(), p => gLetrero(p));
M('let-3', 'Letrero de palabra (3 colores)', 'Base, contorno y letras.', LET({ tres: true, texto: 'CECILIA' }), p => gLetrero(p, { tres: true }));
M('let-offset', 'Letrero con contorno lateral', 'Letras y contorno a la misma base, en dos alturas.', LET({ texto: 'NOAH', alto: 10 }), p => gLetrero(p, { offset: true }));
M('let-sep2', 'Letras separadas (2 colores)', 'Cada letra es una pieza.', [txt('texto', 'Texto', 'ELISA'), fnt('fuente', 'Fuente', 'anton'), num('altura', 'Alto de letra', 50, 20, 150), num('contorno', 'Contorno', 3, 1, 8), num('alto', 'Relieve', 5, 1, 15)], p => gSeparadas(p));
M('let-sep3', 'Letras separadas (3 colores)', 'Letras sueltas con doble contorno.', [txt('texto', 'Texto', 'ELISA'), fnt('fuente', 'Fuente', 'anton'), num('altura', 'Alto de letra', 50, 20, 150), num('contorno', 'Contorno', 2.5, 1, 8), num('contorno2', 'Segundo contorno', 2.5, 1, 8), num('alto', 'Relieve', 5, 1, 15)], p => gSeparadas(p, { tres: true }));
M('let-colocacion', 'Letras con plantilla de colocación', 'Letras sueltas y una plantilla para pegarlas rectas.', [txt('texto', 'Texto', 'fagra'), fnt('fuente', 'Fuente', 'montserrat'), num('altura', 'Alto de letra', 40, 20, 150), num('contorno', 'Contorno', 1.5, 0.5, 6), num('alto', 'Relieve', 4, 1, 15)], p => gSeparadas(p, { plantilla: true }));
M('let-corazon', 'Palabras en 2 líneas con corazón', 'Dos líneas y un corazón.', [txt('texto', 'Línea 1', 'Mamá'), fnt('fuente', 'Fuente 1', 'pacifico'), txt('texto2', 'Línea 2', 'te quiero'), fnt('fuente2', 'Fuente 2', 'pacifico'), num('ancho', 'Ancho', 140, 60, 240), num('contorno', 'Contorno', 3, 1, 8), num('alto', 'Relieve', 3, 1, 10)], p => gDosLineas(p, { corazon: true }));
M('let-2lin-img', 'Letrero 2 líneas con imagen', 'Dos líneas de texto y una imagen.', [txt('texto', 'Línea 1', 'Feliz'), fnt('fuente', 'Fuente 1', 'pacifico'), txt('texto2', 'Línea 2', 'PASCUA'), fnt('fuente2', 'Fuente 2', 'luckiest'), img('img', 'Imagen', 'silueta'), UMB, num('ancho', 'Ancho', 140, 60, 240), num('contorno', 'Contorno', 3, 1, 8), num('alto', 'Relieve', 3, 1, 10)], p => gDosLineas(p, { icono: true }));
M('let-2lin-img3', 'Letrero 2 líneas con imagen (3 colores)', 'Con doble contorno.', [txt('texto', 'Línea 1', 'Camila'), fnt('fuente', 'Fuente 1', 'pacifico'), txt('texto2', 'Línea 2', 'MACHADO'), fnt('fuente2', 'Fuente 2', 'bebas'), img('img', 'Imagen', 'logo'), UMB, num('ancho', 'Ancho', 140, 60, 240), num('contorno', 'Contorno', 2.5, 1, 8), num('contorno2', 'Segundo contorno', 2.5, 1, 8), num('alto', 'Relieve', 3, 1, 10)], p => gDosLineas(p, { icono: true, tres: true }));
M('let-superpuesto', 'Letrero de palabras superpuestas', 'Dos palabras cruzadas.', [txt('texto', 'Palabra 1', 'Pietra'), fnt('fuente', 'Fuente 1', 'luckiest'), txt('texto2', 'Palabra 2', 'manuela'), fnt('fuente2', 'Fuente 2', 'pacifico'), num('escala2', 'Tamaño 2ª palabra', 0.8, 0.4, 1.2, 0.05, { unit: '×' }), num('ancho', 'Ancho', 140, 60, 240), num('borde', 'Contorno', 3.5, 1, 8), num('hBase', 'Grosor base', 3, 2, 6), num('hTexto', 'Relieve', 2, 0.6, 8, 0.2)], p => gSuperpuestos(p, { sinAnilla: true }));
const SOC = [txt('usuario', 'Usuario', 'tumarca'), fnt('fuente', 'Fuente', 'righteous'), num('ancho', 'Ancho', 150, 60, 240), num('contorno', 'Contorno', 3, 1, 8), num('alto', 'Relieve', 3, 1, 10)];
M('soc-2', '@usuario (2 colores)', 'Tu @ con contorno.', SOC, p => gSocial(p));
M('soc-3', '@usuario (3 colores)', 'Tu @ con doble contorno.', SOC, p => gSocial(p, { tres: true }));
M('soc-rect2', '@usuario en placa (2 colores)', 'Tu @ sobre un rectángulo.', SOC, p => gSocial(p, { rect: true }));
M('soc-rect3', '@usuario en placa (3 colores)', 'Rectángulo con fondo.', SOC, p => gSocial(p, { rect: true, tres: true }));
M('soc-qr', '@usuario con código QR', 'Tu @ y el QR al perfil.', [sel('red', 'Red', 'instagram', { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', x: 'X' }), ...SOC], p => gSocial(p, { qr: true }));
M('placa-prof', 'Placa profesional', 'Logo, nombre y profesión, con base para estar de pie.', [txt('texto', 'Nombre', 'LUANA RUIZ'), fnt('fuente', 'Fuente', 'bebas'), txt('texto2', 'Profesión', 'ABOGADA'), chk('logo', 'Incluir logo', true), img('img', 'Logo', 'logo', { show: p => p.logo }), { ...UMB, show: p => p.logo }, num('ancho', 'Ancho del nombre', 150, 60, 240), num('alto', 'Relieve', 3, 1, 10)], p => gProfesional(p));

// Colorear
const COL = (o = {}) => [img('img', 'Dibujo (líneas negras)', 'dibujo'), UMB, num('ancho', 'Tamaño', 100, 40, 200), num('grosorLinea', 'Grosor de línea', 1.2, 0.6, 3, 0.1), ...(o.offset !== undefined ? [num('offset', 'Margen', o.offset, 2, 20)] : []), ...(o.forma ? [shp(o.forma, ['circulo', 'cuadrado', 'corazon', 'ovalo', 'hexagono', 'flor', 'nube'])] : [])];
M('col-relieve', 'Colorear con bordes en relieve', 'Las líneas del dibujo en relieve.', COL(), p => gColorear(p, { v: 'relieve' }));
M('col-hundida-forma', 'Colorear con imagen hundida (forma)', 'Dibujo grabado en una placa con forma.', COL({ forma: 'circulo', offset: 8 }), p => gColorear(p, { v: 'hundida-forma' }));
M('col-hundida-offset', 'Colorear con imagen hundida (contorno)', 'La placa sigue la silueta del dibujo.', COL({ offset: 6 }), p => gColorear(p, { v: 'hundida-offset' }));
M('col-2partes', 'Colorear en 2 partes', 'Marco y pieza que encaja.', COL(), p => gColorear(p, { v: '2partes' }));
M('puzzle', 'Rompecabezas', 'Puzle con encajes y dibujo opcional.', [num('ancho', 'Ancho', 120, 50, 220), num('alto', 'Alto', 90, 40, 220), cnt('cols', 'Columnas', 4, 2, 12), cnt('filas', 'Filas', 3, 2, 12), num('corte', 'Holgura de corte', 0.4, 0.2, 1, 0.05), cnt('semilla', 'Variante', 7, 1, 99), chk('dibujo', 'Dibujo en relieve', true), img('img', 'Dibujo', 'dibujo', { show: p => p.dibujo }), { ...UMB, show: p => p.dibujo }, chk('bandeja', 'Bandeja', true)], p => gPuzzle(p));
M('multipartes', 'Imagen multipartes', 'El dibujo se divide en piezas que encajan en una bandeja.', COL(), p => gMultipartes(p));

// Oficina
M('portalapices', 'Portalápices con nombre', 'Bote y nombre para pegar delante.', [txt('texto', 'Nombre', 'LAURA'), fnt('fuente', 'Fuente', 'luckiest'), shp('rect', ['rect', 'capsula', 'ovalo', 'hexagono']), num('ancho', 'Ancho', 90, 50, 160), num('fondo', 'Fondo', 55, 30, 100), num('alto', 'Alto', 90, 40, 140), num('pared', 'Pared', 1.8, 1.2, 4, 0.2), chk('corazones', 'Corazones decorativos', true)], p => gPortalapices(p));
const MP = [txt('texto', 'Nombre', 'Lucía'), fnt('fuente', 'Fuente', 'vibes'), num('ancho', 'Ancho', 40, 25, 60), num('largo', 'Largo', 150, 100, 200), num('sep', 'Tamaño del patrón', 8.5, 4, 20)];
M('mp-floral', 'Marcapáginas floral con nombre', 'Flores en relieve.', MP, p => gMarcapaginas(p, { estilo: 'floral' }));
M('mp-elegante', 'Marcapáginas elegante', 'Doble borde y nombre en caligrafía.', MP, p => gMarcapaginas(p, { estilo: 'elegante' }));
M('mp-geometrico', 'Marcapáginas geométrico', 'Rombos en relieve.', MP, p => gMarcapaginas(p, { estilo: 'geometrico' }));
M('mp-imagen', 'Marcapáginas con imagen', 'Tu dibujo arriba y el nombre.', [...MP, img('img', 'Imagen', 'silueta'), UMB], p => gMarcapaginas(p, { estilo: 'imagen' }));
M('mp-silueta', 'Marcapáginas con silueta (castillo)', 'La parte de arriba asoma del libro con la silueta que quieras.', [...MP, img('img', 'Silueta', 'castillo'), UMB], p => gMarcapaginas(p, { estilo: 'silueta' }));
M('tarjeta', 'Tarjeta de presentación', 'Tarjeta de 85 × 55 mm con QR opcional.', [txt('nombre', 'Nombre', 'Maria Bravo'), fnt('fuente', 'Fuente del nombre', 'montserrat'), txt('cargo', 'Cargo', 'Desarrolladora Full Stack'), area('datos', 'Datos de contacto', 'mariaba.pages.dev\ngithub.com/laloba04'), chk('qr', 'Incluir QR', true), txt('url', 'Enlace del QR', 'https://mariaba.pages.dev', { show: p => p.qr })], p => gTarjeta(p));
M('tarjeta-tela', 'Tarjeta de presentación con tela', 'Fondo con textura de tejido y texto en relieve.', [txt('nombre', 'Nombre', '@tumarca'), fnt('fuente', 'Fuente del nombre', 'righteous'), txt('cargo', 'Cargo / lema', 'Modelos 3D personalizados'), area('datos', 'Datos de contacto', 'tumarca.com'), chk('qr', 'Incluir QR', true), txt('url', 'Enlace del QR', 'https://', { show: p => p.qr }), sel('textura', 'Textura', 'cuadricula', { cuadricula: 'Lino', rombos: 'Rombos', diagonales: 'Sarga', panal: 'Panal' })], p => gTarjeta(p));
M('soporte-tarjetas', 'Soporte de tarjetas', 'Tarjetero de mesa con tu nombre.', [txt('texto', 'Texto', '@tumarca'), fnt('fuente', 'Fuente', 'righteous')], p => gSoporteTarjetas(p));
M('portaboli', 'Porta-bolígrafos de rejilla', 'Huecos cuadrados para rotuladores.', [cnt('cols', 'Columnas', 5, 1, 12), cnt('filas', 'Filas', 5, 1, 12), num('celda', 'Hueco', 15, 8, 40), num('alto', 'Alto', 80, 20, 150), num('pared', 'Pared', 1.6, 1, 4, 0.2), num('suelo', 'Suelo', 2, 1, 5, 0.2), sel('tipo', 'Tipo', 'rect', { rect: 'Cuadrado', hex: 'Panal' })], p => gOrganizador(p));
M('organizador-hex', 'Organizador de panal', 'Celdas hexagonales.', [cnt('cols', 'Columnas', 4, 1, 10), cnt('filas', 'Filas', 3, 1, 10), num('celda', 'Celda', 30, 12, 60), num('alto', 'Alto', 70, 20, 150), num('pared', 'Pared', 1.8, 1, 4, 0.2), num('suelo', 'Suelo', 2, 1, 5, 0.2), sel('tipo', 'Tipo', 'hex', { rect: 'Cuadrado', hex: 'Panal' })], p => gOrganizador(p));


const TERMO = (o = {}) => [{ ...shp(o.forma || 'corazon', ['corazon', 'circulo', 'cuadrado', 'ovalo', 'estrella', 'flor', 'lazo', 'nube', 'hexagono', 'bola', 'arbol', 'galleta', 'casa', 'campana']), show: p => !(p.diseno === 'imagen' && p.formaImg) }, sel('perfil', 'Perfil', o.perfil || 'cupula', { cupula: 'Cúpula acolchada', bandeja: 'Bandeja (cajita)' }), num('angulo', 'Inclinación de pared', 70, 45, 85, 1, { unit: '°', show: p => p.perfil === 'bandeja' }),
  num('tam', 'Tamaño', o.tam || 70, 30, 150), sel('diseno', 'Diseño', o.diseno || 'texto', { texto: 'Texto', imagen: 'Imagen', copo: 'Copo de nieve', patron: 'Patrón', ninguno: 'Liso' }),
  area('texto', 'Texto', o.texto ?? 'Feliz\nNavidad', { show: p => p.diseno === 'texto' }), fnt('fuente', 'Fuente', o.fuente || 'pacifico', { show: p => p.diseno === 'texto' }),
  img('imgD', 'Imagen del diseño', 'silueta', { show: p => p.diseno === 'imagen' }),
  num('tamDiseno', 'Tamaño del dibujo', 100, 50, 170, 5, { unit: '%', show: p => p.diseno !== 'ninguno' && p.diseno !== 'patron' && !(p.diseno === 'imagen' && p.formaImg) }),
  sel('colorImg', 'Imagen', 'color', { color: 'En color (detecta los colores)', byn: 'Blanco y negro (umbral)' }, { show: p => p.diseno === 'imagen' }),
  cnt('nColores', 'Número de colores', 4, 2, 8, { show: p => p.diseno === 'imagen' && p.colorImg !== 'byn' }),
  { ...UMB, show: p => p.diseno === 'imagen' && p.colorImg === 'byn' },
  chk('formaImg', 'La forma sigue la silueta de la imagen', true, { show: p => p.diseno === 'imagen' }), num('margenImg', 'Margen alrededor de la imagen', 3, 1, 15, 0.5, { show: p => p.diseno === 'imagen' && p.formaImg }),
  { ...pat('rombos', 'patron', 'Patrón'), show: p => p.diseno === 'patron' }, num('sep', 'Separación del patrón', 6, 3, 15, 0.5, { show: p => p.diseno === 'patron' }), cnt('semilla', 'Variante', 3, 1, 50, { show: p => p.diseno === 'copo' || p.diseno === 'patron' }),
  sel('estilo', 'Diseño en el molde', 'liso', { liso: 'Liso (sin dibujo, como el vídeo)', relieve: 'En relieve', hundido: 'Hundido' }),
  num('alto', 'Altura (profundidad de cada mitad)', o.alto || 12, 2, 40), num('redondeo', 'Redondeo del borde', 7, 1, 25, 0.5, { show: p => p.perfil !== 'bandeja' }), num('relieveD', 'Profundidad del diseño', 1.2, 0.4, 3, 0.1, { show: p => p.estilo !== 'liso' }),
  num('eva', 'Holgura entre moldes (grosor de la malla o lámina)', o.eva || 2, 0.5, 6, 0.1), num('base', 'Grosor de la base', 3, 2, 8, 0.5), sel('piezas', 'Piezas', 'ambas', { ambas: 'Macho + hembra', macho: 'Solo macho' }),
  sel('molde', 'Tipo de molde', 'plano', { plano: 'Bandeja + placa con la forma', bloque: 'Bloque cuadrado' }), chk('guias', 'Guías de centrado en las esquinas', true, { show: p => p.molde === 'bloque' }),
  chk('malla', 'Incluir la figura de malla para imprimir', o.malla ?? true), sel('rejilla', 'Agujeros de la malla', 'cuadricula', { cuadricula: 'Cuadrados', rombos: 'Rombos', panal: 'Hexágonos', mosaico: 'Mosaico' }, { show: p => p.malla }),
  num('paso', 'Tamaño de agujero', 3.2, 2, 8, 0.2, { show: p => p.malla }), num('hilo', 'Grosor del hilo', 0.9, 0.5, 2, 0.1, { show: p => p.malla }), num('bordeMalla', 'Borde macizo', 2.5, 1, 6, 0.5, { show: p => p.malla }),
  num('eMalla', 'Grosor de la malla', 0.8, 0.4, 2, 0.1, { show: p => p.malla }), num('pestana', 'Pestaña plana alrededor de la malla', 2, 0, 10, 0.5, { show: p => p.malla }), num('minDiseno', 'Grosor mínimo de las líneas del dibujo', 1.4, 0.8, 3, 0.1, { show: p => p.malla && p.diseno !== 'ninguno' }), sel('disenoMalla', 'Diseño en la malla', 'macizo', { macizo: 'Macizo (como bordado)', malla: 'Malla de otro color' }, { show: p => p.malla && p.diseno !== 'ninguno' }), chk('anilla', 'Pestaña para colgar', false, { show: p => p.malla }), num('movColgar', 'Mover la pestaña', 0, -100, 100, 5, { unit: '%', show: p => p.malla && p.anilla }), sel('trasera', 'Malla trasera', o.trasera || 'si', { si: 'Sí', no: 'Solo la delantera' }, { show: p => p.malla }),
  sel('cierre', 'Cierre', 'rosca', { rosca: 'Rosca arriba + clip abajo', remaches: 'Remaches a presión', pivotes: 'Pivotes pequeños', no: 'Ninguno' }, { show: p => p.malla && p.trasera !== 'no' }),
  num('holgRem', 'Ajuste del remache (más = más suelto)', 0.1, 0, 0.3, 0.02, { show: p => p.malla && p.trasera !== 'no' && p.cierre === 'remaches' }),
  num('holgRosca', 'Holgura de la rosca', 0.35, 0.15, 0.8, 0.05, { show: p => p.malla && p.trasera !== 'no' && p.cierre === 'rosca' })];
M('termo', 'Generador de termoformado', 'Cualquier forma, en cúpula acolchada o en bandeja, con texto, imagen o copo.', TERMO({ texto: 'Mamá', forma: 'corazon', eva: 1, anilla: true }), p => gTermo(p));
M('termo-nav', 'Molde de termoformado navideño', 'Bolsita de malla de dos caras con mensaje de Navidad, y sus moldes.', TERMO({ texto: 'Feliz\nNavidad', forma: 'corazon', eva: 1, anilla: true }), p => gTermo(p));
M('termo-copo', 'Molde de termoformado: copo', 'Bolsita de malla con un copo de nieve, y sus moldes.', TERMO({ forma: 'flor', diseno: 'copo', texto: '', eva: 1, anilla: true }), p => gTermo(p));


// Modelos curvos y especiales
const ROD = (o = {}) => [num('diametro', 'Diámetro', 30, 15, 60), num('largo', 'Largo', 100, 40, 200), sel('diseno', 'Diseño', o.diseno || 'patron', { patron: 'Patrón', texto: 'Texto', imagen: 'Imagen' }),
  { ...pat(o.patron || 'mosaico'), show: p => p.diseno === 'patron' }, num('sep', 'Tamaño del patrón', o.sep || 8, 3, 25, 0.5, { show: p => p.diseno === 'patron' }), num('grosorLinea', 'Grosor de línea', 1.2, 0.6, 3, 0.1, { show: p => p.diseno === 'patron' }), cnt('semilla', 'Variante', 4, 1, 99, { show: p => p.diseno === 'patron' }),
  txt('texto', 'Texto', 'Hecho a mano', { show: p => p.diseno === 'texto' }), fnt('fuente', 'Fuente', 'pacifico', { show: p => p.diseno === 'texto' }), img('img', 'Imagen', 'dibujo', { show: p => p.diseno === 'imagen' }), { ...UMB, show: p => p.diseno === 'imagen' },
  sel('cubrir', 'Cómo poner la imagen', 'una', { una: 'Una vez, en el centro', repetir: 'Repetida, cubriendo todo el rodillo', estirar: 'Estirada a todo el rodillo' }, { show: p => p.diseno === 'imagen' }),
  num('tamImg', 'Ancho de cada repetición', 30, 5, 80, 0.5, { show: p => p.diseno === 'imagen' && p.cubrir === 'repetir' }),
  sel('estilo', 'Relieve', 'relieve', { relieve: 'En relieve', hundido: 'Hundido' }), num('relieve', 'Profundidad', 1.2, 0.4, 3, 0.1), num('eje', 'Ø del eje', 8, 4, 14, 0.5), chk('guias', 'Guías de grosor en los extremos', true), num('masa', 'Grosor de la masa', 4, 1, 10, 0.5, { show: p => p.guias })];
M('rodillo', 'Rodillo de textura', 'Rodillo para marcar arcilla, fondant o masa con un patrón, texto o dibujo.', ROD(), p => gRodillo(p));
M('rodillo-mosaico', 'Rodillo de textura: mosaico', 'Mosaico irregular continuo.', ROD({ patron: 'mosaico', sep: 7 }), p => gRodillo(p));
const EY = (o = {}) => [shp(o.forma || 'flor', ['circulo', 'ovalo', 'cuadrado', 'corazon', 'flor', 'estrella', 'nube', 'hexagono', 'conejo', 'galleta', 'huella']), num('tam', 'Tamaño', o.tam || 32, 15, 80), num('redondeo', 'Redondeo de esquinas', o.redondeo ?? 0, 0, 8, 0.5),
  sel('cara', 'Cara del émbolo', o.cara || 'plana', { plana: 'Plana (sello)', cupula: 'Cóncava (cúpula)' }), num('hondo', 'Profundidad de la cúpula', 5, 1, 12, 0.5, { show: p => p.cara === 'cupula' }),
  sel('diseno', 'Marca en la pieza', o.diseno || 'texto', { texto: 'Texto', imagen: 'Imagen', ninguno: 'Sin marca' }), txt('texto', 'Texto', o.texto || 'M', { show: p => p.diseno === 'texto' }), fnt('fuente', 'Fuente', 'luckiest', { show: p => p.diseno === 'texto' }), img('img', 'Imagen', 'logo', { show: p => p.diseno === 'imagen' }), { ...UMB, show: p => p.diseno === 'imagen' },
  num('relieve', 'Relieve de la marca', 1, 0.4, 2.5, 0.1), num('alto', 'Altura del cortador', 16, 8, 30), num('pared', 'Pared', 1.2, 0.8, 2.4, 0.1), num('holgura', 'Holgura del émbolo', 0.35, 0.15, 0.8, 0.05)];
M('eyector', 'Cortador con eyector', 'Corta y expulsa la pieza marcada (brigadeiros, fondant, arcilla).', EY(), p => gEyector(p));
M('eyector-cupula', 'Eyector de cúpula redondeada', 'El émbolo es cóncavo: la pieza sale abombada.', EY({ forma: 'circulo', cara: 'cupula', diseno: 'ninguno', tam: 30 }), p => gEyector(p));
M('eyector-escala', 'Eyector redondeado a escala', 'Forma con las esquinas suavizadas al tamaño que quieras.', EY({ forma: 'estrella', redondeo: 3, tam: 40, diseno: 'ninguno' }), p => gEyector(p));
M('eyector-caramelo', 'Eyector de molde de caramelo', 'Forma redondeada y cara cóncava, para caramelo o chocolate.', EY({ forma: 'corazon', cara: 'cupula', redondeo: 2, diseno: 'texto', texto: '♥', tam: 34 }), p => gEyector(p));
M('rosa3d', 'Rosa 3D', 'Rosa de pétalos curvos con base para coletero.', [num('diametro', 'Diámetro', 45, 25, 90), num('alto', 'Altura', 22, 10, 45), cnt('capas', 'Capas de pétalos', 4, 2, 6), cnt('petalos', 'Pétalos en la capa interior', 3, 3, 6), num('apertura', 'Apertura exterior', 38, 10, 45, 1, { unit: '°' }), num('grosorP', 'Grosor de pétalo', 0.9, 0.6, 1.6, 0.1), sel('base', 'Base', 'coletero', { coletero: 'Con ranuras para coletero', plana: 'Plana (broche, imán)' })], p => gRosa3D(p), { note: 'Imprime de pie, sin soportes, con 2 perímetros.' });
M('micro', 'Mini micrófono', 'Micrófono de recuerdo con collarín de nombre.', [num('dCabeza', 'Ø cabeza', 30, 18, 50), num('largo', 'Largo del mango', 70, 40, 140), num('dMango', 'Ø mango (arriba)', 16, 10, 26), txt('nombre', 'Nombre', 'Ana'), fnt('fuente', 'Fuente', 'luckiest')], p => gMicro(p));
M('rascar', 'Contador de rascar', 'Reto de ahorro o de hábitos: rasca cada casilla al cumplirla.', [txt('titulo', 'Título', 'Reto de ahorro'), fnt('fuente', 'Fuente del título', 'luckiest'), sel('modo', 'Casillas', 'numeros', { numeros: 'Números consecutivos', valores: 'Mis valores' }), cnt('cantidad', 'Cantidad', 100, 4, 200, { show: p => p.modo === 'numeros' }), area('valores', 'Valores (separados por comas)', '5,10,20,5,50,10,20,5,10,100,20,5', { show: p => p.modo === 'valores' }), cnt('cols', 'Columnas', 10, 2, 20), num('celda', 'Casilla', 11, 7, 25)], p => gRascar(p));
M('trofeo', 'Trofeo de imagen y texto', 'Figura de tu imagen con un texto, sobre peana escalonada.', [img('img', 'Imagen', 'logo'), UMB, txt('texto', 'Texto', '100K'), fnt('fuente', 'Fuente', 'anton'), txt('subtitulo', 'Texto de la peana', '@tumarca'), num('ancho', 'Ancho', 70, 40, 150), num('alto', 'Alto de la figura', 100, 50, 200)], p => gTrofeo(p));
M('cuenco', 'Cuenco a partir de imagen', 'Cuenco con la silueta que quieras y paredes que se abren.', [sel('modo', 'Forma desde', 'imagen', { imagen: 'Imagen', forma: 'Forma' }), img('img', 'Silueta', 'silueta', { show: p => p.modo === 'imagen' }), { ...UMB, show: p => p.modo === 'imagen' }, shp('flor', ['circulo', 'corazon', 'flor', 'estrella', 'nube', 'hexagono', 'cuadrado'], 'forma', 'Forma'), num('tam', 'Tamaño de la base', 70, 30, 160), num('alto', 'Alto', 25, 8, 60), num('abertura', 'Apertura', 8, 0, 25), num('pared', 'Pared', 1.6, 1, 3, 0.2), num('suelo', 'Suelo', 2, 1, 4, 0.2)], p => gCuenco(p));
M('exhibidor', 'Exhibidor de uñas', 'Mano o paleta para mostrar uñas postizas, con peana.', [sel('forma', 'Formato', 'mano', { mano: 'Mano', rejilla: 'Paleta de muestras' }), num('ancho', 'Ancho', 90, 50, 180), num('alto', 'Alto', 120, 60, 220), cnt('cols', 'Columnas', 5, 2, 10, { show: p => p.forma === 'rejilla' }), cnt('filas', 'Filas', 4, 1, 8, { show: p => p.forma === 'rejilla' }), txt('texto', 'Texto', 'Nails by Ana'), fnt('fuente', 'Fuente', 'vibes'), STAND()], p => gExhibidor(p));
M('panuelos', 'Caja de pañuelos (rollo)', 'Bote estriado para un rollo de papel, con salida por la tapa.', [num('dInt', 'Ø interior', 115, 60, 160), num('alto', 'Alto', 110, 50, 160), cnt('estrias', 'Estrías', 40, 0, 90), num('estria', 'Profundidad de estría', 1.6, 0, 4, 0.2), num('pared', 'Pared', 2, 1.2, 4, 0.2), num('dHueco', 'Ø salida', 36, 20, 60), num('holgura', 'Holgura de tapa', 0.4, 0.1, 1, 0.05), txt('nombre', 'Nombre en la tapa', 'Baño'), fnt('fuente', 'Fuente', 'pacifico')], p => gPanuelos(p));
M('carrete-nfc', 'Llavero carrete de filamento con NFC', 'Mini bobina con hueco NFC y nombre.', [num('diametro', 'Diámetro', 40, 28, 60), num('ancho', 'Ancho del filamento', 9, 5, 16), txt('nombre', 'Nombre', 'mi taller'), fnt('fuente', 'Fuente', 'fredoka'), num('dNfc', 'Ø etiqueta NFC', 25, 15, 30), num('eNfc', 'Grosor hueco NFC', 1, 0.4, 2, 0.1)], p => gCarrete(p));


const BAND = (forma, tam, alto, extra = {}) => TERMO({ trasera: 'no', forma, tam, alto, perfil: 'bandeja', diseno: 'ninguno', texto: '', eva: 1, ...extra });
const BANDNOTE = 'Cajita de malla: imprime las mallas en plano, caliéntalas y presiónalas entre el macho y la hembra hasta que enfríen.';
for (const [id, nm, forma, tam, alto] of [['tb-corazon', 'Corazón termoformado', 'corazon', 80, 22], ['tb-cuadrado', 'Cuadrado liso termoformado', 'cuadrado', 75, 20], ['tb-estrella', 'Estrella termoformada', 'estrella', 85, 18], ['tb-flor', 'Flor termoformada', 'flor', 80, 18], ['tb-lazo', 'Lazo termoformado', 'lazo', 90, 14], ['tb-arbol', 'Árbol de Navidad termoformado', 'arbol', 70, 14]])
  M(id, nm, 'Figura de malla para imprimir y moldes macho y hembra para darle forma de cajita.', BAND(forma, tam, alto), p => gTermo(p), { note: BANDNOTE });


// Abrelatas con cabeza personalizable
const ABR = (o = {}) => [sel('cabeza', 'Diseño', o.cabeza || 'imagen', { imagen: 'Imagen', texto: 'Texto en placa', flor: 'Flor multicolor', esmalte: 'Bote de esmalte', lazo_rosa: 'Lazo solidario', corazon: 'Corazón', estrella: 'Estrella', circulo: 'Círculo' }),
  img('img', 'Imagen', o.demo || 'logo', { show: p => p.cabeza === 'imagen' }), { ...UMB, show: p => p.cabeza === 'imagen' }, txt('texto', 'Texto / icono', o.texto ?? '', { show: p => p.cabeza !== 'imagen' && p.cabeza !== 'flor' && p.cabeza !== 'lazo_rosa' }), fnt('fuente', 'Fuente', o.fuente || 'righteous', { show: p => p.cabeza !== 'imagen' && p.cabeza !== 'flor' && p.cabeza !== 'lazo_rosa' }),
  num('tam', 'Tamaño de la figura', o.tam || 34, 20, 60), num('borde', 'Borde', o.borde ?? 2, 0.6, 5, 0.2), chk('nfc', 'Hueco para NFC', !!o.nfc), num('dNfc', 'Ø etiqueta NFC', 20, 12, 30, 1, { show: p => p.nfc }), num('eNfc', 'Grosor hueco NFC', 1, 0.4, 2, 0.1, { show: p => p.nfc }), sel('anilla', 'Anilla', 'auto', { auto: 'Automática', arriba: 'Arriba', izq: 'A la izquierda', der: 'A la derecha', abajo: 'Abajo', no: 'Sin anilla' }), num('movAn', 'Mover anilla', 0, -100, 100, 5, { unit: '%', show: p => p.anilla !== 'no' }), sel('posR', 'Posición de la ranura', o.posR || 'abajo', { abajo: 'Abajo, en una lengüeta', arriba: 'Arriba, escondida detrás de la figura', izq: 'A la izquierda', der: 'A la derecha' }), ...RANURA()];
M('abre-gen', 'Generador de abrelatas', 'Llavero abrelatas con cualquier imagen, texto o figura.', ABR(), p => gAbrelatas2(p));
M('abre-lazo', 'Abrelatas lazo solidario', 'El lazo de octubre rosa.', ABR({ cabeza: 'lazo_rosa', tam: 52, posR: 'arriba' }), p => gAbrelatas2({ ...p, color2: C.rosa }));
M('abre-rect', 'Abrelatas rectángulo', 'Placa con tu @ o tu nombre.', ABR({ cabeza: 'texto', texto: '@tumarca', tam: 40 }), p => gAbrelatas2(p));
M('abre-flor', 'Abrelatas flor multicolor', 'Flor con pétalos y centro de colores.', ABR({ cabeza: 'flor', tam: 36 }), p => gAbrelatas2({ ...p, color2: C.lila }));
M('abre-borde', 'Abrelatas con borde', 'Texto sobre placa con borde de otro color.', ABR({ cabeza: 'texto', texto: '@tumarca', borde: 3, tam: 40 }), p => gAbrelatas2({ ...p, color1: C.rosa, color2: C.blanco, color3: C.rosa }));
M('abre-esmalte', 'Abrelatas esmalte', 'Bote de esmalte con un corazón o tu inicial.', ABR({ cabeza: 'esmalte', texto: '♥', fuente: 'luckiest', tam: 40 }), p => gAbrelatas2(p));
M('abre-nfc', 'Abrelatas NFC', 'Abrelatas con etiqueta NFC escondida.', ABR({ cabeza: 'texto', texto: 'NFC', fuente: 'luckiest', nfc: true, tam: 40 }), p => gAbrelatas2(p));
// Rattan
const RAT = (o = {}) => [num('paso', 'Tamaño de la rejilla', 4.2, 2.6, 8, 0.2), num('marco', 'Ancho del marco', 4, 2, 8, 0.5), num('grosor', 'Grosor del marco', 5, 2, 12, 0.5), num('grosorRattan', 'Grosor del rattan', 1.4, 0.8, 3, 0.1)];
M('rattan-letras', 'Letras de rattan', 'Un marco de rattan por letra.', [txt('texto', 'Texto', 'ELISA'), fnt('fuente', 'Fuente', 'anton'), num('altura', 'Alto de letra', 120, 50, 220), ...RAT()], p => gRattan(p, { v: 'letras' }));
M('rattan-base', 'Letra de rattan con base', 'Inicial de rattan con el nombre y peana.', [txt('letra', 'Letra', 'N'), fnt('fuente', 'Fuente de la letra', 'anton'), num('altura', 'Alto de letra', 110, 50, 200), txt('nombre', 'Nombre', 'Noah'), fnt('fuenteNombre', 'Fuente del nombre', 'pacifico'), ...RAT()], p => gRattan(p, { v: 'base' }));
M('rattan-pared', 'Letra de rattan para la pared', 'Inicial con nombre y anillas para colgar.', [txt('letra', 'Letra', 'E'), fnt('fuente', 'Fuente de la letra', 'anton'), num('altura', 'Alto de letra', 130, 50, 220), txt('nombre', 'Nombre', 'Elisa'), fnt('fuenteNombre', 'Fuente del nombre', 'pacifico'), ...RAT()], p => gRattan(p, { v: 'pared' }));
M('rattan-panel', 'Panel de rattan', 'Panel rectangular de rejilla, para puertas o cajas.', [num('ancho', 'Ancho', 150, 40, 240), num('alto', 'Alto', 110, 40, 240), ...RAT()], p => gRattan(p, { v: 'panel' }));
// Llavero desde imagen
const LLIMG = (nfc) => [img('img', 'Imagen', 'color'), num('tam', 'Tamaño', 42, 20, 80), txt('texto', 'Texto debajo (opcional)', ''), fnt('fuente', 'Fuente', 'luckiest'), num('borde', 'Borde', 2.2, 0.8, 5, 0.2), ...HOLE('arriba'), chk('nfc', 'Hueco para NFC', nfc), num('dNfc', 'Ø etiqueta NFC', 25, 12, 30, 1, { show: p => p.nfc }), num('eNfc', 'Grosor hueco NFC', 1, 0.4, 2, 0.1, { show: p => p.nfc })];
M('ll-imagen', 'Generador de llavero', 'Llavero a partir de cualquier imagen, en varios colores.', LLIMG(false), p => gLlaveroImagen(p));
M('ll-imagen-nfc', 'Generador de llavero NFC', 'Llavero de imagen con etiqueta NFC escondida.', LLIMG(true), p => gLlaveroImagen(p));
M('rosa-nombre', 'Rosa con nombre', 'Rosa de línea y nombre en caligrafía, de una pieza.', [txt('texto', 'Nombre', 'mamá'), fnt('fuente', 'Fuente', 'dancing'), num('ancho', 'Ancho del nombre', 55, 25, 140), num('borde', 'Contorno', 1.8, 0.8, 4, 0.2), ...HOLE('izq')], p => gRosaNombre(p));
M('ll-conejo-varios', 'Llaveros conejo (hasta 9 nombres)', 'Un conejo por nombre, todos en la misma bandeja.', [area('nombres', 'Nombres (uno por línea)', 'Elisa\nClara\nLeo\nMaju'), num('ancho', 'Ancho', 36, 25, 60), num('alto', 'Alto', 48, 30, 80), fnt('fuente', 'Fuente', 'pacifico'), num('borde', 'Borde', 1.2, 0, 3, 0.2), num('hBase', 'Grosor', 2.6, 1.2, 5, 0.2), num('hRel', 'Relieve', 1, 0.4, 3, 0.2), ...HOLE('arriba')], p => gVarios(p, q => gPlaca(q, { forma: 'conejo', c1: C.lila })));
M('ll-zanahoria-varios', 'Llaveros zanahoria (hasta 9 nombres)', 'Una zanahoria por nombre.', [area('nombres', 'Nombres (uno por línea)', 'Cecilia\nNoah\nElisa\nLaura'), num('ancho', 'Ancho', 62, 40, 90), num('alto', 'Alto', 26, 18, 40), fnt('fuente', 'Fuente', 'pacifico'), num('borde', 'Borde', 0, 0, 3, 0.2), num('hBase', 'Grosor', 2.6, 1.2, 5, 0.2), num('hRel', 'Relieve', 1, 0.4, 3, 0.2), ...HOLE('izq')], p => gVarios(p, q => gPlaca(q, { forma: 'zanahoria', c1: C.naranja })));


M('sellos-plastilina', 'Sellos para plastilina con caja', 'Sellos redondos con dibujos y una caja para guardarlos.', [txt('iconos', 'Dibujos (emojis o letras, separados por comas)', '⭐,🐱,🌸,🦋,🐶,❤'), fnt('fuente', 'Fuente (para letras)', 'luckiest'), num('diametro', 'Diámetro', 30, 18, 50), num('relieve', 'Relieve', 2, 1, 4, 0.2), chk('caja', 'Incluir caja', true)], p => gSellosPlastilina(p));
M('test-tolerancia', 'Test de tolerancia', 'Agujeros con holgura de 0,1 a 0,5 mm y sus pivotes.', [num('diametro', 'Ø del pivote', 10, 5, 20)], p => gTestTolerancia(p));
M('test-cubo', 'Cubo de calibración', 'Cubo para comprobar las medidas de la impresora.', [num('lado', 'Lado', 20, 10, 40)], p => gTestCubo(p));
M('test-puentes', 'Test de puentes', 'Puentes de 10 a 50 mm para ajustar la refrigeración.', [], p => gTestPuentes(p));
M('test-rosca', 'Test de rosca', 'Tornillo y tuerca con tres holguras distintas.', [num('diametro', 'Ø del tornillo', 16, 10, 30)], p => gTestRosca(p));

/* próximamente (necesitan geometría esculpida) */
const SOON = {};
for (const [id, name] of Object.entries(SOON)) MODELS['soon-' + id] = { id: 'soon-' + id, name, desc: 'Próximamente', soon: true, params: [] };

const CATEGORIES = [
  { id: 'llaveros', name: 'Llaveros', icon: '🔑', desc: 'Con nombre, logo, foto o NFC.', models: ['ll-imagen', 'll-imagen-nfc', 'abre-gen', 'abre-nfc', 'll-nombre', 'll-3col', 'll-superpuesto', 'll-icono', 'll-rect', 'll-completo', 'll-nfc', 'll-nfc-dibujo', 'carrete-nfc', 'll-conejo', 'll-conejo-varios', 'll-zanahoria', 'll-zanahoria-varios', 'rosa-nombre', 'll-espejo', 'll-rosa', 'll-resina', 'chapa-llavero', 'll-estuche', 'll-portapeine', 'bote-peq'] },
  { id: 'cumple', name: 'Cumpleaños', icon: '🎂', desc: 'Toppers, soportes y decoración de mesa.', models: ['topper', 'topper-circ', 'palillos', 'soporte-foto', 'cuadro', 'cuadro-tela', 'tarta', 'col-relieve', 'multicapa'] },
  { id: 'recuerdito', name: 'Recuerdos', icon: '🎁', desc: 'Detalles con nombre para fiestas, clientes y fechas especiales.', models: ['ll-espejo', 'placa-lineart', 'caja', 'cuadro', 'll-rosa', 'll-estuche', 'bote-grande', 'll-portapeine', 'medallon', 'chapa-iman', 'caja-sellos', 'sellos-plastilina', 'galleta', 'placa-rayas', 'chapa-test', 'll-familia', 'll-abrelatas', 'bote-peq', 'chapa-llavero', 'litofania', 'termo', 'rosa-nombre', 'abre-gen', 'micro', 'exhibidor', 'rosa3d', 'panuelos', 'cuadro-tela', 'carrete-nfc'] },
  { id: 'stringart', name: 'String Art', icon: '🧵', desc: 'Efecto de hilos tensados con tu nombre.', models: ['sa-corazon', 'sa-rect', 'sa-social'] },
  { id: 'letra', name: 'Letra grande', icon: '🔠', desc: 'Inicial decorativa con nombre, texturas, rattan o LED.', models: ['rattan-base', 'rattan-pared', 'letra-nombre', 'letra-hundido', 'letra-resina', 'letra-textura', 'letra-fondo', 'letra-floral', 'letra-lampara'] },
  { id: 'qr', name: 'Código QR', icon: '🔳', desc: 'Placas para Wi-Fi, WhatsApp, redes y reseñas.', models: ['qr-texto', 'qr-logo', 'qr-wifi', 'qr-whatsapp', 'qr-resenas', 'qr-redes', 'qr-pago', 'qr-lista', 'qr-lista-capas'] },
  { id: 'navidad', name: 'Navidad', icon: '🎄', desc: 'Adornos con nombre, foto o dibujo.', models: ['nav-portarretrato', 'nav-portafotos', 'nav-copo', 'nav-galleta', 'nav-medallon', 'chapa-nav-iman', 'chapa-nav-llavero', 'termo-nav', 'termo-copo'] },
  { id: 'abrelatas', name: 'Abrelatas', icon: '🥫', desc: 'Llaveros abrelatas con tu imagen, texto o NFC.', models: ['abre-gen', 'abre-lazo', 'abre-rect', 'abre-flor', 'abre-borde', 'abre-esmalte', 'abre-nfc', 'll-abrelatas'] },
  { id: 'rattan', name: 'Rattan', icon: '🪺', desc: 'Letras y paneles con rejilla de rattan.', models: ['rattan-letras', 'rattan-base', 'rattan-pared', 'rattan-panel'] },
  { id: 'pruebas', name: 'Archivos de prueba', icon: '📏', desc: 'Calibración, tolerancias y roscas para ajustar tu impresora.', hidden: true, models: ['test-tolerancia', 'test-cubo', 'test-puentes', 'test-rosca', 'chapa-test'] },
  { id: 'termoformado', name: 'Termoformado', icon: '🧺', desc: 'Figuras de malla impresas que se moldean en caliente, con sus moldes macho y hembra.', models: ['termo', 'tb-corazon', 'tb-cuadrado', 'tb-estrella', 'tb-flor', 'tb-lazo', 'tb-arbol', 'termo-nav', 'termo-copo'] },
  { id: 'mascotas', name: 'Mascotas', icon: '🐾', desc: 'Placas de identificación con nombre y teléfono.', models: ['pet-ovalada', 'pet-ondulada', 'pet-hueso', 'pet-pez', 'pet-huella', 'pet-forma'] },
  { id: 'lamparas', name: 'Lámparas', icon: '💡', desc: 'Lámparas LED con tu nombre o @.', models: ['letra-lampara', 'lamp-social'] },
  { id: 'cortadores', name: 'Cortadores', icon: '🍪', desc: 'Cortadores de galletas y sellos.', models: ['cortador', 'cortador-hueco', 'cort-grid', 'sellos-plastilina', 'sello-circ', 'sello-brig', 'sello-letras', 'eyector', 'eyector-cupula', 'eyector-escala', 'eyector-caramelo', 'rodillo', 'rodillo-mosaico', 'cuenco'] },
  { id: 'letreros', name: 'Letreros', icon: '🪧', desc: 'Palabras, nombres y @ en capas de 2 o 3 colores.', models: ['rattan-letras', 'let-2', 'let-3', 'let-offset', 'let-sep2', 'let-sep3', 'let-colocacion', 'let-corazon', 'let-2lin-img', 'let-2lin-img3', 'let-superpuesto', 'soc-2', 'soc-3', 'soc-rect2', 'soc-rect3', 'soc-qr', 'placa-prof', 'multicapa', 'cuadro', 'soporte-foto', 'trofeo'] },
  { id: 'chapas', name: 'Chapas', icon: '📍', desc: 'Llaveros e imanes para tus chapas.', models: ['chapa-llavero', 'chapa-iman', 'chapa-nav-llavero', 'chapa-nav-iman', 'chapa-test'] },
  { id: 'colorear', name: 'Colorear', icon: '🖍️', desc: 'Para pintar a partir de cualquier dibujo, y puzles.', models: ['col-relieve', 'col-hundida-forma', 'col-hundida-offset', 'col-2partes', 'puzzle', 'multipartes'] },
  { id: 'oficina', name: 'Oficina', icon: '✏️', desc: 'Portalápices, marcapáginas, tarjetas y placas.', models: ['portalapices', 'mp-floral', 'mp-elegante', 'mp-geometrico', 'mp-imagen', 'sello-molde-img', 'sello-molde-txt', 'cuadro', 'tarjeta', 'tarjeta-tela', 'soporte-tarjetas', 'portaboli', 'organizador-hex', 'placa-prof', 'rascar', 'panuelos', 'mp-silueta', 'cuadro-tela'] },
];
return { MODELS, CATEGORIES, C };
})();
