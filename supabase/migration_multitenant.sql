-- ================================================================
-- MIGRACIÓN: Multi-tenant + Rol Cajero
-- Proyecto: Libra
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
--
-- RESUMEN DE CAMBIOS:
--   1. Tabla `negocios` — un negocio por instancia (base para multi-tenant)
--   2. Rol `cajero` — empleado de caja con permisos restringidos
--   3. `negocio_id` en todos los modelos — aislamiento de datos
--   4. Funciones helper: get_my_negocio_id(), get_my_rol()
--   5. Triggers SECURITY DEFINER — cajero puede generar ventas sin UPDATE en productos
--   6. RLS por negocio + rol — admin vs cajero en cada tabla
--
-- SEGURIDAD:
--   - Todos los datos existentes se migran al negocio inicial
--   - El usuario admin (educeledon98@gmail.com) sigue funcionando igual
--   - Las funciones helper usan SECURITY DEFINER para evitar recursión en RLS
--
-- ROLLBACK: ver sección final del script
-- ================================================================


-- ============================================================
-- SECCIÓN 1: Tabla negocios
-- ============================================================

CREATE TABLE IF NOT EXISTS negocios (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL DEFAULT 'Mi Negocio',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE negocios ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- SECCIÓN 2: Agregar rol 'cajero' al constraint de perfiles
-- ============================================================

ALTER TABLE perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('super_admin', 'admin', 'cajero', 'empleado'));
-- 'empleado' se mantiene por compatibilidad con registros anteriores


-- ============================================================
-- SECCIÓN 3: Crear el negocio inicial desde negocio_config
-- ============================================================

-- Usamos el nombre del negocio ya configurado
INSERT INTO negocios (nombre)
SELECT COALESCE(NULLIF(TRIM(nombre), ''), 'Mi Negocio')
FROM   negocio_config
LIMIT  1;

-- Si negocio_config estaba vacío, insertar un negocio por defecto
INSERT INTO negocios (nombre)
SELECT 'Mi Negocio'
WHERE  NOT EXISTS (SELECT 1 FROM negocios);


-- ============================================================
-- SECCIÓN 4: Agregar negocio_id a todas las tablas
-- ============================================================

ALTER TABLE perfiles              ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE categorias            ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE productos              ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE proveedores            ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE ventas                 ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE venta_items            ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE compras_proveedor      ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE compra_items           ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE arqueos_caja           ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE contadores_comprobantes ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE negocio_config         ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);
ALTER TABLE configuracion_ticket   ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES negocios(id);


-- ============================================================
-- SECCIÓN 5: Migrar todos los datos al único negocio
-- ============================================================

DO $$
DECLARE v_id uuid := (SELECT id FROM negocios ORDER BY created_at LIMIT 1);
BEGIN
  UPDATE perfiles               SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE categorias             SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE productos               SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE proveedores             SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE ventas                  SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE venta_items             SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE compras_proveedor       SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE compra_items            SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE arqueos_caja            SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE contadores_comprobantes SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE negocio_config          SET negocio_id = v_id WHERE negocio_id IS NULL;
  UPDATE configuracion_ticket    SET negocio_id = v_id WHERE negocio_id IS NULL;
END $$;


-- ============================================================
-- SECCIÓN 6: NOT NULL constraint (después de migrar datos)
-- ============================================================

ALTER TABLE perfiles               ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE categorias             ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE productos               ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE proveedores             ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE ventas                  ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE venta_items             ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE compras_proveedor       ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE compra_items            ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE arqueos_caja            ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE contadores_comprobantes ALTER COLUMN negocio_id SET NOT NULL;
ALTER TABLE negocio_config          ALTER COLUMN negocio_id SET NOT NULL;
-- configuracion_ticket puede no existir aún — la dejamos nullable
-- ALTER TABLE configuracion_ticket ALTER COLUMN negocio_id SET NOT NULL;


