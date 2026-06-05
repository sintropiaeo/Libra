-- ================================================================
-- SEED: Negocio demo — Librería Demo Sintropia
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Requiere: migration_demo.sql ya aplicado
-- ================================================================
--
-- PASOS MANUALES PREVIOS (hacer ANTES de correr este script):
--
-- 1. En Supabase Dashboard → Authentication → Users → Add user:
--       Email:    demo@sintropia.ar
--       Password: Demo1234!
--       ✅ Auto Confirm User
--    Anotá el UUID del usuario creado (lo llamamos USER_UUID)
--
-- 2. Correr este script completo en SQL Editor.
--    El script inserta el perfil del usuario demo automáticamente
--    buscándolo por email en auth.users.
--
-- ================================================================

DO $$
DECLARE
  -- IDs principales
  v_negocio_id   uuid;
  v_user_id      uuid;

  -- Categorías
  v_cat_utiles   uuid;
  v_cat_escrit   uuid;
  v_cat_arte     uuid;
  v_cat_papel    uuid;
  v_cat_libros   uuid;
  v_cat_serv     uuid;
  v_cat_varios   uuid;

  -- Productos favoritos (8 más vendidos)
  v_fotobyn      uuid;
  v_lapbic_az    uuid;
  v_resma        uuid;
  v_cua_td       uuid;
  v_cua_tb       uuid;
  v_fotocolor    uuid;
  v_anillado     uuid;
  v_resalt       uuid;

  -- Todos los productos para generar ventas
  v_todos        uuid[];

  -- Variables de ventas
  v_dia          date;
  v_hora         timestamptz;
  v_venta_id     uuid;
  v_producto_id  uuid;
  v_precio       numeric(10,2);
  v_qty          int;
  v_total        numeric(10,2);
  v_metodo       text;
  v_num_ventas   int;
  v_num_items    int;
  v_idx          int;

BEGIN

-- ============================================================
-- SECCIÓN 1: Negocio demo
-- ============================================================

INSERT INTO negocios (nombre, is_demo)
VALUES ('Demo Sintropia', true)
RETURNING id INTO v_negocio_id;

-- Configuración del negocio
INSERT INTO negocio_config (
  nombre, direccion, telefono, logo_url,
  metodos_pago, imprimir_ticket_auto, tamano_ticket, sonido_escaneo,
  negocio_id
)
VALUES (
  'Librería Demo',
  'Av. Corrientes 1234, Buenos Aires',
  '+54 11 4567-8900',
  '',
  ARRAY['efectivo','transferencia','debito','credito'],
  false, '80mm', true,
  v_negocio_id
);

-- Configuración de tickets
INSERT INTO configuracion_ticket (
  nombre_comercio, direccion, cuit, condicion_iva, telefono,
  ancho_papel, mostrar_logo, mostrar_cuit, mostrar_telefono,
  mostrar_direccion, mensaje_pie, mostrar_vendedor, copias_a_imprimir,
  negocio_id
)
VALUES (
  'Librería Demo',
  'Av. Corrientes 1234, Buenos Aires',
  '00-00000000-0',
  'Responsable Inscripto',
  '+54 11 4567-8900',
  '80mm', false, false, true, true,
  '¡Gracias por su compra!',
  false, 1,
  v_negocio_id
);


-- ============================================================
-- SECCIÓN 2: Usuario demo
-- ============================================================

-- Buscar el usuario creado manualmente en Supabase Auth
SELECT id INTO v_user_id
FROM auth.users
WHERE email = 'demo@sintropia.ar'
LIMIT 1;

IF v_user_id IS NULL THEN
  RAISE EXCEPTION 'Usuario demo@sintropia.ar no encontrado en auth.users. '
    'Crealo primero desde el Dashboard → Authentication → Users.';
END IF;

INSERT INTO perfiles (user_id, nombre, email, rol, permisos, activo, negocio_id)
VALUES (
  v_user_id,
  'Admin Demo',
  'demo@sintropia.ar',
  'admin',
  '{}'::jsonb,
  true,
  v_negocio_id
);


-- ============================================================
-- SECCIÓN 3: Categorías
-- ============================================================

INSERT INTO categorias (nombre, negocio_id) VALUES ('Útiles escolares', v_negocio_id) RETURNING id INTO v_cat_utiles;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Escritura',         v_negocio_id) RETURNING id INTO v_cat_escrit;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Arte',              v_negocio_id) RETURNING id INTO v_cat_arte;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Papel',             v_negocio_id) RETURNING id INTO v_cat_papel;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Libros y agendas',  v_negocio_id) RETURNING id INTO v_cat_libros;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Servicios',         v_negocio_id) RETURNING id INTO v_cat_serv;
INSERT INTO categorias (nombre, negocio_id) VALUES ('Cotillón y varios', v_negocio_id) RETURNING id INTO v_cat_varios;


