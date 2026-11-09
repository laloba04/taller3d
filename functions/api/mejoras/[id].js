/* PATCH  /api/mejoras/:id → cambiar estado o nota (solo administradora)
   DELETE /api/mejoras/:id → borrar el reporte y sus archivos */
import { ESTADOS, LIM, json, guard, corta } from '../../../lib/mejoras.js';

export async function onRequestPatch({ request, env, params }) {
  const no = await guard(request, env); if (no) return no;
  const id = +params.id; if (!id) return json({ error: 'Reporte no válido.' }, 400);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Datos no válidos.' }, 400); }
  if (b.estado !== undefined && !ESTADOS.includes(b.estado)) return json({ error: 'Estado no válido.' }, 400);
  await env.DB.prepare('UPDATE reportes SET estado = COALESCE(?, estado), nota = COALESCE(?, nota) WHERE id = ?')
    .bind(b.estado ?? null, b.nota !== undefined ? corta(b.nota, LIM.texto) : null, id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env, params }) {
  const no = await guard(request, env); if (no) return no;
  const id = +params.id; if (!id) return json({ error: 'Reporte no válido.' }, 400);
  const { results } = await env.DB.prepare('SELECT r2_key FROM adjuntos WHERE reporte_id = ? AND r2_key IS NOT NULL').bind(id).all();
  if (env.MEDIA && results.length) await env.MEDIA.delete(results.map(r => r.r2_key));
  await env.DB.batch([env.DB.prepare('DELETE FROM adjuntos WHERE reporte_id = ?').bind(id), env.DB.prepare('DELETE FROM reportes WHERE id = ?').bind(id)]);
  return json({ ok: true });
}
