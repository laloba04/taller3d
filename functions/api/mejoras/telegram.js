/* Avisos por Telegram (solo administradora)
   GET    → estado { token, chat }
   POST   → conecta el último chat privado que escribió al bot y manda un mensaje de prueba
   DELETE → desconecta */
import { json, guard, tg, tgChat } from '../../../lib/mejoras.js';

export async function onRequestGet({ request, env }) {
  const no = await guard(request, env); if (no) return no;
  return json({ token: !!env.TELEGRAM_TOKEN, chat: await tgChat(env) });
}

export async function onRequestPost({ request, env }) {
  const no = await guard(request, env); if (no) return no;
  if (!env.TELEGRAM_TOKEN) return json({ error: 'Falta el secreto TELEGRAM_TOKEN en Cloudflare Pages.' }, 503);
  let ups; try { ups = await tg(env, 'getUpdates', { limit: 50, allowed_updates: ['message'] }); }
  catch (e) { return json({ error: 'Telegram no acepta el token: ' + e.message }, 400); }
  const m = ups.map(u => u.message).filter(m => m && m.chat && m.chat.type === 'private').pop();
  if (!m) return json({ error: 'Abre tu bot en Telegram, escríbele /start y vuelve a pulsar Conectar.' }, 404);
  const chat = { id: m.chat.id, nombre: [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.username || 'tu cuenta' };
  await env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('telegram_chat', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(chat)).run();
  try { await tg(env, 'sendMessage', { chat_id: chat.id, text: '✅ Taller 3D conectado. Aquí te llegarán los reportes de "Cosas a mejorar".' }); }
  catch (e) { return json({ error: 'Conectado, pero no se pudo mandar el mensaje de prueba: ' + e.message }, 502); }
  return json({ ok: true, chat });
}

export async function onRequestDelete({ request, env }) {
  const no = await guard(request, env); if (no) return no;
  await env.DB.prepare("DELETE FROM ajustes WHERE clave = 'telegram_chat'").run();
  return json({ ok: true });
}
