# Taller 3D

Web estática: no necesita servidor ni compilación. Solo hay que subir esta carpeta.

## Despliegue (GitHub → Cloudflare Pages)
1. Cloudflare → Workers & Pages → Create → Pages → **Connect to Git** → elige este repositorio.
2. Configuración de build: *Framework preset* **None**, *Build command* vacío, *Build output directory* `/`.
3. Save and Deploy → `https://taller3d.pages.dev`.

Cada `git push` a `main` vuelve a publicar la web automáticamente.

## Probarla en tu ordenador
Abre `index.html` con doble clic, o desde esta carpeta: `npx serve .`

## Archivos
- `index.html` – página
- `css/app.css` – estilos
- `js/core.js` – motor geométrico (máscaras, mallas, roscas, exportación STL/3MF)
- `js/models.js` – catálogo de categorías y modelos
- `js/app.js` – interfaz y visor 3D (three.js)

Librerías por CDN: three.js 0.128, JSZip 3.10, qrcode-generator 1.4.4, Google Fonts.
