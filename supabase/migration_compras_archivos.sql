-- ================================================================
-- MIGRACIÓN: Archivos adjuntos en compras
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Columnas en la tabla de compras
ALTER TABLE compras_proveedor
  ADD COLUMN IF NOT EXISTS archivo_path   TEXT,
  ADD COLUMN IF NOT EXISTS archivo_nombre TEXT;

-- 2. Crear bucket de storage (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'compras-archivos',
  'compras-archivos',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para el bucket
CREATE POLICY "Autenticados pueden subir archivos de compras"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'compras-archivos');

CREATE POLICY "Autenticados pueden leer archivos de compras"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'compras-archivos');

CREATE POLICY "Autenticados pueden eliminar archivos de compras"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'compras-archivos');
