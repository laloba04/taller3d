#!/usr/bin/env bash
# Copia manifold-3d (WebAssembly) a public/vendor/manifold y lo convierte en script clásico,
# para poder cargarlo con importScripts() en el Web Worker y con <script> en la página.
# Uso: tools/vendor-manifold.sh [versión]   (por defecto 3.5.4)
set -euo pipefail
VER="${1:-3.5.4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/vendor/manifold"
TMP="$(mktemp -d)"
( cd "$TMP" && npm pack --silent "manifold-3d@$VER" >/dev/null 2>&1 && tar xzf manifold-3d-*.tgz )
mkdir -p "$OUT"
cp "$TMP/package/manifold.wasm" "$TMP/package/LICENSE" "$OUT/"
{
  echo "/* manifold-3d $VER (Apache-2.0, https://github.com/elalish/manifold) convertido a script clásico por tools/vendor-manifold.sh */"
  sed -e 's/import\.meta\.url/(self.MANIFOLD_BASE||self.location.href)/g' \
      -e 's/export default Module;\{0,1\}/self.ManifoldModule=Module;/' \
      "$TMP/package/manifold.js"
} > "$OUT/manifold.js"
echo "$VER" > "$OUT/VERSION"
rm -rf "$TMP"
echo "manifold-3d $VER copiado en $OUT"
