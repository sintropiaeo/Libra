-- ================================================================
-- MIGRACIÓN: UNIQUE de productos por negocio (multi-tenant)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
-- Regla de arquitectura 3: ningún UNIQUE global si el valor puede
-- repetirse entre negocios. codigo_barras (EAN) y codigo_interno
-- se comparten entre comercios → deben ser únicos POR negocio.
-- Verificado 2026-07-06: 0 duplicados (negocio_id, codigo_*) sobre
-- 73.396 productos. Seguro de aplicar.
-- ================================================================

BEGIN;

-- 1. Eliminar UNIQUE global de codigo_barras (constraint inline del schema inicial)
ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_codigo_barras_key;

-- 2. Eliminar UNIQUE global de codigo_interno (índice parcial)
DROP INDEX IF EXISTS idx_productos_codigo_interno;

-- 3. UNIQUE(negocio_id, codigo_barras)
--    NULLs distintos → varios productos del negocio sin código siguen permitidos
ALTER TABLE productos
  ADD CONSTRAINT productos_negocio_codigo_barras_key
  UNIQUE (negocio_id, codigo_barras);

-- 4. UNIQUE(negocio_id, codigo_interno)
ALTER TABLE productos
  ADD CONSTRAINT productos_negocio_codigo_interno_key
  UNIQUE (negocio_id, codigo_interno);

COMMIT;

-- ── Rollback (si algo falla) ────────────────────────────────────
-- BEGIN;
-- ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_negocio_codigo_barras_key;
-- ALTER TABLE productos DROP CONSTRAINT IF EXISTS productos_negocio_codigo_interno_key;
-- ALTER TABLE productos ADD CONSTRAINT productos_codigo_barras_key UNIQUE (codigo_barras);
-- CREATE UNIQUE INDEX idx_productos_codigo_interno ON productos (codigo_interno) WHERE codigo_interno IS NOT NULL;
-- COMMIT;
