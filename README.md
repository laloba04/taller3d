# Taller 3D

Personalizador de modelos para impresión 3D. Eliges un modelo, cambias el texto, la forma, la imagen o las medidas, lo ves en 3D al momento y descargas el archivo listo para el laminador.

**Web:** https://taller3d-e15.pages.dev

## Qué incluye

- **Más de 150 modelos** en 17 categorías: llaveros, cumpleaños (toppers y bases de tarta), recuerdos, letras grandes, códigos QR, Navidad, abrelatas, rattan, string art, termoformado, mascotas, lámparas, cortadores y sellos, letreros, chapas, para colorear y oficina.
- **Vista previa 3D** que se actualiza mientras editas. El cálculo va en segundo plano (Web Worker), así que la página no se congela con los modelos pesados.
- **Descarga en STL y 3MF**. El 3MF lleva cada color como una pieza separada, para imprimir multicolor (AMS/MMU) o hacer cambios de filamento. El STL une todas las piezas en un único sólido cerrado.
- **Geometría 3D real con [Manifold](https://github.com/elalish/manifold)** (WebAssembly): uniones y restas de sólidos que siempre dan mallas válidas. El abrelatas, por ejemplo, es una sola pieza con la ranura restada en 3D.
- **Buscador y listado completo** en *Modelos*, con filtro por categoría.
- **Favoritos**: se guardan en el navegador.
- **Herramientas**:
  - Conversor de imagen a SVG (PNG, JPEG o WebP a vectores)
  - Generador de códigos QR (PNG o SVG)
  - Archivos de prueba: tolerancias, cubo de calibración, puentes, roscas y tamaño de chapa

Todo se calcula en el navegador. No hay servidor, cuentas ni base de datos, y las imágenes que subes no salen de tu ordenador.

## Probarla en local

Levanta un servidor sencillo y abre la dirección que te dé:

```bash
npx serve public
```

También se puede abrir `public/index.html` con doble clic, pero así el navegador no deja usar el Web Worker ni cargar Manifold: los modelos se calculan en la propia página y por capas (funciona igual, solo que más lento).

## Publicación

El repositorio está conectado a Cloudflare Pages:

| Ajuste | Valor |
|---|---|
| Framework preset | None |
| Build command | *(vacío)* |
| Build output directory | `public` |

Cada `git push` a `main` vuelve a publicar la web automáticamente.

## Estructura

```
public/
├── index.html          página principal
├── css/app.css         estilos
├── js/
│   ├── core.js         motor geométrico: máscaras 2D, contornos, extrusión, revoluciones,
│   │                   roscas, sólidos 3D con Manifold, miniaturas y exportación STL / 3MF
│   ├── models.js       catálogo de categorías y generadores de cada modelo
│   ├── engine.js       trabajos pesados: generar, miniatura, ZIP de descarga, comprobación
│   ├── worker.js       Web Worker que ejecuta engine.js en segundo plano
│   └── app.js          interfaz, navegación, herramientas y visor 3D
└── vendor/manifold/    Manifold (WebAssembly), copiado con tools/vendor-manifold.sh
tests/run_all.py        pruebas automáticas en Chrome sin ventana
tools/                  scripts de mantenimiento
```

### Cómo se calcula un modelo

1. `app.js` manda los parámetros al **Web Worker** (`worker.js`). Las imágenes van como `ImageBitmap`.
2. El worker carga las fuentes de Google Fonts con `FontFace`, ejecuta el generador del modelo (`models.js`) sobre `OffscreenCanvas` y convierte cada capa en malla (`core.js`).
3. Las mallas vuelven a la página como arrays tipados (sin copiarlas) y three.js las dibuja.
4. Al descargar, el worker une las piezas con Manifold para el STL, monta el 3MF y empaqueta el ZIP.

Si el navegador no permite el worker (por ejemplo, abriendo el archivo con doble clic), todo esto se hace en la propia página.

### Sólidos 3D (Manifold)

En `core.js` hay unas funciones sencillas sobre Manifold:

| Función | Qué hace |
|---|---|
| `K.maskSolid(F, máscara, z0, z1)` | Convierte una máscara 2D en un prisma entre dos alturas |
| `K.union([a, b, …])`, `K.subtract(a, b, …)`, `K.intersect(a, b)` | Operaciones booleanas 3D |
| `K.solidMesh(sólido)` | Sólido → malla para el visor y la descarga |
| `K.checkMesh(malla)` | Dice si una malla está cerrada, su volumen y su género |
| `K.hasCSG()` | `true` si Manifold está cargado |

Los generadores deben comprobar `K.hasCSG()` y tener un camino por capas por si Manifold no está disponible (como hace `abreCapas` en el abrelatas).

### Añadir un modelo

1. En `models.js`, escribe una función generadora que reciba los parámetros y devuelva las piezas (una por color). Puede devolver máscaras 2D con altura (`L(...)`) o mallas ya hechas (`LM(...)`).
2. Registra el modelo en `MODELS` con su nombre, descripción y parámetros.
3. Añade su id a la categoría que quieras en `CATEGORIES`.

## Librerías

Se cargan desde CDN, así que no hace falta instalar nada:

- [three.js](https://threejs.org) 0.128: visor 3D
- [JSZip](https://stuk.github.io/jszip/) 3.10: empaquetado 3MF y ZIP
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4: códigos QR
- Google Fonts: tipografías para los textos
- [Manifold](https://github.com/elalish/manifold) 3.5.4 (Apache-2.0): operaciones booleanas 3D en WebAssembly. Va incluida en `public/vendor/manifold` porque necesita un archivo `.wasm` del mismo sitio. Para actualizarla: `tools/vendor-manifold.sh <versión>`.

## Cosas a mejorar (reportes de fallos)

Apartado público donde cualquiera puede avisar de un fallo con texto, fotos y (si R2 está activado) vídeos. Los reportes se revisan en `#mejoras-panel`, protegido con contraseña.

- **Servidor:** Cloudflare Pages Functions en `functions/api/mejoras/` (código común en `lib/mejoras.js`).
- **Datos:** base de datos D1 `taller3d-mejoras` (enlace `DB` en `wrangler.jsonc`, esquema en `db/schema.sql`).
- **Archivos:** si existe el enlace `MEDIA` (R2), fotos y vídeos van a R2; si no, solo se aceptan fotos (se reducen en el navegador y se guardan en D1).
- **Anti-spam:** campo trampa oculto y como mucho 5 reportes por hora y conexión (se guarda una huella de la IP, no la IP).

| Ruta | Quién | Qué hace |
|---|---|---|
| `POST /api/mejoras` | cualquiera | Envía un reporte (formulario con `texto`, `modelo`, `nombre`, `contacto`, `archivos`) |
| `GET /api/mejoras?estado=` | panel | Lista reportes y adjuntos |
| `PATCH /api/mejoras/:id` | panel | Cambia `estado` (pendiente, en_curso, arreglado, descartado) o `nota` |
| `DELETE /api/mejoras/:id` | panel | Borra el reporte y sus archivos |
| `GET /api/mejoras/adjunto/:id` | panel | Descarga una foto o vídeo |
| `GET /api/mejoras/config` | cualquiera | Qué está activado |

### Configuración en Cloudflare

1. **Contraseña del panel:** Workers y Pages → taller3d → Configuración → Variables y secretos → añadir secreto `ADMIN_PASSWORD`. Después, volver a desplegar.
2. **Vídeos:** R2 ya está activado, con el bucket `taller3d-mejoras` enlazado en `wrangler.jsonc` así:
   ```jsonc
   "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "taller3d-mejoras" }]
   ```

### Probar en local

```bash
npx wrangler d1 execute taller3d-mejoras --local --file db/schema.sql
npx wrangler pages dev public --r2 MEDIA --binding ADMIN_PASSWORD=prueba
```

## Pruebas

`tests/run_all.py` abre la web en Chrome sin ventana, genera **todos** los modelos con sus valores por defecto dentro del worker, comprueba con Manifold que cada pieza es una malla cerrada, mide si la página se bloquea y prueba la descarga.

```bash
pip install playwright && playwright install chromium
python3 tests/run_all.py            # todos los modelos
python3 tests/run_all.py --shots    # además, capturas en tests/out/
python3 tests/run_all.py --solo abre-gen,ll-abrelatas
```
