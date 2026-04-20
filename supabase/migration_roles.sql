-- ================================================================
-- MIGRACIÓN: Sistema de Roles y Permisos + Configuración
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- ─── 1. Tabla de perfiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perfiles (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  email       text        NOT NULL,
  rol         text        NOT NULL DEFAULT 'empleado'
                          CHECK (rol IN ('admin', 'empleado')),
  permisos    jsonb       NOT NULL DEFAULT '{
    "dashboard": true,
    "productos": "ver",
    "ventas": true,
    "proveedores": false,
    "compras": "sin_acceso",
    "reportes": false
  }',
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer todos los perfiles
-- (necesario para que el layout/sidebar funcione)
CREATE POLICY "perfiles_select_authenticated"
  ON perfiles FOR SELECT TO authenticated
  USING (true);

-- Los usuarios pueden insertar su propio perfil (auto-creación)
CREATE POLICY "perfiles_insert_own"
  ON perfiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── 2. Tabla de configuración del negocio ───────────────────────────────
CREATE TABLE IF NOT EXISTS negocio_config (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text        NOT NULL DEFAULT 'Mi Librería',
  direccion     text        NOT NULL DEFAULT '',
  telefono      text        NOT NULL DEFAULT '',
  logo_url      text        NOT NULL DEFAULT '',
  metodos_pago  text[]      NOT NULL DEFAULT ARRAY['efectivo','transferencia','debito','credito'],
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE negocio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "negocio_config_select_authenticated"
  ON negocio_config FOR SELECT TO authenticated
  USING (true);

-- Insertar configuración por defecto (singleton)
INSERT INTO negocio_config (nombre)
VALUES ('Mi Librería');

-- ─── 3. Registrar al admin (el primer usuario de la cuenta) ──────────────
-- Esto convierte al usuario con el email educeledon98@gmail.com en admin.
-- Si querés usar otro email, cambialo acá.
INSERT INTO perfiles (user_id, nombre, email, rol, permisos)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'nombre', split_part(email, '@', 1)),
  email,
  'admin',
  '{}'::jsonb  -- admin vacío = acceso total (se controla por rol)
FROM auth.users
WHERE email = 'educeledon98@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET rol = 'admin', permisos = '{}'::jsonb;

-- ─── 4. Bucket de logos en Storage ──────────────────────────────────────
-- Ejecutar esto también para crear el bucket de logos:
-- (O crearlo manualmente en Storage → New bucket → "logos" → Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "logos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

CREATE POLICY "logos_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "logos_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos');
