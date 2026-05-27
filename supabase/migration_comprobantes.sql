-- Columnas en ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS tipo_comprobante text NOT NULL DEFAULT 'ticket',
  ADD COLUMN IF NOT EXISTS numero_comprobante text,
  ADD COLUMN IF NOT EXISTS datos_cliente jsonb;

-- Tabla de contadores por tipo de comprobante
CREATE TABLE IF NOT EXISTS contadores_comprobantes (
  tipo          text PRIMARY KEY,
  ultimo_numero integer NOT NULL DEFAULT 0
);

-- Seed: tipo factura_x
INSERT INTO contadores_comprobantes (tipo, ultimo_numero)
VALUES ('factura_x', 0)
ON CONFLICT (tipo) DO NOTHING;

-- Función atómica para obtener el siguiente número correlativo
CREATE OR REPLACE FUNCTION siguiente_numero_comprobante(p_tipo text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero integer;
BEGIN
  INSERT INTO contadores_comprobantes (tipo, ultimo_numero)
  VALUES (p_tipo, 1)
  ON CONFLICT (tipo) DO UPDATE
    SET ultimo_numero = contadores_comprobantes.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_numero;
  RETURN v_numero;
END;
$$;