-- ============================================================
-- SECCIÓN 7: Índices
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_perfiles_negocio             ON perfiles              (negocio_id);
CREATE INDEX IF NOT EXISTS idx_categorias_negocio           ON categorias            (negocio_id);
CREATE INDEX IF NOT EXISTS idx_productos_negocio            ON productos              (negocio_id);
CREATE INDEX IF NOT EXISTS idx_proveedores_negocio          ON proveedores            (negocio_id);
CREATE INDEX IF NOT EXISTS idx_ventas_negocio               ON ventas                 (negocio_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_negocio          ON venta_items            (negocio_id);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor_negocio    ON compras_proveedor      (negocio_id);
CREATE INDEX IF NOT EXISTS idx_compra_items_negocio         ON compra_items           (negocio_id);
CREATE INDEX IF NOT EXISTS idx_arqueos_caja_negocio         ON arqueos_caja           (negocio_id);
CREATE INDEX IF NOT EXISTS idx_contadores_negocio           ON contadores_comprobantes(negocio_id);


-- ============================================================
-- SECCIÓN 8: Funciones helper (SECURITY DEFINER)
-- ============================================================
-- SECURITY DEFINER permite que la función consulte `perfiles` sin
-- disparar RLS recursivamente (corre como el propietario de la función,
-- que es postgres/superuser y tiene acceso directo a las tablas).

CREATE OR REPLACE FUNCTION public.get_my_negocio_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT negocio_id
  FROM   perfiles
  WHERE  user_id = auth.uid()
    AND  activo  = true
  LIMIT  1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol
  FROM   perfiles
  WHERE  user_id = auth.uid()
    AND  activo  = true
  LIMIT  1;
$$;


-- ============================================================
-- SECCIÓN 9: Trigger para auto-completar negocio_id en INSERTs
-- ============================================================
-- Para operaciones que usan la sesión del usuario (createClient).
-- Operaciones con service role (createAdminClient) deben pasar
-- negocio_id explícitamente — el trigger devuelve NULL en ese caso.

CREATE OR REPLACE FUNCTION public.auto_set_negocio_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.negocio_id IS NULL THEN
    NEW.negocio_id := (
      SELECT negocio_id FROM perfiles
      WHERE  user_id = auth.uid()
        AND  activo  = true
      LIMIT  1
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Aplicar a tablas que reciben INSERTs desde la sesión del usuario
CREATE OR REPLACE TRIGGER trg_auto_negocio_ventas
  BEFORE INSERT ON ventas
  FOR EACH ROW EXECUTE FUNCTION auto_set_negocio_id();

CREATE OR REPLACE TRIGGER trg_auto_negocio_venta_items
  BEFORE INSERT ON venta_items
  FOR EACH ROW EXECUTE FUNCTION auto_set_negocio_id();

CREATE OR REPLACE TRIGGER trg_auto_negocio_arqueos
  BEFORE INSERT ON arqueos_caja
  FOR EACH ROW EXECUTE FUNCTION auto_set_negocio_id();

CREATE OR REPLACE TRIGGER trg_auto_negocio_contadores
  BEFORE INSERT ON contadores_comprobantes
  FOR EACH ROW EXECUTE FUNCTION auto_set_negocio_id();


-- ============================================================
-- SECCIÓN 10: Triggers de stock → SECURITY DEFINER
-- ============================================================
-- El cajero puede insertar en venta_items (POS), pero no tiene
-- UPDATE en productos. Con SECURITY DEFINER el trigger de stock
-- corre como postgres y puede actualizar sin restricción de RLS.

CREATE OR REPLACE FUNCTION ajustar_stock_por_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE productos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.producto_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.producto_id = NEW.producto_id THEN
      UPDATE productos SET stock_actual = stock_actual + OLD.cantidad - NEW.cantidad WHERE id = NEW.producto_id;
    ELSE
      UPDATE productos SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE productos SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.producto_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION ajustar_stock_por_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE productos SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.producto_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.producto_id = NEW.producto_id THEN
      UPDATE productos SET stock_actual = stock_actual - OLD.cantidad + NEW.cantidad WHERE id = NEW.producto_id;
    ELSE
      UPDATE productos SET stock_actual = stock_actual - OLD.cantidad WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE productos SET stock_actual = stock_actual - OLD.cantidad WHERE id = OLD.producto_id;
    RETURN OLD;
  END IF;
END;
$$;


-- ============================================================
-- SECCIÓN 11: Eliminar políticas RLS antiguas
-- ============================================================

-- negocios (nueva tabla — sin policies aún)

-- perfiles
DROP POLICY IF EXISTS "perfiles_select_authenticated"    ON perfiles;
DROP POLICY IF EXISTS "perfiles_insert_own"              ON perfiles;
DROP POLICY IF EXISTS "perfiles_update_own_or_admin"     ON perfiles;
DROP POLICY IF EXISTS "perfiles_delete_admin"            ON perfiles;

-- categorias
DROP POLICY IF EXISTS "auth_select_categorias"  ON categorias;
DROP POLICY IF EXISTS "auth_insert_categorias"  ON categorias;
DROP POLICY IF EXISTS "auth_update_categorias"  ON categorias;
DROP POLICY IF EXISTS "auth_delete_categorias"  ON categorias;

-- productos
DROP POLICY IF EXISTS "auth_select_productos"  ON productos;
DROP POLICY IF EXISTS "auth_insert_productos"  ON productos;
DROP POLICY IF EXISTS "auth_update_productos"  ON productos;
DROP POLICY IF EXISTS "auth_delete_productos"  ON productos;

-- proveedores
DROP POLICY IF EXISTS "auth_select_proveedores"  ON proveedores;
DROP POLICY IF EXISTS "auth_insert_proveedores"  ON proveedores;
DROP POLICY IF EXISTS "auth_update_proveedores"  ON proveedores;
DROP POLICY IF EXISTS "auth_delete_proveedores"  ON proveedores;

-- ventas
DROP POLICY IF EXISTS "auth_select_ventas"  ON ventas;
DROP POLICY IF EXISTS "auth_insert_ventas"  ON ventas;
DROP POLICY IF EXISTS "auth_update_ventas"  ON ventas;
DROP POLICY IF EXISTS "auth_delete_ventas"  ON ventas;

-- venta_items
DROP POLICY IF EXISTS "auth_select_venta_items"  ON venta_items;
DROP POLICY IF EXISTS "auth_insert_venta_items"  ON venta_items;
DROP POLICY IF EXISTS "auth_update_venta_items"  ON venta_items;
DROP POLICY IF EXISTS "auth_delete_venta_items"  ON venta_items;

-- compras_proveedor
DROP POLICY IF EXISTS "auth_select_compras_proveedor"  ON compras_proveedor;
DROP POLICY IF EXISTS "auth_insert_compras_proveedor"  ON compras_proveedor;
DROP POLICY IF EXISTS "auth_update_compras_proveedor"  ON compras_proveedor;
DROP POLICY IF EXISTS "auth_delete_compras_proveedor"  ON compras_proveedor;

-- compra_items
DROP POLICY IF EXISTS "auth_select_compra_items"  ON compra_items;
DROP POLICY IF EXISTS "auth_insert_compra_items"  ON compra_items;
DROP POLICY IF EXISTS "auth_update_compra_items"  ON compra_items;
DROP POLICY IF EXISTS "auth_delete_compra_items"  ON compra_items;

-- contadores_comprobantes
DROP POLICY IF EXISTS "auth_select_contadores_comprobantes"  ON contadores_comprobantes;
DROP POLICY IF EXISTS "auth_insert_contadores_comprobantes"  ON contadores_comprobantes;
DROP POLICY IF EXISTS "auth_update_contadores_comprobantes"  ON contadores_comprobantes;
DROP POLICY IF EXISTS "auth_delete_contadores_comprobantes"  ON contadores_comprobantes;

-- negocio_config
DROP POLICY IF EXISTS "negocio_config_select_authenticated"  ON negocio_config;
DROP POLICY IF EXISTS "negocio_config_write_admin"           ON negocio_config;

-- arqueos_caja
DROP POLICY IF EXISTS "arqueos_select_authenticated"   ON arqueos_caja;
DROP POLICY IF EXISTS "arqueos_insert_own"             ON arqueos_caja;
DROP POLICY IF EXISTS "arqueos_update_own_or_admin"    ON arqueos_caja;
DROP POLICY IF EXISTS "arqueos_delete_admin"           ON arqueos_caja;

-- configuracion_ticket (si existe)
DROP POLICY IF EXISTS "authenticated_read_config_ticket"  ON configuracion_ticket;
DROP POLICY IF EXISTS "admins_write_config_ticket"        ON configuracion_ticket;


-- ============================================================
-- SECCIÓN 12: Nuevas políticas RLS — negocio_id + rol
-- ============================================================
--
-- MATRIZ DE PERMISOS:
--   TABLA                | ADMIN             | CAJERO
--   ---------------------|-------------------|------------------
--   negocios             | leer (el suyo)    | SIN ACCESO
--   perfiles             | leer+escribir     | solo leer el suyo
--   categorias           | leer+escribir     | solo leer
--   productos            | leer+escribir     | solo leer
--   ventas               | leer+escribir     | leer+escribir
--   venta_items          | leer+escribir     | leer+escribir
--   proveedores          | leer+escribir     | SIN ACCESO
--   compras_proveedor    | leer+escribir     | SIN ACCESO
--   compra_items         | leer+escribir     | SIN ACCESO
--   arqueos_caja         | leer+escribir     | solo leer
--   contadores_comprob.  | leer+escribir     | leer+escribir (facturas)
--   negocio_config       | leer+escribir     | solo leer
--   configuracion_ticket | leer+escribir     | solo leer


-- ── negocios ─────────────────────────────────────────────────────────────

CREATE POLICY "negocios_select_admin"
  ON negocios FOR SELECT TO authenticated
  USING (
    id = get_my_negocio_id()
    AND get_my_rol() IN ('admin', 'super_admin')
  );


-- ── perfiles ─────────────────────────────────────────────────────────────

-- Todos pueden leer su propio perfil (necesario para el layout al login)
CREATE POLICY "perfiles_select_own"
  ON perfiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin/super_admin pueden ver todos los perfiles de su negocio
CREATE POLICY "perfiles_select_negocio_admin"
  ON perfiles FOR SELECT TO authenticated
  USING (
    negocio_id = get_my_negocio_id()
    AND get_my_rol() IN ('admin', 'super_admin')
  );

-- Auto-creación de perfil propio (registro)
CREATE POLICY "perfiles_insert_own"
  ON perfiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- El dueño puede actualizar su propio perfil; admin puede actualizar cualquiera en su negocio
CREATE POLICY "perfiles_update_own_or_admin"
  ON perfiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      negocio_id = get_my_negocio_id()
      AND get_my_rol() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (true);

-- Solo admin puede eliminar perfiles de su negocio (no el suyo propio)
CREATE POLICY "perfiles_delete_admin"
  ON perfiles FOR DELETE TO authenticated
  USING (
    negocio_id = get_my_negocio_id()
    AND get_my_rol() IN ('admin', 'super_admin')
    AND user_id <> auth.uid()
  );


-- ── categorias ───────────────────────────────────────────────────────────

-- Todos (admin y cajero) pueden leer las categorías de su negocio
CREATE POLICY "categorias_select"
  ON categorias FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

-- Solo admin puede crear/editar/eliminar categorías
CREATE POLICY "categorias_insert_admin"
  ON categorias FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = get_my_negocio_id()
    AND get_my_rol() IN ('admin', 'super_admin')
  );

CREATE POLICY "categorias_update_admin"
  ON categorias FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "categorias_delete_admin"
  ON categorias FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── productos ────────────────────────────────────────────────────────────

-- Admin y cajero pueden leer productos (cajero necesita ver el catálogo en el POS)
CREATE POLICY "productos_select"
  ON productos FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

-- Solo admin puede crear productos
CREATE POLICY "productos_insert_admin"
  ON productos FOR INSERT TO authenticated
  WITH CHECK (
    negocio_id = get_my_negocio_id()
    AND get_my_rol() IN ('admin', 'super_admin')
  );

-- Solo admin puede editar productos (el trigger de stock usa SECURITY DEFINER
-- y no necesita que el cajero tenga UPDATE directo en esta tabla)
CREATE POLICY "productos_update_admin"
  ON productos FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "productos_delete_admin"
  ON productos FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── ventas ───────────────────────────────────────────────────────────────

-- Ambos roles pueden ver ventas de su negocio
CREATE POLICY "ventas_select"
  ON ventas FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

-- Ambos roles pueden crear ventas (el cajero opera el POS)
CREATE POLICY "ventas_insert"
  ON ventas FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id());

