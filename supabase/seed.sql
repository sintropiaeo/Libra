-- =============================================
-- SEED — Libra (datos de ejemplo)
-- =============================================


-- ─── Categorías ───────────────────────────────────────────────────────────────

INSERT INTO categorias (nombre, descripcion) VALUES
  ('Escritura',              'Lápices, lapiceras, marcadores, biromes y afines'),
  ('Papelería',              'Hojas, resmas, cuadernos, carpetas y productos de papel'),
  ('Servicios de impresión', 'Fotocopias, impresiones color y B/N, plastificado y encuadernado'),
  ('Artística',              'Materiales para dibujo, pintura y manualidades'),
  ('Escolar',                'Útiles escolares varios: reglas, tijeras, adhesivos, compases');


-- ─── Proveedores ──────────────────────────────────────────────────────────────

INSERT INTO proveedores (nombre, telefono, email, direccion, notas) VALUES
  ('Distribuidora del Norte', '0341-4123456', 'ventas@distnorte.com.ar',     'Av. Pellegrini 1500, Rosario', 'Entrega los lunes y jueves. Mínimo de pedido $50.000'),
  ('Papeles SA',              '011-48001234', 'comercial@papelessa.com.ar',  'Av. Corrientes 3400, CABA',    'Principal proveedor de resmas y cuadernos. Pago a 30 días'),
  ('Office Total',            '0341-4567890', 'pedidos@officetotal.com.ar',  'San Juan 850, Rosario',        'Insumos varios para oficina y librería. Retiro en local');


-- ─── Productos ────────────────────────────────────────────────────────────────

INSERT INTO productos (nombre, descripcion, categoria_id, precio_costo, precio_venta, stock_actual, stock_minimo, unidad) VALUES

  -- Escritura
  ('Lápiz HB',
   'Lápiz grafito HB estándar',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   200, 450, 150, 30, 'unidad'),

  ('Lápices de color x12',
   'Caja de 12 lápices de colores largos',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   950, 1900, 60, 10, 'pack'),

  ('Lapicera azul',
   'Birome punta media, tinta azul',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   150, 350, 200, 40, 'unidad'),

  ('Lapicera negra',
   'Birome punta media, tinta negra',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   150, 350, 180, 40, 'unidad'),

  ('Lapicera roja',
   'Birome punta media, tinta roja',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   150, 350, 80, 20, 'unidad'),

  ('Resaltador amarillo',
   'Marcador fluorescente punta biselada, color amarillo',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   400, 850, 90, 15, 'unidad'),

  ('Marcador permanente negro',
   'Marcador indeleble punta fina, negro',
   (SELECT id FROM categorias WHERE nombre = 'Escritura'),
   350, 750, 70, 15, 'unidad'),

  -- Papelería
  ('Resma A4 75g',
   'Resma de 500 hojas A4 75g/m²',
   (SELECT id FROM categorias WHERE nombre = 'Papelería'),
   2800, 5500, 40, 8, 'resma'),

  ('Cuaderno A4 rayado',
   'Cuaderno tapa dura, 96 hojas, rayado',
   (SELECT id FROM categorias WHERE nombre = 'Papelería'),
   850, 1700, 55, 10, 'unidad'),

  ('Cuaderno A5 cuadriculado',
   'Cuaderno tapa blanda, 80 hojas, cuadriculado',
   (SELECT id FROM categorias WHERE nombre = 'Papelería'),
   650, 1300, 45, 10, 'unidad'),

  ('Cartulina de colores x10',
   'Pack 10 cartulinas A3 de colores surtidos',
   (SELECT id FROM categorias WHERE nombre = 'Papelería'),
   600, 1200, 30, 8, 'pack'),

  ('Carpeta A4 con elástico',
   'Carpeta plástica A4 con elástico, colores surtidos',
   (SELECT id FROM categorias WHERE nombre = 'Papelería'),
   450, 950, 65, 12, 'unidad'),

  -- Servicios de impresión
  -- (stock_minimo = 0 porque son servicios, no productos físicos)
  ('Fotocopia B/N A4',
   'Fotocopia blanco y negro tamaño A4',
   (SELECT id FROM categorias WHERE nombre = 'Servicios de impresión'),
   5, 25, 9999, 0, 'unidad'),

  ('Impresión color A4',
   'Impresión a color tamaño A4',
   (SELECT id FROM categorias WHERE nombre = 'Servicios de impresión'),
   20, 150, 9999, 0, 'unidad'),

  ('Plastificado A4',
   'Plastificado tamaño A4, bolsa incluida',
   (SELECT id FROM categorias WHERE nombre = 'Servicios de impresión'),
   150, 500, 9999, 0, 'unidad'),

  -- Artística
  ('Pincel N°10',
   'Pincel de cerda redondo número 10',
   (SELECT id FROM categorias WHERE nombre = 'Artística'),
   250, 550, 40, 8, 'unidad'),

  ('Témpera x6 colores',
   'Set de 6 témperas 25ml en colores primarios y básicos',
   (SELECT id FROM categorias WHERE nombre = 'Artística'),
   700, 1450, 35, 8, 'pack'),

  -- Escolar
  ('Regla 30 cm',
   'Regla plástica transparente 30 cm',
   (SELECT id FROM categorias WHERE nombre = 'Escolar'),
   150, 350, 100, 20, 'unidad'),

  ('Tijera punta roma',
   'Tijera escolar punta redondeada 16 cm',
   (SELECT id FROM categorias WHERE nombre = 'Escolar'),
   350, 750, 50, 10, 'unidad'),

  ('Adhesivo en barra',
   'Pegamento en barra 20g, sin tóxico',
   (SELECT id FROM categorias WHERE nombre = 'Escolar'),
   250, 550, 80, 15, 'unidad');
