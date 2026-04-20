-- ================================================================
-- MIGRACIÓN: Campo permitir_venta_sin_stock en productos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS permitir_venta_sin_stock BOOLEAN NOT NULL DEFAULT FALSE;
