-- Índice de texto (trigram) para la búsqueda de productos.
--
-- Problema: la búsqueda del POS y del listado de /productos usa
-- ilike('%texto%') — comodín AL PRINCIPIO. Postgres no puede usar un índice
-- normal (B-tree) para eso: recorre la tabla productos entera fila por fila
-- en cada búsqueda (~32.000 filas hoy). Con pg_trgm + un índice GIN, ese
-- mismo ilike '%texto%' pasa a resolverse en milisegundos.
--
-- No requiere tocar código de la app: Postgres empieza a usar el índice
-- solo, automáticamente, apenas existe.
--
-- CÓMO APLICAR (importante):
-- Pegar y ejecutar cada bloque POR SEPARADO en el SQL Editor de Supabase
-- (un "Run" por bloque, no los 3 juntos de una). El motivo es que
-- CREATE INDEX CONCURRENTLY no puede correr dentro de una transacción, y el
-- editor de Supabase mete todo lo que pegás de una en una sola transacción
-- si son varias sentencias.

-- ── Bloque 1 — habilitar la extensión (una sola vez por proyecto) ──────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Bloque 2 — índice sobre nombre ──────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_nombre_trgm
  ON productos USING gin (nombre gin_trgm_ops);

-- ── Bloque 3 — índice sobre codigo_interno (también se busca con ilike) ────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productos_codigo_interno_trgm
  ON productos USING gin (codigo_interno gin_trgm_ops);
