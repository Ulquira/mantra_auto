const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        DATE(l.fecha_envio) as fecha_envio_log,
        DATE(t.\`F.Soli\`) as fecha_soli_orden,
        TIME(t.\`F.Soli\`) as hora_soli_orden,
        COUNT(*) as total_enviados
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      GROUP BY DATE(l.fecha_envio), DATE(t.\`F.Soli\`), TIME(t.\`F.Soli\`)
      ORDER BY fecha_envio_log DESC
    `);
    console.log('=== RESUMEN DE ENVIOS POR FECHA EN LOGS ===');
    console.log(stats);

    // Revisar cuántas órdenes en la cola NO son de hoy
    const [colaNoHoy] = await pool.query(`
      SELECT c.id, c.ordenId, DATE(t.\`F.Soli\`) as f_soli
      FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
      WHERE DATE(t.\`F.Soli\`) <> CURDATE() OR t.\`F.Soli\` IS NULL
    `);
    console.log(`\n=== REGISTROS EN COLA QUE NO SON DE HOY (${colaNoHoy.length}) ===`, colaNoHoy);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
