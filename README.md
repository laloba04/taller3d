# Taller 3D

Web estática: no necesita servidor ni compilación. Solo hay que subir esta carpeta.

## Despliegue (GitHub → Cloudflare Pages)
1. Cloudflare → Workers & Pages → Create → pestaña **Pages** → **Connect to Git** → `taller3d`.
2. Framework preset **None** · Build command vacío · Build output directory `public`.
3. Save and Deploy → `https://taller3d.pages.dev`.

Cada `git push` a `main` vuelve a publicar la web.

## Probarla en tu ordenador
Abre `public/index.html` con doble clic, o: `npx wrangler pages dev public` / `npx serve public`

## Archivos
- `public/index.html` – página
- `public/css/app.css` – estilos
- `public/js/core.js` – motor geométrico (máscaras, mallas, roscas, exportación STL/3MF)
- `public/js/models.js` – catálogo de categorías y modelos
- `public/js/app.js` – interfaz y visor 3D (three.js)

Librerías por CDN: three.js 0.128, JSZip 3.10, qrcode-generator 1.4.4, Google Fonts.
