-- ─── updated_at en productos ─────────────────────────────────────────────────

-- 1. Columna (si no existe)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Inicializar filas existentes que quedaron NULL
UPDATE productos SET updated_at = now() WHERE updated_at IS NULL;

-- 3. Función trigger genérica (reutilizable en otras tablas)
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger BEFORE UPDATE en productos
DROP TRIGGER IF EXISTS set_timestamp_productos ON productos;
CREATE TRIGGER set_timestamp_productos
  BEFORE UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

-- 5. Verificación: ejecutar este UPDATE y confirmar que updated_at cambia
-- UPDATE productos SET nombre = nombre WHERE id = (SELECT id FROM productos LIMIT 1);
-- SELECT id, nombre, updated_at FROM productos ORDER BY updated_at DESC LIMIT 3;
