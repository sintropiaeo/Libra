-- ================================================================
-- MIGRACIÓN: Contador de comprobantes POR NEGOCIO (multi-tenant)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
-- Regla de arquitectura 4: ningún contador/secuencia global.
-- La PK global (tipo) hacía que el ON CONFLICT chocara contra la
-- fila del primer negocio → RLS bloqueaba el UPDATE → solo el
-- negocio #1 podía facturar. Se pasa a PK (negocio_id, tipo) y la
-- función deriva el negocio del usuario autenticado.
-- Verificado 2026-07-06: 1 fila, 0 duplicados (negocio_id, tipo).
-- ================================================================

BEGIN;

-- 1. negocio_id (defensivo — ya existe NOT NULL en prod)
ALTER TABLE contadores_comprobantes
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);

-- 2. PRIMARY KEY (tipo) → (negocio_id, tipo)
ALTER TABLE contadores_comprobantes DROP CONSTRAINT IF EXISTS contadores_comprobantes_pkey;
ALTER TABLE contadores_comprobantes ADD PRIMARY KEY (negocio_id, tipo);

-- 3. Función: ON CONFLICT (negocio_id, tipo), negocio del usuario autenticado
CREATE OR REPLACE FUNCTION siguiente_numero_comprobante(p_tipo text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_negocio uuid := get_my_negocio_id();
  v_numero  integer;
BEGIN
  IF v_negocio IS NULL THEN
    RAISE EXCEPTION 'No se pudo determinar el negocio del usuario autenticado.';
  END IF;

  INSERT INTO contadores_comprobantes (negocio_id, tipo, ultimo_numero)
  VALUES (v_negocio, p_tipo, 1)
  ON CONFLICT (negocio_id, tipo) DO UPDATE
    SET ultimo_numero = contadores_comprobantes.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;

  RETURN v_numero;
END;
$$;

-- 4. RLS: garantizar INSERT/UPDATE (y SELECT/DELETE) solo del propio negocio
DROP POLICY IF EXISTS "contadores_select"       ON contadores_comprobantes;
DROP POLICY IF EXISTS "contadores_insert"       ON contadores_comprobantes;
DROP POLICY IF EXISTS "contadores_update"       ON contadores_comprobantes;
DROP POLICY IF EXISTS "contadores_delete_admin" ON contadores_comprobantes;

CREATE POLICY "contadores_select"
  ON contadores_comprobantes FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

CREATE POLICY "contadores_insert"
  ON contadores_comprobantes FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "contadores_update"
  ON contadores_comprobantes FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id())
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "contadores_delete_admin"
  ON contadores_comprobantes FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

COMMIT;

-- ── Rollback (solo si algo falla) ───────────────────────────────
-- OJO: revertir la PK a (tipo) solo funciona si existe UN único negocio.
-- BEGIN;
-- ALTER TABLE contadores_comprobantes DROP CONSTRAINT contadores_comprobantes_pkey;
-- ALTER TABLE contadores_comprobantes ADD PRIMARY KEY (tipo);
-- CREATE OR REPLACE FUNCTION siguiente_numero_comprobante(p_tipo text)
-- RETURNS integer LANGUAGE plpgsql AS $$
-- DECLARE v_numero integer;
-- BEGIN
--   INSERT INTO contadores_comprobantes (tipo, ultimo_numero)
--   VALUES (p_tipo, 1)
--   ON CONFLICT (tipo) DO UPDATE
--     SET ultimo_numero = contadores_comprobantes.ultimo_numero + 1
--   RETURNING ultimo_numero INTO v_numero;
--   RETURN v_numero;
-- END; $$;
-- COMMIT;
