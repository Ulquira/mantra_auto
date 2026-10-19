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

    console.log("1. Creando / Reemplazando tabla REPORTE_PLANTILLAS_MANTRA depurada...");
    await conn.query(`DROP TABLE IF EXISTS REPORTE_PLANTILLAS_MANTRA`);
    await conn.query(`
      CREATE TABLE REPORTE_PLANTILLAS_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contacto_id VARCHAR(50) NOT NULL,            -- ID del contacto (_id en Mantra)
        nombre VARCHAR(150),                          -- Nombre
        telefono VARCHAR(20) NOT NULL,                -- Teléfono
        codigo_pedido VARCHAR(100),                   -- custom_1 (Ticket / CodiSegui / OrdenId)
        email VARCHAR(150),                           -- Email
        agente_asignado VARCHAR(150),                 -- Agente asignado (agentName)
        enviado_por VARCHAR(150),                     -- Enviado por (sentBy)
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
        INDEX idx_codigo_pedido (codigo_pedido),
        INDEX idx_creado (creado),
        INDEX idx_estado_msg (estado_mensaje)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
    `);

    console.log("✅ Tabla REPORTE_PLANTILLAS_MANTRA reestructurada con éxito.");

    console.log("\n2. Creando vista consolidada: vw_reporte_mantra_enriquecido (JOIN con tabla principal)...");
    await conn.query(`
      CREATE OR REPLACE VIEW vw_reporte_mantra_enriquecido AS
      SELECT 
        r.id AS reporte_id,
        r.contacto_id,
        r.codigo_pedido,
        r.nombre AS nombre_mantra,
        r.telefono,
        r.email,
        r.nombre_plantilla_alias AS plantilla,
        r.estado_mensaje,
        DATE_FORMAT(r.fecha_envio, '%Y-%m-%d %H:%i:%s') AS fecha_envio_wsp,
        r.respuesta_boton,
        DATE_FORMAT(r.fecha_respuesta_boton, '%Y-%m-%d %H:%i:%s') AS fecha_respuesta_boton,
        r.estado_chat,
        r.agente_asignado,
        r.vendor_id AS codigo_mensaje_wsp,
        DATE_FORMAT(r.creado, '%Y-%m-%d %H:%i:%s') AS creado_mantra,
        -- Datos cruzados con la tabla principal (vw_winordetraba)
        t.OrdenId AS orden_id,
        t.ClienteFinal AS cliente_bd,
        t.Estado AS estado_actual_orden,
        t.Producto AS producto,
        t.IdenServi AS plan_servicio,
        t.Zona AS distrito,
        t.\`Sector Operativo\` AS sector_operativo,
        DATE_FORMAT(t.\`F.Soli\`, '%Y-%m-%d %H:%i:%s') AS fecha_cita_bd,
        t.Direccion AS direccion_completa,
        t.token AS tracking_token,
        CONCAT('https://go.win.pe/seguimiento/', t.token) AS tracking_url
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t 
        ON (r.codigo_pedido = t.CodiSegui OR r.codigo_pedido = CAST(t.OrdenId AS CHAR) OR r.telefono = RIGHT(t.TeleMovilNume, 9));
    `);

    console.log("✅ Vista vw_reporte_mantra_enriquecido creada exitosamente.");
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
