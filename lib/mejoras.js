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
