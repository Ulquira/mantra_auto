const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT l1.id as id1, l2.id as id2, l1.OrdenId, l1.CodiSegui, l1.EstadoNotificado, 
             DATE_FORMAT(l1.fecha_envio, '%Y-%m-%d %H:%i:%s') as envio1, 
             DATE_FORMAT(l2.fecha_envio, '%Y-%m-%d %H:%i:%s') as envio2
      FROM LOG_NOTIFICACIONES_WSP l1
      JOIN LOG_NOTIFICACIONES_WSP l2 ON l1.OrdenId = l2.OrdenId AND l1.id < l2.id
      WHERE DATE(l1.fecha_envio) = CURDATE()
        AND l1.fecha_envio >= '2026-09-09 13:10:00'
    `);
    console.log(`=== DUPLICADOS DESPUÉS DE LAS 13:10 (Total: ${rows.length}) ===`);
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
