/* Taller 3D — utilidades del apartado "Cosas a mejorar" (Pages Functions) */

export const LIM = {
  texto: 4000,          // caracteres de la descripción
  campo: 200,           // nombre, contacto, modelo
  archivos: 5,          // adjuntos por reporte
  imgD1: 1.5e6,         // foto guardada en la base de datos (sin R2)
  imgR2: 15e6,          // foto guardada en R2
  video: 60e6,          // vídeo (solo con R2)
  porHora: 5,           // reportes por IP y hora
};
/* Tipos de archivo admitidos. Lista cerrada: "image/*" dejaría pasar SVG, que puede llevar
   JavaScript y ejecutarse en la web al abrirlo desde el panel. */
export const TIPOS = {
  'image/jpeg': 'imagen', 'image/png': 'imagen', 'image/webp': 'imagen', 'image/gif': 'imagen',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
};
export const ESTADOS = ['pendiente', 'en_curso', 'arreglado', 'descartado'];

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const sha = async (txt) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)));

/* null si es la administradora; si no, la respuesta de error que hay que devolver */
export async function guard(request, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'Falta configurar ADMIN_PASSWORD en Cloudflare Pages.' }, 503);
  const h = request.headers.get('authorization') || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [a, b] = await Promise.all([sha(t), sha(env.ADMIN_PASSWORD)]);
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];   /* comparación de tiempo constante */
  return d === 0 ? null : json({ error: 'Contraseña incorrecta.' }, 401);
}

/* huella de la IP (no se guarda la IP), para limitar envíos */
export async function ipHash(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const h = await sha(ip + '|' + (env.IP_SALT || 'taller3d-mejoras'));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const corta = (v, n = LIM.campo) => String(v ?? '').trim().slice(0, n);

/* ---------- avisos por Telegram ----------
   Secreto TELEGRAM_TOKEN (del bot de @BotFather). El chat se guarda en la tabla ajustes al pulsar "Conectar Telegram" en el panel. */
export async function tgChat(env) {
  const r = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'telegram_chat'").first();
  return r ? JSON.parse(r.valor) : null;          /* { id, nombre } */
}
export async function tg(env, metodo, body) {
  const fd = body instanceof FormData;
  const r = await fetch(`${env.TELEGRAM_API || 'https://api.telegram.org'}/bot${env.TELEGRAM_TOKEN}/${metodo}`, { method: 'POST', body: fd ? body : JSON.stringify(body), headers: fd ? undefined : { 'content-type': 'application/json' } });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) throw new Error(j.description || 'Telegram respondió ' + r.status);
  return j.result;
}
/* manda el reporte (texto + fotos/vídeos) al chat conectado; no falla nunca hacia fuera */
export async function avisar(env, rep, files, panelUrl) {
  try {
    if (!env.TELEGRAM_TOKEN) return; const chat = await tgChat(env); if (!chat) return;
    const lineas = [`🛠️ Nuevo reporte #${rep.id}` + (rep.modelo ? ` · ${rep.modeloNombre || rep.modelo}` : ' · general'), '', rep.texto.slice(0, 3000)];
    const quien = [rep.nombre, rep.contacto].filter(Boolean).join(' · '); if (quien) lineas.push('', '👤 ' + quien);
    if (files.length) lineas.push('', `📎 ${files.length} archivo${files.length > 1 ? 's' : ''}`);
    lineas.push('', '👉 ' + panelUrl);
    await tg(env, 'sendMessage', { chat_id: chat.id, text: lineas.join('\n'), disable_web_page_preview: true });
    for (const f of files) {
      if (f.size > 50e6) continue;                  /* límite de subida de los bots */
      const video = f.type.startsWith('video/'); const fd = new FormData();
      fd.append('chat_id', String(chat.id)); fd.append('caption', `#${rep.id} · ${f.name}`);
      fd.append(video ? 'video' : 'photo', f, f.name);
      try { await tg(env, video ? 'sendVideo' : 'sendPhoto', fd); }
      catch (e) { const d = new FormData(); d.append('chat_id', String(chat.id)); d.append('caption', `#${rep.id} · ${f.name}`); d.append('document', f, f.name); await tg(env, 'sendDocument', d).catch(() => { }); }
    }
  } catch (e) { console.log('aviso Telegram:', e.message); }
}
