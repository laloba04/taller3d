/* GET /api/mejoras/adjunto/:id → foto o vídeo de un reporte (solo administradora) */
import { json, guard } from '../../../../lib/mejoras.js';

export async function onRequestGet({ request, env, params }) {
  const no = await guard(request, env); if (no) return no;
  const a = await env.DB.prepare('SELECT tipo, mime, r2_key, datos FROM adjuntos WHERE id = ?').bind(+params.id).first();
  if (!a) return json({ error: 'No existe.' }, 404);
  const headers = { 'content-type': a.mime || (a.tipo === 'video' ? 'video/mp4' : 'image/jpeg'), 'cache-control': 'private, max-age=3600' };
  if (a.r2_key) {
    if (!env.MEDIA) return json({ error: 'El almacenamiento de archivos no está enlazado.' }, 503);
    const o = await env.MEDIA.get(a.r2_key); if (!o) return json({ error: 'Archivo no encontrado.' }, 404);
    return new Response(o.body, { headers });
  }
  const d = a.datos; return new Response(d instanceof ArrayBuffer ? d : new Uint8Array(d), { headers });
}
