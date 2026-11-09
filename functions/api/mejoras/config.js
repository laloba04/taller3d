/* GET /api/mejoras/config → qué está activado (público) */
import { json, LIM } from '../../../lib/mejoras.js';

export function onRequestGet({ env }) {
  return json({ activo: !!env.DB, videos: !!env.MEDIA, panel: !!env.ADMIN_PASSWORD, maxArchivos: LIM.archivos, maxVideoMB: LIM.video / 1e6 });
}
