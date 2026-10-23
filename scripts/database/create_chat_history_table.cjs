const mysql = require('mysql2/promise');
require('dotenv').config();

const requiredColumns = [
  'id',
  'orden_id',
  'ticket',
  'phone',
  'grupo_servicio',
  'cliente_nombre',
  'producto',
  'tipo_trabajo',
  'motivo_trabajo',
  'distrito',
  'provincia',
  'sector_operativo',
  'fecha_gestion_dia',
  'cliente_tipo_interaccion',
  'cliente_boton_seleccionado',
  'cliente_ultimo_texto',
  'cliente_ultima_fecha',
  'asesor_asignado',
  'asesor_ultimo_texto',
  'asesor_ultima_fecha',
  'total_mensajes',
  'ultimo_mensaje_emisor',
  'ultimo_mensaje_texto',
  'ultimo_mensaje_fecha',
  'quien_tiene_la_palabra',
  'estado_chat',
  'tuvo_respuesta',
  'tiempo_espera_minutos',
  'semaforo_sla',
  'ultimos_mensajes_json',
  'fecha_auditoria'
];

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('1. Creando/validando HISTORIAL_CHATS_MANTRA...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS HISTORIAL_CHATS_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orden_id INT NULL,
        ticket VARCHAR(50) NULL,
        phone VARCHAR(20) NOT NULL,
        grupo_servicio VARCHAR(50) NOT NULL,
        cliente_nombre VARCHAR(255) NULL,
        producto VARCHAR(150) NULL,
        tipo_trabajo VARCHAR(100) NULL,
        motivo_trabajo VARCHAR(100) NULL,
        distrito VARCHAR(100) NULL,
        provincia VARCHAR(100) NULL,
        sector_operativo VARCHAR(100) NULL,
        fecha_gestion_dia DATE NOT NULL,
        cliente_tipo_interaccion ENUM('BOTON', 'TEXTO_LIBRE', 'MEDIA', 'NINGUNO') NULL,
        cliente_boton_seleccionado TEXT NULL,
        cliente_ultimo_texto LONGTEXT NULL,
        cliente_ultima_fecha DATETIME NULL,
        asesor_asignado VARCHAR(100) NULL,
        asesor_ultimo_texto LONGTEXT NULL,
        asesor_ultima_fecha DATETIME NULL,
        total_mensajes INT DEFAULT 0,
        ultimo_mensaje_emisor VARCHAR(20) NULL,
        ultimo_mensaje_texto LONGTEXT NULL,
        ultimo_mensaje_fecha DATETIME NULL,
        quien_tiene_la_palabra ENUM('CLIENTE', 'ASESOR', 'BOT') NULL,
        estado_chat VARCHAR(50) NULL,
        tuvo_respuesta TINYINT(1) NULL,
        tiempo_espera_minutos INT NULL,
        semaforo_sla ENUM('VERDE', 'AMARILLO', 'ROJO') NULL,
        ultimos_mensajes_json JSON NULL,
        fecha_auditoria TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_phone_grupo_dia (phone, grupo_servicio, fecha_gestion_dia),
        INDEX idx_phone (phone),
        INDEX idx_orden (orden_id),
        INDEX idx_fecha_dia (fecha_gestion_dia),
        INDEX idx_sla (semaforo_sla, quien_tiene_la_palabra)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [columns] = await conn.query('SHOW COLUMNS FROM HISTORIAL_CHATS_MANTRA');
    const existingColumns = new Set(columns.map(column => column.Field.toLowerCase()));
    const missingColumns = requiredColumns.filter(column => !existingColumns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(
        `La tabla existente no coincide con el esquema actual. Faltan columnas: ${missingColumns.join(', ')}.`
      );
    }

    const [indexes] = await conn.query('SHOW INDEX FROM HISTORIAL_CHATS_MANTRA');
    const uniqueDayIndex = indexes
      .filter(index => index.Key_name === 'uq_phone_grupo_dia')
      .sort((left, right) => left.Seq_in_index - right.Seq_in_index)
      .map(index => index.Column_name.toLowerCase());
    const indexIsUnique = indexes.some(
      index => index.Key_name === 'uq_phone_grupo_dia' && Number(index.Non_unique) === 0
    );
    if (!indexIsUnique || uniqueDayIndex.join(',') !== 'phone,grupo_servicio,fecha_gestion_dia') {
      throw new Error(
        'La tabla existente no tiene el índice único uq_phone_grupo_dia(phone, grupo_servicio, fecha_gestion_dia).'
      );
    }
    console.log('✅ Esquema e índice único de historial validados.');

    console.log('2. Actualizando vw_monitoreo_atencion_chats...');
    await conn.query(`
      CREATE OR REPLACE VIEW vw_monitoreo_atencion_chats AS
      SELECT
        id,
        fecha_gestion_dia,
        phone AS telefono,
        grupo_servicio,
        orden_id,
        ticket AS ticket_pedido,
        cliente_nombre AS cliente,
        producto AS producto_servicio,
        tipo_trabajo,
        motivo_trabajo,
        distrito AS distrito_zona,
        provincia,
        sector_operativo,
        estado_chat,
        asesor_asignado,
        quien_tiene_la_palabra,
        semaforo_sla,
        tuvo_respuesta,
        tiempo_espera_minutos,
        cliente_tipo_interaccion,
        cliente_boton_seleccionado,
        cliente_ultimo_texto,
        cliente_ultima_fecha,
        asesor_ultimo_texto,
        asesor_ultima_fecha,
        ultimo_mensaje_emisor,
        ultimo_mensaje_texto,
        ultimo_mensaje_fecha,
        total_mensajes,
        ultimos_mensajes_json,
        fecha_auditoria
      FROM HISTORIAL_CHATS_MANTRA
    `);
    console.log('✅ Vista vw_monitoreo_atencion_chats actualizada.');
  } finally {
    await conn.end();
  }
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exitCode = 1;
});