-- Solo admin puede editar o eliminar ventas
CREATE POLICY "ventas_update_admin"
  ON ventas FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "ventas_delete_admin"
  ON ventas FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── venta_items ──────────────────────────────────────────────────────────

CREATE POLICY "venta_items_select"
  ON venta_items FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

-- Cajero inserta items al procesar una venta
CREATE POLICY "venta_items_insert"
  ON venta_items FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "venta_items_update_admin"
  ON venta_items FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "venta_items_delete_admin"
  ON venta_items FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── proveedores ──────────────────────────────────────────────────────────

-- Solo admin tiene acceso a proveedores
CREATE POLICY "proveedores_select_admin"
  ON proveedores FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "proveedores_insert_admin"
  ON proveedores FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "proveedores_update_admin"
  ON proveedores FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "proveedores_delete_admin"
  ON proveedores FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── compras_proveedor ────────────────────────────────────────────────────

CREATE POLICY "compras_select_admin"
  ON compras_proveedor FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "compras_insert_admin"
  ON compras_proveedor FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "compras_update_admin"
  ON compras_proveedor FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "compras_delete_admin"
  ON compras_proveedor FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── compra_items ─────────────────────────────────────────────────────────

CREATE POLICY "compra_items_select_admin"
  ON compra_items FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "compra_items_insert_admin"
  ON compra_items FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "compra_items_update_admin"
  ON compra_items FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id());

