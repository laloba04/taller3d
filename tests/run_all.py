#!/usr/bin/env python3
"""Pruebas de Taller 3D en un Chrome sin ventana (Playwright).

Genera todos los modelos con sus valores por defecto dentro del Web Worker, comprueba con Manifold
que cada pieza es una malla cerrada y válida, mide si la página se congela y hace capturas.

Uso:
  pip install playwright && playwright install chromium
  python3 tests/run_all.py [--vendor DIR] [--solo id1,id2] [--shots]

--vendor DIR: carpeta con copias locales de three@0.128.0, jszip@3.10.1 y qrcode-generator@1.4.4
(como las deja `npm pack`), para probar sin acceso a jsdelivr.
"""
import argparse, functools, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')
CDN = {
    'https://cdn.jsdelivr.net/npm/three@0.128.0/': 'three-0.128.0/package/',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/': 'jszip-3.10.1/package/',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/': 'qrcode-generator-1.4.4/package/',
}


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    s = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s, f'http://127.0.0.1:{s.server_port}/'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--vendor'); ap.add_argument('--solo'); ap.add_argument('--shots', action='store_true')
    ap.add_argument('--chrome', default=os.environ.get('CHROME'))
    a = ap.parse_args()
    srv, url = serve()
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(out_dir, exist_ok=True)
    fails = []
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path=a.chrome) if a.chrome else pw.chromium.launch()
        ctx = br.new_context(viewport={'width': 1280, 'height': 860})
        if a.vendor:
            def local(route):
                u = route.request.url
                for pre, rel in CDN.items():
                    if u.startswith(pre):
                        return route.fulfill(path=os.path.join(a.vendor, rel, u[len(pre):]))
                route.abort()
            ctx.route('https://cdn.jsdelivr.net/**', local)
            ctx.route('https://fonts.googleapis.com/**', lambda r: r.fulfill(body='', content_type='text/css'))
        page = ctx.new_page()
        logs = []
        page.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
        page.goto(url + '#inicio')
        mode = page.evaluate('() => __T3D.Engine.mode')
        print('motor:', mode)
        if mode != 'worker': fails.append(('motor', mode))
        ids = page.evaluate("""() => { const s = new Set(); for (const c of CAT.CATEGORIES) for (const id of c.models) if (CAT.MODELS[id] && !CAT.MODELS[id].soon) s.add(id); return [...s]; }""")
        if a.solo: ids = [i for i in ids if i in a.solo.split(',')]
        print(len(ids), 'modelos')
        t0 = time.time()
        for i, mid in enumerate(ids):
            r = page.evaluate("""async (id) => {
              const m = CAT.MODELS[id], E = __T3D.Engine; const v = __T3D.defaults(m);
              /* mide cuánto se bloquea la página mientras el worker calcula */
              let last = performance.now(), worst = 0; const tick = setInterval(() => { const n = performance.now(); worst = Math.max(worst, n - last); last = n; }, 16);
              const t = performance.now();
              try {
                const res = await E.gen(m, v); const ms = performance.now() - t;
                const chk = await E.run('check', null, null, { parts: res.parts.map(p => ({ name: p.name, mesh: { pos: p.mesh.pos, idx: p.mesh.idx } })) });
                return { ok: true, ms, worst, parts: res.parts.length, tris: res.parts.reduce((a, p) => a + p.mesh.idx.length / 3, 0), csg: res.csg, warn: res.warn,
                         bad: chk.filter(c => c.ok === false).map(c => c.name + ': ' + c.status), nulls: chk.filter(c => c.ok === null).length };
              } catch (e) { return { ok: false, error: String(e.message || e) }; } finally { clearInterval(tick); }
            }""", mid)
            if not r['ok'] or not r['parts'] or r['bad']:
                fails.append((mid, r)); flag = 'FALLO'
            else:
                flag = 'ok'
            print(f"[{i + 1:3}/{len(ids)}] {flag:5} {mid:24} " + (f"{r['parts']:2} piezas {int(r['tris']):8} tri {r['ms']:7.0f} ms  bloqueo máx {r['worst']:4.0f} ms" if r['ok'] else r['error'])
                  + (f"  NO CERRADAS: {r['bad']}" if r.get('bad') else ''), flush=True)
        print(f'tiempo total {time.time() - t0:.0f} s')
        # descarga completa (STL unido + 3MF) del abrelatas
        z = page.evaluate("""async () => { const m = CAT.MODELS['abre-gen']; const res = await __T3D.Engine.gen(m, __T3D.defaults(m));
            const z = await __T3D.Engine.zip({ parts: res.parts, title: m.name, base: 'abre-gen', readme: 'x {STL}' }); return { size: z.blob.size, joined: z.joined, parts: res.parts.map(p => p.name) }; }""")
        print('descarga abre-gen:', z)
        if not z['joined']: fails.append(('zip abre-gen', z))
        if a.shots:
            for mid in ['abre-gen', 'abre-nfc', 'll-abrelatas']:
                page.goto(url + '#m-' + mid); page.wait_for_function("() => document.querySelector('#busy').classList.contains('hidden') && document.querySelector('#dims').textContent !== '—'", timeout=60000)
                page.wait_for_timeout(800); page.screenshot(path=os.path.join(out_dir, mid + '.png'))
            page.goto(url + '#abrelatas'); page.wait_for_timeout(6000); page.screenshot(path=os.path.join(out_dir, 'cat-abrelatas.png'))
        if logs: print('\n'.join(['consola:'] + logs[:30]))
        br.close()
    srv.shutdown()
    print('\nFALLOS:' if fails else '\nTodo OK', *(f'- {f[0]}: {json.dumps(f[1], ensure_ascii=False)[:300]}' for f in fails), sep='\n')
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
