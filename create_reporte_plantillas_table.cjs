const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log("1. Creando tabla REPORTE_PLANTILLAS_MANTRA...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS REPORTE_PLANTILLAS_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contacto_id VARCHAR(50) NOT NULL,            -- ID del contacto (_id en Mantra)
        nombre VARCHAR(150),                          -- Nombre
        telefono VARCHAR(20) NOT NULL,                -- Teléfono
        codigo_pais VARCHAR(10) DEFAULT '51',         -- Código país
        email VARCHAR(150),                           -- Email
        agente_asignado VARCHAR(150),                 -- Agente asignado (agentName)
        enviado_por VARCHAR(150),                     -- Enviado por (sentBy)
        custom_1 VARCHAR(255),                        -- Campo personalizado #1 (Ticket)
        custom_2 VARCHAR(255),                        -- Campo personalizado #2 (Fecha)
        custom_3 VARCHAR(255),                        -- Campo personalizado #3 (Horario)
        custom_4 TEXT,                                -- Campo personalizado #4 (Dirección)
        custom_5 TEXT,                                -- Campo personalizado #5 (Link)
        custom_6 VARCHAR(255),                        -- Campo personalizado #6 (Plan)
        custom_7 VARCHAR(255),                        -- Campo personalizado #7 (Nombre)
        custom_8 VARCHAR(255),                        -- Campo personalizado #8 (Fecha Venta)
        custom_9 VARCHAR(255),                        -- Campo personalizado #9 (Ubicación)
        custom_10 VARCHAR(255),                       -- Campo personalizado #10 (Canal/Link)
        creado TIMESTAMP NULL,                        -- Creado (createdAt)
        fecha_envio TIMESTAMP NULL,                   -- Fecha de envío del mensaje (msgSentAt)
        estado_mensaje VARCHAR(50),                   -- Estado del mensaje (read, delivered, sent, failed)
        estado_chat VARCHAR(50),                      -- Estado del chat (Pendiente, En proceso, etc.)
        respuesta_boton TEXT,                         -- Respuesta rápida del cliente (qrTxt)
        fecha_respuesta_boton TIMESTAMP NULL,         -- Fecha de respuesta rápida (qrAt)
        vendor_id VARCHAR(100),                       -- ID de mensaje de WhatsApp (vendorId / Código)
        template_id VARCHAR(50) NOT NULL,             -- ID de plantilla
        grupo_servicio VARCHAR(50) NOT NULL,          -- 'Averias' o 'Instalacion'
        nombre_plantilla_alias VARCHAR(100),          -- Alias descriptivo de la plantilla
        fecha_sincronizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_contacto_template (contacto_id, template_id),
        INDEX idx_telefono (telefono),
        INDEX idx_custom1_ticket (custom_1),
        INDEX idx_creado (creado),
        INDEX idx_estado_msg (estado_mensaje)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("✅ Tabla REPORTE_PLANTILLAS_MANTRA creada exitosamente con índices.");
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
