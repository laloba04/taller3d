/* Taller 3D — Web Worker: calcula los modelos en segundo plano para que la página no se congele */
'use strict';
importScripts(
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  '../vendor/manifold/manifold.js',
  'core.js', 'models.js', 'engine.js');

const MF_BASE = new URL('../vendor/manifold/', self.location.href).href;
const manifold = (async () => {
  try { const w = await self.ManifoldModule({ locateFile: f => MF_BASE + f }); w.setup(); K.useManifold(w); return true; }
  catch (e) { console.warn('Manifold no disponible; se usa el método por capas.', e); return false; }
})();

/* un trabajo detrás de otro */
let chain = Promise.resolve();
self.onmessage = (e) => {
  const { id, op, data } = e.data;
  chain = chain.then(async () => {
    try {
      let out, transfer = [];
      if (op === 'hello') {
        K.setFontSource(data.fontCss);
        let canvas2d = false; try { canvas2d = !!new OffscreenCanvas(4, 4).getContext('2d'); } catch (err) { }
        out = { ok: canvas2d && typeof self.fonts !== 'undefined' && typeof FontFace !== 'undefined', csg: await manifold };
      } else {
        await manifold;
        out = await JOBS[op](data);
        if (op === 'gen') for (const p of out.parts) transfer.push(p.mesh.pos.buffer, p.mesh.idx.buffer);
        if (op === 'thumb') { out = out.transferToImageBitmap(); transfer.push(out); }
      }
      self.postMessage({ id, ok: true, out }, transfer);
    } catch (err) {
      console.error(err);
      self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
    }
  });
};
