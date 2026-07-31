-- ================================================================
-- MIGRACIÓN: Presentaciones de producto (FASE 1 — solo estructura)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================
-- Presentaciones de un mismo producto (Unidad, Blister x10, Caja x100)
-- que comparten el stock real del producto base. El descuento de stock
-- usa cantidad_base como factor de conversión.
--
-- SEGURIDAD: 100% aditivo. ADD COLUMN nullable sin default (metadata,
-- sin reescritura de filas). CREATE OR REPLACE no re-ejecuta triggers
-- sobre filas existentes. presentacion_id NULL => factor 1 => idéntico
-- al comportamiento actual. No toca stock ni datos existentes.
--
-- Reglas de arquitectura: negocio_id NOT NULL, RLS por negocio + rol
-- admin en escritura, UNIQUE(negocio_id, codigo_barras) parcial.
-- ================================================================


-- ============================================================
-- BLOQUE 1: Tabla producto_presentaciones + índices + RLS
-- ============================================================
BEGIN;

CREATE TABLE producto_presentaciones (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid          NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  nombre        text          NOT NULL,
  cantidad_base integer       NOT NULL CHECK (cantidad_base > 0),
  precio_venta  numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  codigo_barras text,
  activo        boolean       NOT NULL DEFAULT true,
  negocio_id    uuid          NOT NULL REFERENCES negocios(id),
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX idx_presentaciones_producto ON producto_presentaciones (producto_id);
CREATE INDEX idx_presentaciones_negocio  ON producto_presentaciones (negocio_id);

CREATE UNIQUE INDEX idx_presentaciones_negocio_barras
  ON producto_presentaciones (negocio_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL;

CREATE TRIGGER trg_presentaciones_updated_at
  BEFORE UPDATE ON producto_presentaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE producto_presentaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presentaciones_select"
  ON producto_presentaciones FOR SELECT TO authenticated
  USING (negocio_id = get_my_negocio_id());

CREATE POLICY "presentaciones_insert_admin"
  ON producto_presentaciones FOR INSERT TO authenticated
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "presentaciones_update_admin"
  ON producto_presentaciones FOR UPDATE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'))
  WITH CHECK (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

CREATE POLICY "presentaciones_delete_admin"
  ON producto_presentaciones FOR DELETE TO authenticated
  USING (negocio_id = get_my_negocio_id() AND get_my_rol() IN ('admin', 'super_admin'));

COMMIT;


-- ============================================================
-- BLOQUE 2: Columna presentacion_id en venta_items y compra_items
-- ============================================================
BEGIN;

ALTER TABLE venta_items
  ADD COLUMN presentacion_id uuid REFERENCES producto_presentaciones(id) ON DELETE RESTRICT;

ALTER TABLE compra_items
  ADD COLUMN presentacion_id uuid REFERENCES producto_presentaciones(id) ON DELETE RESTRICT;

CREATE INDEX idx_venta_items_presentacion  ON venta_items  (presentacion_id);
CREATE INDEX idx_compra_items_presentacion ON compra_items (presentacion_id);

COMMIT;


-- ============================================================
-- BLOQUE 3: Triggers de stock con factor de conversión
--    presentacion_id NULL -> factor 1 (idéntico a hoy)
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION ajustar_stock_por_venta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_unidades integer;
  v_new_unidades integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_unidades := NEW.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = NEW.presentacion_id), 1);
    UPDATE productos SET stock_actual = stock_actual - v_new_unidades WHERE id = NEW.producto_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_unidades := OLD.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = OLD.presentacion_id), 1);
    v_new_unidades := NEW.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = NEW.presentacion_id), 1);
    IF OLD.producto_id = NEW.producto_id THEN
      UPDATE productos SET stock_actual = stock_actual + v_old_unidades - v_new_unidades
        WHERE id = NEW.producto_id;
    ELSE
      UPDATE productos SET stock_actual = stock_actual + v_old_unidades WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual - v_new_unidades WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_unidades := OLD.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = OLD.presentacion_id), 1);
    UPDATE productos SET stock_actual = stock_actual + v_old_unidades WHERE id = OLD.producto_id;
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
DECLARE
  v_old_unidades integer;
  v_new_unidades integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_unidades := NEW.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = NEW.presentacion_id), 1);
    UPDATE productos SET stock_actual = stock_actual + v_new_unidades WHERE id = NEW.producto_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_unidades := OLD.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = OLD.presentacion_id), 1);
    v_new_unidades := NEW.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = NEW.presentacion_id), 1);
    IF OLD.producto_id = NEW.producto_id THEN
      UPDATE productos SET stock_actual = stock_actual - v_old_unidades + v_new_unidades
        WHERE id = NEW.producto_id;
    ELSE
      UPDATE productos SET stock_actual = stock_actual - v_old_unidades WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual + v_new_unidades WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_unidades := OLD.cantidad * COALESCE(
      (SELECT cantidad_base FROM producto_presentaciones WHERE id = OLD.presentacion_id), 1);
    UPDATE productos SET stock_actual = stock_actual - v_old_unidades WHERE id = OLD.producto_id;
    RETURN OLD;
  END IF;
END;
$$;

COMMIT;
