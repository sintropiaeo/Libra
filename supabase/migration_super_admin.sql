-- ================================================================
-- MIGRACIÓN: Rol super_admin
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Permitir el nuevo valor 'super_admin' en la columna rol
--    (Si hay un check constraint, lo actualizamos)
ALTER TABLE perfiles
  DROP CONSTRAINT IF EXISTS perfiles_rol_check;

ALTER TABLE perfiles
  ADD CONSTRAINT perfiles_rol_check
  CHECK (rol IN ('super_admin', 'admin', 'empleado'));

-- 2. Asignar rol super_admin a la cuenta del propietario del sistema
UPDATE perfiles
SET rol = 'super_admin'
WHERE email = 'educeledon98@gmail.com';
