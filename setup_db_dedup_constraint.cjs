const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("1. Creando columna generada fecha_dia (DATE) e índice único en LOG_NOTIFICACIONES_WSP...");
    
    // Agregar columna calculada fecha_dia si no existe
    const [cols] = await pool.query("SHOW COLUMNS FROM LOG_NOTIFICACIONES_WSP LIKE 'fecha_dia'");
    if (cols.length === 0) {
      await pool.query(`
        ALTER TABLE LOG_NOTIFICACIONES_WSP
        ADD COLUMN fecha_dia DATE GENERATED ALWAYS AS (DATE(fecha_envio)) STORED
      `);
      console.log("✅ Columna fecha_dia agregada.");
    }

    // Agregar índice para búsquedas rápidas por OrdenId y fecha_dia
    const [indexes] = await pool.query("SHOW INDEX FROM LOG_NOTIFICACIONES_WSP WHERE Key_name = 'idx_log_orden_dia'");
    if (indexes.length === 0) {
      await pool.query(`
        ALTER TABLE LOG_NOTIFICACIONES_WSP
        ADD INDEX idx_log_orden_dia (OrdenId, fecha_dia, EnviadoExitosamente)
      `);
      console.log("✅ Índice idx_log_orden_dia creado.");
    }

    // Asegurar índice único en la cola para que un mismo ordenId nunca esté dos veces simultáneas
    const [colaIndexes] = await pool.query("SHOW INDEX FROM COLA_NOTIFICACIONES_MANTRA WHERE Key_name = 'uq_cola_ordenid'");
    if (colaIndexes.length === 0) {
      // Eliminar posibles duplicados actuales antes de aplicar unique
      await pool.query(`
        DELETE c1 FROM COLA_NOTIFICACIONES_MANTRA c1
        INNER JOIN COLA_NOTIFICACIONES_MANTRA c2 
        WHERE c1.id < c2.id AND c1.ordenId = c2.ordenId
      `);
      await pool.query(`
        ALTER TABLE COLA_NOTIFICACIONES_MANTRA
        ADD UNIQUE KEY uq_cola_ordenid (ordenId)
      `);
      console.log("✅ Índice UNIQUE uq_cola_ordenid creado en COLA_NOTIFICACIONES_MANTRA.");
    }

    console.log("🏁 Base de datos blindada contra duplicados a nivel de motor SQL.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
