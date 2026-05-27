-- ============================================================
-- MIGRACIÓN: Habilitar Row Level Security en todas las tablas
-- Proyecto: Libra — single-tenant, acceso solo para autenticados
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-05-26
-- ============================================================
--
-- ESTRATEGIA:
--   - Single-tenant: no hay separación por organización ni por fila.
--   - Las policies solo garantizan que ningún visitante anónimo
--     pueda leer o escribir datos vía la API pública.
--   - El control de roles (admin / empleado / super_admin) se
--     aplica en los server actions de Next.js, no aquí.
--   - Para tablas que ya tenían RLS parcial se agregan solo las
--     policies faltantes (sin tocar las existentes).
--
-- NOTA PREVIA: si la app deja de funcionar después de aplicar
-- esto, lo más probable es que alguna query esté usando la
-- anon key en vez de la sesión del usuario. Ver rollback al final.
-- ============================================================


-- ============================================================
-- SECCIÓN 1: Tablas SIN RLS → habilitar + 4 policies completas
-- ============================================================


-- ─── categorias ──────────────────────────────────────────────

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_categorias"
  ON categorias FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_categorias"
  ON categorias FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_categorias"
  ON categorias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_categorias"
  ON categorias FOR DELETE TO authenticated USING (true);


-- ─── productos ───────────────────────────────────────────────
-- UPDATE es necesario también para que los triggers de stock
-- (ajustar_stock_por_venta / ajustar_stock_por_compra) puedan
-- decrementar/incrementar stock_actual bajo el JWT del usuario.

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_productos"
  ON productos FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_productos"
  ON productos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_productos"
  ON productos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_productos"
  ON productos FOR DELETE TO authenticated USING (true);


-- ─── proveedores ─────────────────────────────────────────────

ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_proveedores"
  ON proveedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_proveedores"
  ON proveedores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_proveedores"
  ON proveedores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_proveedores"
  ON proveedores FOR DELETE TO authenticated USING (true);


-- ─── ventas ──────────────────────────────────────────────────

ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_ventas"
  ON ventas FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_ventas"
  ON ventas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_ventas"
  ON ventas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_ventas"
  ON ventas FOR DELETE TO authenticated USING (true);


-- ─── venta_items ─────────────────────────────────────────────
-- Los triggers de stock (SECURITY INVOKER) actúan bajo el JWT
-- del usuario; la policy de UPDATE en productos ya los cubre.

ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_venta_items"
  ON venta_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_venta_items"
  ON venta_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_venta_items"
  ON venta_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_venta_items"
  ON venta_items FOR DELETE TO authenticated USING (true);


-- ─── compras_proveedor ───────────────────────────────────────

ALTER TABLE compras_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_compras_proveedor"
  ON compras_proveedor FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_compras_proveedor"
  ON compras_proveedor FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_compras_proveedor"
  ON compras_proveedor FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_compras_proveedor"
  ON compras_proveedor FOR DELETE TO authenticated USING (true);


-- ─── compra_items ────────────────────────────────────────────

ALTER TABLE compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_compra_items"
  ON compra_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_compra_items"
  ON compra_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_compra_items"
  ON compra_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_compra_items"
  ON compra_items FOR DELETE TO authenticated USING (true);


-- ─── contadores_comprobantes ─────────────────────────────────
-- La función siguiente_numero_comprobante() es SECURITY INVOKER
-- (sin SECURITY DEFINER), por lo que su INSERT ON CONFLICT DO UPDATE
-- corre con el JWT del usuario llamante y está sujeto a RLS.

ALTER TABLE contadores_comprobantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_contadores_comprobantes"
  ON contadores_comprobantes FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_contadores_comprobantes"
  ON contadores_comprobantes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "auth_update_contadores_comprobantes"
  ON contadores_comprobantes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_delete_contadores_comprobantes"
  ON contadores_comprobantes FOR DELETE TO authenticated USING (true);


-- ============================================================
-- SECCIÓN 2: Tablas CON RLS parcial → agregar policies faltantes
-- ============================================================


-- ─── perfiles (tenía: SELECT, INSERT own) ────────────────────
-- Se agrega UPDATE: el propio usuario puede editar su perfil,
-- y admin/super_admin pueden editar cualquiera.
-- Se agrega DELETE: solo admin/super_admin pueden eliminar perfiles.

CREATE POLICY "perfiles_update_own_or_admin"
  ON perfiles FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.user_id = auth.uid()
        AND p.rol IN ('admin', 'super_admin')
        AND p.activo = true
    )
  )
  WITH CHECK (true);

CREATE POLICY "perfiles_delete_admin"
  ON perfiles FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles p
      WHERE p.user_id = auth.uid()
        AND p.rol IN ('admin', 'super_admin')
        AND p.activo = true
    )
  );


-- ─── negocio_config (tenía: SELECT) ──────────────────────────
-- Solo admin/super_admin pueden escribir (la config del negocio).

CREATE POLICY "negocio_config_write_admin"
  ON negocio_config FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'super_admin')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'super_admin')
        AND activo = true
    )
  );


-- ─── arqueos_caja (tenía: SELECT, INSERT own, UPDATE own/admin) ─
-- Se agrega DELETE: solo admin/super_admin pueden eliminar arqueos.

CREATE POLICY "arqueos_delete_admin"
  ON arqueos_caja FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id = auth.uid()
        AND rol IN ('admin', 'super_admin')
        AND activo = true
    )
  );


-- ============================================================
-- VERIFICACIÓN RÁPIDA (ejecutar después para confirmar)
-- ============================================================
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- Todas las filas deben mostrar rowsecurity = true.
--
-- Para ver las policies activas:
--
--   SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
--
-- ============================================================


-- ============================================================
-- ROLLBACK — ejecutar solo si algo falla
-- ============================================================
--
-- Tablas que ahora tienen RLS (revertir a sin RLS):
--
--   ALTER TABLE categorias           DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE productos            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE proveedores          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE ventas               DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE venta_items          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE compras_proveedor    DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE compra_items         DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE contadores_comprobantes DISABLE ROW LEVEL SECURITY;
--
-- Policies nuevas en tablas que ya tenían RLS:
--
--   DROP POLICY IF EXISTS "perfiles_update_own_or_admin" ON perfiles;
--   DROP POLICY IF EXISTS "perfiles_delete_admin"        ON perfiles;
--   DROP POLICY IF EXISTS "negocio_config_write_admin"   ON negocio_config;
--   DROP POLICY IF EXISTS "arqueos_delete_admin"         ON arqueos_caja;
--
-- ============================================================
