-- ─── Tabla: configuracion_ticket ─────────────────────────────────────────────
-- Registro único global (singleton) con la configuración de los tickets de venta.

CREATE TABLE IF NOT EXISTS configuracion_ticket (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_comercio     text        NOT NULL DEFAULT '',
  direccion           text        NOT NULL DEFAULT '',
  cuit                text        NOT NULL DEFAULT '',
  condicion_iva       text        NOT NULL DEFAULT 'Responsable Inscripto',
  telefono            text,
  logo_url            text,
  ancho_papel         text        NOT NULL DEFAULT '80mm'
                                  CHECK (ancho_papel IN ('58mm', '80mm')),
  mostrar_logo        boolean     NOT NULL DEFAULT false,
  mostrar_cuit        boolean     NOT NULL DEFAULT true,
  mostrar_telefono    boolean     NOT NULL DEFAULT true,
  mostrar_direccion   boolean     NOT NULL DEFAULT true,
  mensaje_pie         text,
  mostrar_vendedor    boolean     NOT NULL DEFAULT false,
  copias_a_imprimir   integer     NOT NULL DEFAULT 1
                                  CHECK (copias_a_imprimir BETWEEN 1 AND 5),
  created_at          timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE configuracion_ticket ENABLE ROW LEVEL SECURITY;

-- Todos los usuarios autenticados pueden leer (el POS lo necesita)
CREATE POLICY "authenticated_read_config_ticket"
  ON configuracion_ticket FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Solo admin/super_admin pueden escribir (los server actions usan service role,
-- pero la policy protege ante accesos directos no autorizados)
CREATE POLICY "admins_write_config_ticket"
  ON configuracion_ticket FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id  = auth.uid()
        AND rol      IN ('admin', 'super_admin')
        AND activo   = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id  = auth.uid()
        AND rol      IN ('admin', 'super_admin')
        AND activo   = true
    )
  );

-- Fila inicial con valores por defecto
INSERT INTO configuracion_ticket (
  nombre_comercio, direccion, cuit, condicion_iva,
  ancho_papel, mostrar_logo, mostrar_cuit, mostrar_telefono,
  mostrar_direccion, mensaje_pie, mostrar_vendedor, copias_a_imprimir
)
VALUES (
  '', '', '', 'Responsable Inscripto',
  '80mm', false, true, true,
  true, '¡Gracias por su compra!', false, 1
);
