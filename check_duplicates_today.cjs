const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [dups] = await pool.query(`
      SELECT OrdenId, EstadoNotificado, COUNT(*) as total, MIN(fecha_envio) as primera, MAX(fecha_envio) as ultima
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
      GROUP BY OrdenId, EstadoNotificado
      HAVING total > 1
    `);
    console.log('=== DUPLICADOS ENVIADOS HOY ===');
    console.table(dups);

    const [allToday] = await pool.query(`
      SELECT id, OrdenId, EstadoNotificado, DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i:%s') as f_envio
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
      ORDER BY id ASC
    `);
    console.log('\n=== TODOS LOS ENVÍOS DE HOY ===');
    console.table(allToday);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