-- ============================================================
-- SECCIÓN 4: Productos (44 ítems)
-- ============================================================
-- Precios en pesos argentinos 2024.
-- Los 8 favoritos se identifican explícitamente.
-- stock_actual alto para absorber las ventas del seed sin llegar a 0.

-- ── Útiles escolares ──────────────────────────────────────────

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Cuaderno Rivadavia tapa dura A4 rayado', '48 hojas rayado', v_cat_utiles, 1200, 1900, 250, 30, 'CUA-001', 'unidad', true, true, v_negocio_id)
RETURNING id INTO v_cua_td;

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Cuaderno Rivadavia tapa blanda A4 cuadriculado', '48 hojas cuadriculado', v_cat_utiles, 900, 1500, 250, 30, 'CUA-002', 'unidad', true, true, v_negocio_id)
RETURNING id INTO v_cua_tb;

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Carpeta 3 anillos A4 azul', v_cat_utiles, 1800, 2900, 100, 10, 'CAR-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Carpeta 3 anillos A4 negra', v_cat_utiles, 1800, 2900, 100, 10, 'CAR-002', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Regla 30 cm plástica', v_cat_utiles, 200, 400, 120, 15, 'REG-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Compás metálico escolar', v_cat_utiles, 900, 1600, 60, 10, 'COM-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Cartuchera tela con cierre', v_cat_utiles, 2000, 3500, 70, 10, 'CTR-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Tijera escolar punta roma 13 cm', v_cat_utiles, 400, 800, 80, 10, 'TIJ-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Goma de borrar blanca grande', v_cat_utiles, 200, 400, 200, 20, 'GOM-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Corrector líquido 18 ml', v_cat_utiles, 600, 1100, 80, 10, 'COR-001', 'unidad', true, v_negocio_id);

-- ── Escritura ─────────────────────────────────────────────────

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Lapicera Bic Cristal azul', 'Punta media 1.0 mm', v_cat_escrit, 200, 400, 400, 50, 'LAP-001', 'unidad', true, true, v_negocio_id)
RETURNING id INTO v_lapbic_az;

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Lapicera Bic Cristal negro', v_cat_escrit, 200, 400, 300, 50, 'LAP-002', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Lápiz HB grafito Nro 2', v_cat_escrit, 150, 300, 250, 30, 'LPZ-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Marcador permanente negro', v_cat_escrit, 600, 1100, 120, 15, 'MAR-001', 'unidad', true, true, v_negocio_id)
RETURNING id INTO v_resalt; -- reutilizamos temporalmente

-- Reemplazamos v_resalt con resaltador
INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Resaltador amarillo', v_cat_escrit, 400, 750, 150, 20, 'RES-001', 'unidad', true, true, v_negocio_id)
RETURNING id INTO v_resalt;

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Fibras de color x12 surtidas', v_cat_escrit, 1200, 2200, 70, 10, 'FIB-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Lapicera gel azul punta fina', v_cat_escrit, 350, 650, 180, 25, 'GEL-001', 'unidad', true, v_negocio_id);

-- ── Arte ──────────────────────────────────────────────────────

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Acuarela escolar x12 colores', v_cat_arte, 900, 1700, 60, 8, 'ACU-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Tempera 200 ml rojo', v_cat_arte, 800, 1500, 50, 8, 'TEM-R01', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Tempera 200 ml azul', v_cat_arte, 800, 1500, 50, 8, 'TEM-A01', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Pincel redondo Nro 6', v_cat_arte, 400, 750, 70, 10, 'PIN-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Block de dibujo A4 x20 hojas', v_cat_arte, 700, 1300, 80, 10, 'BLK-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Plastilina x5 barras colores', v_cat_arte, 600, 1100, 60, 8, 'PLA-001', 'unidad', true, v_negocio_id);

-- ── Papel ─────────────────────────────────────────────────────

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, negocio_id)
VALUES ('Resma A4 500 hojas 75 g', 'Papel sulfito premium', v_cat_papel, 4000, 6500, 120, 15, 'RES-A4', 'resma', true, true, v_negocio_id)
RETURNING id INTO v_resma;

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Block de notas A5 rayado x80', v_cat_papel, 500, 900, 90, 10, 'BNT-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Papel glasé x10 colores surtidos', v_cat_papel, 600, 1100, 70, 8, 'PGL-001', 'pack', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Post-it 3x3 amarillo x100', v_cat_papel, 700, 1300, 80, 10, 'PST-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Papel kraft envoltura x5 m', v_cat_papel, 300, 600, 60, 8, 'ENV-001', 'metro', true, v_negocio_id);

