/* POST /api/mejoras  → enviar un reporte (público, con filtro anti-spam)
   GET  /api/mejoras  → listar reportes (solo administradora) */
import { LIM, ESTADOS, json, guard, ipHash, corta } from '../../../lib/mejoras.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'La base de datos no está enlazada.' }, 503);
  let fd; try { fd = await request.formData(); } catch (e) { return json({ error: 'Formulario no válido.' }, 400); }
  if (corta(fd.get('web'))) return json({ ok: true });                       /* campo trampa: los bots lo rellenan */
  const texto = corta(fd.get('texto'), LIM.texto);
  if (texto.length < 5) return json({ error: 'Cuéntanos un poco más qué pasa (mínimo 5 letras).' }, 400);
  const files = fd.getAll('archivos').filter(f => f && typeof f === 'object' && f.size > 0);
  if (files.length > LIM.archivos) return json({ error: `Como mucho ${LIM.archivos} archivos.` }, 400);
  for (const f of files) {
    const img = f.type.startsWith('image/'), vid = f.type.startsWith('video/');
    if (!img && !vid) return json({ error: `"${f.name}" no es una foto ni un vídeo.` }, 400);
    if (vid && !env.MEDIA) return json({ error: 'Los vídeos todavía no están activados. Manda fotos o descríbelo con texto.' }, 400);
    const max = vid ? LIM.video : env.MEDIA ? LIM.imgR2 : LIM.imgD1;
    if (f.size > max) return json({ error: `"${f.name}" es demasiado grande (máximo ${(max / 1e6).toLocaleString("es-ES")} MB).` }, 413);
  }
  const ih = await ipHash(request, env);
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM reportes WHERE ip_hash = ? AND creado > datetime('now', '-1 hour')").bind(ih).first();
  if (n >= LIM.porHora) return json({ error: 'Has enviado muchos reportes seguidos. Prueba dentro de un rato.' }, 429);

  const r = await env.DB.prepare('INSERT INTO reportes (modelo, nombre, contacto, texto, ip_hash) VALUES (?, ?, ?, ?, ?)')
    .bind(corta(fd.get('modelo')) || null, corta(fd.get('nombre')) || null, corta(fd.get('contacto')) || null, texto, ih).run();
  const id = r.meta.last_row_id;
  for (const f of files) {
    const tipo = f.type.startsWith('video/') ? 'video' : 'imagen';
    if (env.MEDIA) {
      const key = `r${id}/${crypto.randomUUID()}`;
      await env.MEDIA.put(key, f.stream(), { httpMetadata: { contentType: f.type } });
      await env.DB.prepare('INSERT INTO adjuntos (reporte_id, tipo, nombre, tam, r2_key, mime) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tipo, corta(f.name), f.size, key, f.type).run();
    } else {
      await env.DB.prepare('INSERT INTO adjuntos (reporte_id, tipo, nombre, tam, datos, mime) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tipo, corta(f.name), f.size, await f.arrayBuffer(), f.type).run();
    }
  }
  return json({ ok: true, id });
}

export async function onRequestGet({ request, env }) {
  const no = await guard(request, env); if (no) return no;
  const estado = new URL(request.url).searchParams.get('estado');
  const filtro = ESTADOS.includes(estado) ? 'WHERE estado = ?' : '', args = filtro ? [estado] : [];
  const sel = `SELECT id FROM reportes ${filtro} ORDER BY id DESC LIMIT 300`;
  const { results: reportes } = await env.DB.prepare(`SELECT id, creado, modelo, nombre, contacto, texto, estado, nota FROM reportes WHERE id IN (${sel}) ORDER BY id DESC`).bind(...args).all();
  const { results: adj } = await env.DB.prepare(`SELECT id, reporte_id, tipo, nombre, tam, mime FROM adjuntos WHERE reporte_id IN (${sel}) ORDER BY id`).bind(...args).all();
  const por = {}; for (const a of adj) (por[a.reporte_id] = por[a.reporte_id] || []).push(a);
  const { results: cuenta } = await env.DB.prepare('SELECT estado, COUNT(*) AS n FROM reportes GROUP BY estado').all();
  return json({ reportes: reportes.map(r => ({ ...r, adjuntos: por[r.id] || [] })), cuenta: Object.fromEntries(cuenta.map(c => [c.estado, c.n])) });
}
