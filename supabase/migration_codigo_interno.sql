-- Agrega código interno a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_interno text;

-- Índice parcial único: permite múltiples NULL pero no duplicados entre valores no-nulos
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_codigo_interno
  ON productos (codigo_interno)
  WHERE codigo_interno IS NOT NULL;
