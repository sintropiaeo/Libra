-- ================================================================
-- MIGRACIÓN: numero_venta POR NEGOCIO (multi-tenant) — Opción 2
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
-- Regla 4: ningún contador/secuencia global. Se reemplaza la
-- secuencia global ventas_numero_seq por un contador por negocio
-- (contadores_venta) + trigger atómico BEFORE INSERT.
--
-- Opción 2 (preservar histórico): las 606 ventas existentes
-- conservan su número actual; el contador de cada negocio arranca
-- desde su MAX actual. Los negocios nuevos empiezan en 1.
-- Verificado 2026-07-06: sin duplicados (negocio_id, numero_venta).
-- Sin cambios de código (crearVenta ya inserta sin numero_venta).
-- ================================================================

BEGIN;

-- 1. Quitar el DEFAULT global y eliminar la secuencia
ALTER TABLE ventas ALTER COLUMN numero_venta DROP DEFAULT;
DROP SEQUENCE IF EXISTS ventas_numero_seq;

-- 2. Unicidad por negocio (los datos actuales ya cumplen: 0 duplicados)
ALTER TABLE ventas
  ADD CONSTRAINT ventas_negocio_numero_key UNIQUE (negocio_id, numero_venta);

-- 3. Tabla contador por negocio
CREATE TABLE IF NOT EXISTS contadores_venta (
  negocio_id    uuid    NOT NULL REFERENCES negocios(id),
  ultimo_numero integer NOT NULL DEFAULT 0,
  PRIMARY KEY (negocio_id)
);

ALTER TABLE contadores_venta ENABLE ROW LEVEL SECURITY;

-- 4. Backfill: contador = MAX(numero_venta) de cada negocio con ventas.
--    Los negocios sin ventas no tienen fila -> su primera venta arranca en 1.
INSERT INTO contadores_venta (negocio_id, ultimo_numero)
SELECT negocio_id, COALESCE(MAX(numero_venta), 0)
FROM   ventas
GROUP  BY negocio_id
ON CONFLICT (negocio_id) DO UPDATE
  SET ultimo_numero = EXCLUDED.ultimo_numero;

-- 5. RLS: acceso solo a la fila del propio negocio (rule 2).
--    Los writes reales van por el trigger SECURITY DEFINER; estas
--    policies son defensa para cualquier acceso vía sesión.
CREATE POLICY "contadores_venta_select"
  ON contadores_venta FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

CREATE POLICY "contadores_venta_insert"
  ON contadores_venta FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "contadores_venta_update"
  ON contadores_venta FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id())
  WITH CHECK (negocio_id = get_my_negocio_id());

-- 6. Función: asigna numero_venta por negocio de forma atómica
CREATE OR REPLACE FUNCTION set_numero_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num integer;
BEGIN
  -- fallback por si el negocio_id aún no fue seteado
  IF NEW.negocio_id IS NULL THEN
    NEW.negocio_id := get_my_negocio_id();
  END IF;

  IF NEW.numero_venta IS NULL THEN
    INSERT INTO contadores_venta (negocio_id, ultimo_numero)
    VALUES (NEW.negocio_id, 1)
    ON CONFLICT (negocio_id) DO UPDATE
      SET ultimo_numero = contadores_venta.ultimo_numero + 1
    RETURNING ultimo_numero INTO v_num;
    NEW.numero_venta := v_num;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Trigger BEFORE INSERT.
--    Nombre 'trg_numero_venta' ordena DESPUÉS de 'trg_auto_negocio_ventas',
--    así el negocio_id ya está seteado cuando corre.
DROP TRIGGER IF EXISTS trg_numero_venta ON ventas;
CREATE TRIGGER trg_numero_venta
  BEFORE INSERT ON ventas
  FOR EACH ROW EXECUTE FUNCTION set_numero_venta();

COMMIT;

-- ── Rollback (solo si algo falla) ───────────────────────────────
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_numero_venta ON ventas;
-- DROP FUNCTION IF EXISTS set_numero_venta();
-- DROP TABLE IF EXISTS contadores_venta;
-- ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_negocio_numero_key;
-- CREATE SEQUENCE IF NOT EXISTS ventas_numero_seq;
-- SELECT setval('ventas_numero_seq', COALESCE((SELECT MAX(numero_venta) FROM ventas), 0));
-- ALTER TABLE ventas ALTER COLUMN numero_venta SET DEFAULT nextval('ventas_numero_seq');
-- COMMIT;