CREATE POLICY "compra_items_delete_admin"
  ON compra_items FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── arqueos_caja ─────────────────────────────────────────────────────────

-- Cajero puede ver los arqueos de su negocio (para saber si la caja está abierta)
CREATE POLICY "arqueos_select"
  ON arqueos_caja FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

-- Cajero puede abrir/cerrar su propia caja
CREATE POLICY "arqueos_insert_own"
  ON arqueos_caja FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id() AND auth.uid() = usuario_id);

-- El dueño del arqueo o un admin pueden actualizarlo (cierre)
CREATE POLICY "arqueos_update_own_or_admin"
  ON arqueos_caja FOR UPDATE TO authenticated
  USING (
    negocio_id = get_my_negocio_id()
    AND (
      auth.uid() = usuario_id
      OR get_my_rol() IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (true);

-- Solo admin elimina arqueos
CREATE POLICY "arqueos_delete_admin"
  ON arqueos_caja FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── contadores_comprobantes ──────────────────────────────────────────────
-- Cajero puede usar comprobantes en el POS (factura_x, etc.)

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


-- ── negocio_config ───────────────────────────────────────────────────────

CREATE POLICY "negocio_config_select"
  ON negocio_config FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

CREATE POLICY "negocio_config_write_admin"
  ON negocio_config FOR ALL TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ── configuracion_ticket ─────────────────────────────────────────────────

CREATE POLICY "config_ticket_select"
  ON configuracion_ticket FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

CREATE POLICY "config_ticket_write_admin"
  ON configuracion_ticket FOR ALL TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));