-- ── Libros y agendas ──────────────────────────────────────────

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Diccionario escolar español', v_cat_libros, 2500, 4200, 35, 5, 'LIB-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Agenda anillada A5 2026', v_cat_libros, 1800, 3200, 45, 5, 'AGE-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Planificador semanal A5', v_cat_libros, 1400, 2500, 35, 5, 'PLA-AGE', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Atlas geográfico escolar', v_cat_libros, 3000, 5500, 25, 3, 'ATL-001', 'unidad', true, v_negocio_id);

-- ── Servicios (stock 9999 = ilimitado) ───────────────────────

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, permitir_venta_sin_stock, negocio_id)
VALUES ('Fotocopia B/N', 'Por hoja tamaño A4', v_cat_serv, 20, 50, 9999, 0, 'FTC-001', 'unidad', true, true, true, v_negocio_id)
RETURNING id INTO v_fotobyn;

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, permitir_venta_sin_stock, negocio_id)
VALUES ('Fotocopia color', 'Por hoja tamaño A4', v_cat_serv, 80, 200, 9999, 0, 'FTC-002', 'unidad', true, true, true, v_negocio_id)
RETURNING id INTO v_fotocolor;

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, es_favorito, permitir_venta_sin_stock, negocio_id)
VALUES ('Anillado hasta 50 hojas', 'Espiral plástico + tapa transparente', v_cat_serv, 400, 800, 9999, 0, 'ANI-001', 'unidad', true, true, true, v_negocio_id)
RETURNING id INTO v_anillado;

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, permitir_venta_sin_stock, negocio_id)
VALUES ('Plastificado A4', v_cat_serv, 600, 1200, 9999, 0, 'PLF-001', 'unidad', true, true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, permitir_venta_sin_stock, negocio_id)
VALUES ('Impresión A4 B/N', v_cat_serv, 40, 100, 9999, 0, 'IMP-001', 'unidad', true, true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, permitir_venta_sin_stock, negocio_id)
VALUES ('Encuadernado espiral A4', v_cat_serv, 700, 1500, 9999, 0, 'ENC-001', 'unidad', true, true, v_negocio_id);

-- ── Cotillón y varios ─────────────────────────────────────────

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Globos x25 colores surtidos', v_cat_varios, 600, 1100, 60, 8, 'COT-001', 'pack', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Cinta adhesiva transparente 18 mm', v_cat_varios, 300, 600, 100, 15, 'CIN-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Sacapuntas doble metálico', v_cat_varios, 150, 350, 180, 20, 'SAC-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Abrochadora metálica 26/6', v_cat_varios, 2500, 4500, 30, 5, 'ABR-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Caja grapas 26/6 x1000', v_cat_varios, 400, 700, 90, 10, 'GRA-001', 'caja', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Calculadora básica 12 dígitos', v_cat_varios, 4500, 8000, 30, 5, 'CAL-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Pizarra magnética pequeña 30x20', v_cat_varios, 3500, 6000, 25, 5, 'PIZ-001', 'unidad', true, v_negocio_id);

INSERT INTO productos (nombre, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, codigo_interno, unidad, activo, negocio_id)
VALUES ('Portafolio A4 rigido con solapa', v_cat_varios, 1600, 2800, 40, 5, 'PFO-001', 'unidad', true, v_negocio_id);


-- ============================================================
-- SECCIÓN 5: Armar arrays de productos para ventas
-- ============================================================

-- Favoritos primero (mayor peso en ventas)
-- Los 8 favoritos: v_fotobyn, v_lapbic_az, v_resma, v_cua_td,
--                  v_cua_tb, v_fotocolor, v_anillado, v_resalt

-- Array completo (los favoritos repetidos para mayor probabilidad)
v_todos := ARRAY[
  v_fotobyn,   v_lapbic_az, v_resma,    v_cua_td,
  v_cua_tb,    v_fotocolor, v_anillado, v_resalt,
  v_fotobyn,   v_lapbic_az, v_resma,    v_cua_td,  -- repetidos x2
  v_fotobyn,   v_fotocolor, v_lapbic_az, v_resalt,  -- repetidos x3
  -- productos no-favoritos
  (SELECT id FROM productos WHERE codigo_interno = 'CAR-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'REG-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'GOM-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'LAP-002' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'LPZ-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'MAR-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'BLK-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'BNT-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'COR-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'PLF-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'GEL-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'PST-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'FIB-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'ENC-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'SAC-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'CIN-001' AND negocio_id = v_negocio_id),
  (SELECT id FROM productos WHERE codigo_interno = 'AGE-001' AND negocio_id = v_negocio_id)
];


-- ============================================================
-- SECCIÓN 6: Historial de ventas — últimos 15 días
-- ============================================================
-- El trigger ajustar_stock_por_venta() correrá y reducirá el stock.
-- Al final capturamos stock_actual → stock_inicial para el reset.

