-- =============================================
-- MIGRACIÓN INICIAL — Libra
-- Tablas, índices y triggers de stock
-- =============================================


-- ─── Tipos enumerados ─────────────────────────────────────────────────────────

CREATE TYPE unidad_tipo AS ENUM ('unidad', 'pack', 'resma', 'metro');

CREATE TYPE metodo_pago_tipo AS ENUM ('efectivo', 'transferencia', 'debito', 'credito');


-- ─── categorias ───────────────────────────────────────────────────────────────

CREATE TABLE categorias (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);


-- ─── productos ────────────────────────────────────────────────────────────────

CREATE TABLE productos (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text          NOT NULL,
  descripcion   text,
  categoria_id  uuid          REFERENCES categorias(id) ON DELETE SET NULL,
  precio_costo  numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio_costo >= 0),
  precio_venta  numeric(10,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  stock_actual  integer       NOT NULL DEFAULT 0,
  stock_minimo  integer       NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
  codigo_barras text          UNIQUE,
  unidad        unidad_tipo   NOT NULL DEFAULT 'unidad',
  activo        boolean       NOT NULL DEFAULT true,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now()
);


-- ─── proveedores ──────────────────────────────────────────────────────────────

CREATE TABLE proveedores (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ─── ventas ───────────────────────────────────────────────────────────────────

CREATE TABLE ventas (
  id          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       timestamptz      NOT NULL DEFAULT now(),
  total       numeric(10,2)    NOT NULL DEFAULT 0 CHECK (total >= 0),
  metodo_pago metodo_pago_tipo NOT NULL DEFAULT 'efectivo',
  notas       text,
  created_at  timestamptz      NOT NULL DEFAULT now()
);


-- ─── venta_items ──────────────────────────────────────────────────────────────

CREATE TABLE venta_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        uuid          NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id     uuid          NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        integer       NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);


-- ─── compras_proveedor ────────────────────────────────────────────────────────

CREATE TABLE compras_proveedor (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid          REFERENCES proveedores(id) ON DELETE SET NULL,
  fecha        timestamptz   NOT NULL DEFAULT now(),
  total        numeric(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  notas        text,
  created_at   timestamptz   NOT NULL DEFAULT now()
);


-- ─── compra_items ─────────────────────────────────────────────────────────────

CREATE TABLE compra_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id       uuid          NOT NULL REFERENCES compras_proveedor(id) ON DELETE CASCADE,
  producto_id     uuid          NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad        integer       NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal        numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);


-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_productos_categoria    ON productos (categoria_id);
CREATE INDEX idx_productos_activo       ON productos (activo);
CREATE INDEX idx_ventas_fecha           ON ventas (fecha);
CREATE INDEX idx_venta_items_venta      ON venta_items (venta_id);
CREATE INDEX idx_venta_items_producto   ON venta_items (producto_id);
CREATE INDEX idx_compras_proveedor_id   ON compras_proveedor (proveedor_id);
CREATE INDEX idx_compras_fecha          ON compras_proveedor (fecha);
CREATE INDEX idx_compra_items_compra    ON compra_items (compra_id);
CREATE INDEX idx_compra_items_producto  ON compra_items (producto_id);


-- ─── Trigger: updated_at automático en productos ──────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── Trigger: stock baja al vender ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ajustar_stock_por_venta()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE productos
      SET stock_actual = stock_actual - NEW.cantidad
      WHERE id = NEW.producto_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.producto_id = NEW.producto_id THEN
      -- Mismo producto, ajustar la diferencia
      UPDATE productos
        SET stock_actual = stock_actual + OLD.cantidad - NEW.cantidad
        WHERE id = NEW.producto_id;
    ELSE
      -- Cambió el producto: devolver al anterior y descontar del nuevo
      UPDATE productos SET stock_actual = stock_actual + OLD.cantidad WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual - NEW.cantidad WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE productos
      SET stock_actual = stock_actual + OLD.cantidad
      WHERE id = OLD.producto_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_por_venta
  AFTER INSERT OR UPDATE OR DELETE ON venta_items
  FOR EACH ROW EXECUTE FUNCTION ajustar_stock_por_venta();


-- ─── Trigger: stock sube al comprar mercadería ────────────────────────────────

CREATE OR REPLACE FUNCTION ajustar_stock_por_compra()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE productos
      SET stock_actual = stock_actual + NEW.cantidad
      WHERE id = NEW.producto_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.producto_id = NEW.producto_id THEN
      -- Mismo producto, ajustar la diferencia
      UPDATE productos
        SET stock_actual = stock_actual - OLD.cantidad + NEW.cantidad
        WHERE id = NEW.producto_id;
    ELSE
      -- Cambió el producto: revertir el anterior y sumar al nuevo
      UPDATE productos SET stock_actual = stock_actual - OLD.cantidad WHERE id = OLD.producto_id;
      UPDATE productos SET stock_actual = stock_actual + NEW.cantidad WHERE id = NEW.producto_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE productos
      SET stock_actual = stock_actual - OLD.cantidad
      WHERE id = OLD.producto_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_por_compra
  AFTER INSERT OR UPDATE OR DELETE ON compra_items
  FOR EACH ROW EXECUTE FUNCTION ajustar_stock_por_compra();
