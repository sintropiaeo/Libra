-- ================================================================
-- MIGRACIÓN: Número correlativo de venta
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Agregar columna (nullable por ahora para poder hacer backfill)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS numero_venta INTEGER;

-- 2. Crear secuencia
CREATE SEQUENCE IF NOT EXISTS ventas_numero_seq;

-- 3. Rellenar ventas existentes en orden cronológico
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY fecha ASC, created_at ASC) AS rn
  FROM ventas
  WHERE numero_venta IS NULL
)
UPDATE ventas v
SET numero_venta = n.rn
FROM numbered n
WHERE v.id = n.id;

-- 4. Sincronizar la secuencia con el máximo actual
SELECT setval('ventas_numero_seq', COALESCE((SELECT MAX(numero_venta) FROM ventas), 0));

-- 5. Asignar la secuencia como default y hacer NOT NULL
ALTER TABLE ventas ALTER COLUMN numero_venta SET DEFAULT nextval('ventas_numero_seq');
ALTER TABLE ventas ALTER COLUMN numero_venta SET NOT NULL;