FOR i IN 0..14 LOOP
  v_dia := CURRENT_DATE - (14 - i);

  -- 5-15 ventas por día (varía con el día)
  v_num_ventas := 5 + ((i * 7 + 3) % 11);

  FOR j IN 1..v_num_ventas LOOP

    -- Método de pago: 60% efectivo, 30% transferencia, 10% débito
    v_metodo := CASE
      WHEN (i * 13 + j * 7) % 10 < 6 THEN 'efectivo'
      WHEN (i * 13 + j * 7) % 10 < 9 THEN 'transferencia'
      ELSE 'debito'
    END;

    -- Hora de la venta (entre 9am y 7pm)
    v_hora := (v_dia::timestamptz AT TIME ZONE 'America/Argentina/Buenos_Aires')
              + ((9 + (i * 3 + j * 2) % 10) || ' hours')::interval
              + ((i + j * 5) % 60 || ' minutes')::interval;

    INSERT INTO ventas (fecha, total, metodo_pago, notas, tipo_comprobante, negocio_id)
    VALUES (v_hora, 0, v_metodo::metodo_pago_tipo, null, 'ticket', v_negocio_id)
    RETURNING id INTO v_venta_id;

    -- 1-4 ítems por venta
    v_num_items := 1 + ((i + j * 3) % 4);
    v_total     := 0;

    FOR k IN 1..v_num_items LOOP
      -- Seleccionar producto del array (determinístico)
      v_idx        := ((i * 11 + j * 7 + k * 5) % array_length(v_todos, 1)) + 1;
      v_producto_id := v_todos[v_idx];

      SELECT precio_venta INTO v_precio FROM productos WHERE id = v_producto_id;

      -- Cantidad: servicios van de 5-20, productos de 1-3
      IF v_precio <= 200 THEN
        v_qty := 5 + ((i + j + k) % 16); -- fotocopias: 5-20
      ELSE
        v_qty := 1 + ((i * 3 + j + k) % 3); -- productos: 1-3
      END IF;

      INSERT INTO venta_items (venta_id, producto_id, cantidad, precio_unitario, negocio_id)
      VALUES (v_venta_id, v_producto_id, v_qty, v_precio, v_negocio_id);

      v_total := v_total + (v_precio * v_qty);
    END LOOP;

    -- Actualizar total de la venta
    UPDATE ventas SET total = v_total WHERE id = v_venta_id;

  END LOOP;
END LOOP;


-- ============================================================
-- SECCIÓN 7: Capturar stock_inicial (post-seed = base del reset)
-- ============================================================

UPDATE productos
SET stock_inicial = stock_actual
WHERE negocio_id = v_negocio_id;


-- ============================================================
-- SECCIÓN 8: Proveedores ficticios
-- ============================================================

INSERT INTO proveedores (nombre, telefono, email, direccion, notas, activo, negocio_id)
VALUES (
  'Distribuidora Norte S.A.',
  '011 4321-5678',
  'ventas@distribuidoranorte.com.ar',
  'Av. Belgrano 4521, Buenos Aires',
  'Proveedor principal de útiles escolares. Pago a 30 días.',
  true,
  v_negocio_id
);

INSERT INTO proveedores (nombre, telefono, email, direccion, notas, activo, negocio_id)
VALUES (
  'Papelera Central Bs. As.',
  '011 4789-0123',
  'pedidos@papeleracentral.com.ar',
  'Mitre 1890, La Matanza',
  'Especialista en papel y resmas. Descuento por volumen mayor a 50 unidades.',
  true,
  v_negocio_id
);

INSERT INTO proveedores (nombre, telefono, email, direccion, notas, activo, negocio_id)
VALUES (
  'Mayorista Escolar del Sur',
  '011 4567-2345',
  'info@mayoristadelsur.com.ar',
  'Av. San Martín 777, Lomas de Zamora',
  'Carpetas, cuadernos y útiles en general. Retiro en depósito los martes y jueves.',
  true,
  v_negocio_id
);


-- ============================================================
-- RESUMEN FINAL
-- ============================================================

RAISE NOTICE '✅ Negocio demo creado: % (ID: %)', 'Demo Sintropia', v_negocio_id;
RAISE NOTICE '✅ Usuario demo vinculado: demo@sintropia.ar';
RAISE NOTICE '✅ Productos: 44 ítems en 7 categorías';
RAISE NOTICE '✅ Ventas: 15 días de historial generado';
RAISE NOTICE '✅ Proveedores: 3 ficticios';
RAISE NOTICE '📌 Copiar el negocio_id para usarlo en otros scripts: %', v_negocio_id;

END $$;
