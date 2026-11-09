# Taller 3D

Personalizador de modelos para impresión 3D. Eliges un modelo, cambias el texto, la forma, la imagen o las medidas, lo ves en 3D al momento y descargas el archivo listo para el laminador.

**Web:** https://taller3d-e15.pages.dev

## Qué incluye

- **Más de 150 modelos** en 17 categorías: llaveros, cumpleaños (toppers y bases de tarta), recuerdos, letras grandes, códigos QR, Navidad, abrelatas, rattan, string art, termoformado, mascotas, lámparas, cortadores y sellos, letreros, chapas, para colorear y oficina.
- **Vista previa 3D** que se actualiza mientras editas.
- **Descarga en STL y 3MF**. El 3MF lleva cada color como una pieza separada, para imprimir multicolor (AMS/MMU) o hacer cambios de filamento.
- **Buscador y listado completo** en *Modelos*, con filtro por categoría.
- **Favoritos**: se guardan en el navegador.
- **Herramientas**:
  - Conversor de imagen a SVG (PNG, JPEG o WebP a vectores)
  - Generador de códigos QR (PNG o SVG)
  - Archivos de prueba: tolerancias, cubo de calibración, puentes, roscas y tamaño de chapa

Todo se calcula en el navegador. No hay servidor, cuentas ni base de datos, y las imágenes que subes no salen de tu ordenador.

## Probarla en local

Abre `public/index.html` con doble clic, o levanta un servidor sencillo:

```bash
npx serve public
```

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
├── index.html      página principal
├── css/app.css     estilos
└── js/
    ├── core.js     motor geométrico: máscaras 2D, contornos, extrusión,
    │               revoluciones, roscas y exportación STL / 3MF
    ├── models.js   catálogo de categorías y generadores de cada modelo
    └── app.js      interfaz, navegación, herramientas y visor 3D
```

### Añadir un modelo

1. En `models.js`, escribe una función generadora que reciba los parámetros y devuelva las piezas (una por color).
2. Registra el modelo en `MODELS` con su nombre, descripción y parámetros.
3. Añade su id a la categoría que quieras en `CATEGORIES`.

## Librerías

Se cargan desde CDN, así que no hace falta instalar nada:

- [three.js](https://threejs.org) 0.128: visor 3D
- [JSZip](https://stuk.github.io/jszip/) 3.10: empaquetado 3MF y ZIP
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4: códigos QR
- Google Fonts: tipografías para los textos
