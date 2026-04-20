-- ================================================================
-- MIGRACIÓN: Arqueo de Caja
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS arqueos_caja (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           uuid          NOT NULL REFERENCES auth.users(id),
  usuario_nombre       text          NOT NULL,
  fecha_apertura       timestamptz   NOT NULL DEFAULT now(),
  fecha_cierre         timestamptz,
  monto_inicial        numeric(12,2) NOT NULL DEFAULT 0,
  monto_final_esperado numeric(12,2),
  monto_final_real     numeric(12,2),
  diferencia           numeric(12,2),
  observaciones        text,
  estado               text          NOT NULL DEFAULT 'abierta'
                                     CHECK (estado IN ('abierta', 'cerrada')),
  created_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE arqueos_caja ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver los arqueos
CREATE POLICY "arqueos_select_authenticated" ON arqueos_caja
  FOR SELECT TO authenticated USING (true);

-- Solo el dueño puede insertar
CREATE POLICY "arqueos_insert_own" ON arqueos_caja
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

-- El dueño o un admin pueden actualizar (cierre de caja)
CREATE POLICY "arqueos_update_own_or_admin" ON arqueos_caja
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = usuario_id OR
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE user_id = auth.uid() AND rol = 'admin'
    )
  );
