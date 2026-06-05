-- ================================================================
-- MIGRACIÓN: Columnas para el modo demo
-- Ejecutar ANTES del seed-demo.sql
-- ================================================================

-- 1. Marca si un negocio es el negocio demo
ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2. Stock de referencia para el reset semanal
--    (se guarda DESPUÉS de correr el seed, con los datos iniciales)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS stock_inicial integer;

-- 3. Función RPC para restaurar stock — usada por /api/demo/reset
CREATE OR REPLACE FUNCTION public.demo_reset_stock(p_negocio_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE productos
  SET    stock_actual = stock_inicial
  WHERE  negocio_id   = p_negocio_id
    AND  stock_inicial IS NOT NULL;
$$;

-- Verificación:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name IN ('negocios', 'productos')
--   AND column_name IN ('is_demo', 'stock_inicial');
