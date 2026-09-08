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

    console.log("1. Creando tabla HISTORIAL_CHATS_MANTRA...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS HISTORIAL_CHATS_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(20) NOT NULL,
        countryCode VARCHAR(10) DEFAULT '51',
        grupo_servicio VARCHAR(50) NOT NULL,        -- 'Averias' o 'Instalacion'
        total_mensajes INT DEFAULT 0,
        ultimo_mensaje_emisor VARCHAR(20),          -- 'CLIENTE' o 'ASESOR/EMPRESA'
        ultimo_mensaje_texto TEXT,
        ultimo_mensaje_fecha TIMESTAMP NULL,
        ultimo_mensaje_cliente_texto TEXT,
        ultimo_mensaje_cliente_fecha TIMESTAMP NULL,
        tuvo_respuesta BOOLEAN DEFAULT FALSE,       -- TRUE si el asesor respondió después del cliente
        tiempo_espera_minutos INT DEFAULT 0,
        estado_chat VARCHAR(50) DEFAULT 'Pendiente', -- 'Pendiente', 'En proceso', 'Cerrado'
        asesor_asignado VARCHAR(100) NULL,
        ultimos_3_mensajes_json JSON NULL,          -- Array con los últimos 3 mensajes completos
        fecha_auditoria TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_phone_grupo (phone, grupo_servicio),
        INDEX idx_phone (phone),
        INDEX idx_tuvo_respuesta (tuvo_respuesta),
        INDEX idx_estado_chat (estado_chat)
      )
    `);
    console.log("✅ Tabla HISTORIAL_CHATS_MANTRA creada exitosamente con índices.");

    console.log("\n2. Creando vista enriquecida: vw_monitoreo_atencion_chats...");
    await conn.query(`
      CREATE OR REPLACE VIEW vw_monitoreo_atencion_chats AS
      SELECT 
        h.id,
        h.phone AS telefono,
        h.grupo_servicio,
        h.asesor_asignado,
        h.estado_chat,
        h.tuvo_respuesta,
        h.tiempo_espera_minutos,
        h.ultimo_mensaje_emisor,
        h.ultimo_mensaje_texto,
        DATE_FORMAT(h.ultimo_mensaje_fecha, '%Y-%m-%d %H:%i:%s') AS fecha_ultimo_mensaje,
        h.ultimo_mensaje_cliente_texto,
        DATE_FORMAT(h.ultimo_mensaje_cliente_fecha, '%Y-%m-%d %H:%i:%s') AS fecha_ultimo_msg_cliente,
        t.OrdenId AS orden_id,
        t.ClienteFinal AS cliente,
        t.CodiSegui AS ticket_pedido,
        t.Producto AS producto_servicio,
        t.Zona AS distrito_zona,
        t.\`Sector Operativo\` AS sector_operativo,
        h.ultimos_3_mensajes_json,
        h.fecha_auditoria
      FROM HISTORIAL_CHATS_MANTRA h
      LEFT JOIN vw_winordetraba t ON h.phone = RIGHT(t.TeleMovilNume, 9);
    `);
    console.log("✅ Vista vw_monitoreo_atencion_chats creada exitosamente.");

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
