-- Taller 3D — "Cosas a mejorar" (Cloudflare D1: taller3d-mejoras)
CREATE TABLE IF NOT EXISTS reportes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  creado    TEXT NOT NULL DEFAULT (datetime('now')),
  modelo    TEXT,                       -- id del modelo o null si es algo general
  nombre    TEXT,
  contacto  TEXT,
  texto     TEXT NOT NULL,
  estado    TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | en_curso | arreglado | descartado
  nota      TEXT,                       -- nota interna de la administradora
  ip_hash   TEXT                        -- huella de la IP para limitar envíos (no se guarda la IP)
);
CREATE TABLE IF NOT EXISTS adjuntos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reporte_id INTEGER NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL,             -- imagen | video
  nombre     TEXT,
  tam        INTEGER,
  mime       TEXT,
  r2_key     TEXT,                      -- si se guardó en R2
  datos      BLOB                       -- si se guardó en la base de datos (solo fotos, sin R2)
);
CREATE INDEX IF NOT EXISTS idx_rep_estado ON reportes(estado, creado);
CREATE INDEX IF NOT EXISTS idx_rep_ip ON reportes(ip_hash, creado);
CREATE INDEX IF NOT EXISTS idx_adj_rep ON adjuntos(reporte_id);