-- ============================================================
-- VERIFICACIÓN RÁPIDA
-- ============================================================
--
-- Ejecutar después para confirmar:
--
--   SELECT id, nombre FROM negocios;
--
--   SELECT nombre, rol, negocio_id IS NOT NULL AS tiene_negocio_id
--   FROM perfiles ORDER BY created_at;
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- ============================================================


-- ============================================================
-- ROLLBACK — ejecutar solo si algo falla
-- ============================================================
--
-- -- Eliminar funciones y triggers nuevos
-- DROP FUNCTION IF EXISTS public.get_my_negocio_id();
-- DROP FUNCTION IF EXISTS public.get_my_rol();
-- DROP FUNCTION IF EXISTS public.auto_set_negocio_id() CASCADE;
--
-- -- Eliminar columna negocio_id de todas las tablas
-- ALTER TABLE perfiles               DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE categorias             DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE productos               DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE proveedores             DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE ventas                  DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE venta_items             DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE compras_proveedor       DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE compra_items            DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE arqueos_caja            DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE contadores_comprobantes DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE negocio_config          DROP COLUMN IF EXISTS negocio_id;
-- ALTER TABLE configuracion_ticket    DROP COLUMN IF EXISTS negocio_id;
--
-- -- Eliminar tabla negocios
-- DROP TABLE IF EXISTS negocios;
--
-- -- Volver al constraint de rol original
-- ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
-- ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check CHECK (rol IN ('super_admin', 'admin', 'empleado'));
--
-- -- Recrear las políticas originales (ver migration_roles.sql y 20260526000001_enable_rls.sql)
-- ============================================================
