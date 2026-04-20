-- ================================================================
-- MIGRACIÓN: Configuración de dispositivos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

ALTER TABLE negocio_config
  ADD COLUMN IF NOT EXISTS imprimir_ticket_auto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tamano_ticket         TEXT    NOT NULL DEFAULT '80mm',
  ADD COLUMN IF NOT EXISTS sonido_escaneo        BOOLEAN NOT NULL DEFAULT FALSE;
