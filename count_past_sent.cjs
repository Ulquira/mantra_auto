const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    // 1. Conteo total de enviados hoy cuya fecha de solicitud (F.Soli) fue anterior a hoy
    const [totalAnteriores] = await pool.query(`
      SELECT COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND (DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL)
        AND l.EnviadoExitosamente = 1
    `);

    // 2. Conteo total de enviados hoy cuya fecha de solicitud (F.Soli) es HOY
    const [totalHoy] = await pool.query(`
      SELECT COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND DATE(t.\`F.Soli\`) = CURDATE()
        AND l.EnviadoExitosamente = 1
    `);

    // 3. Detalle desglosado por fecha de F.Soli de las órdenes anteriores enviadas hoy
    const [desglose] = await pool.query(`
      SELECT 
        DATE(t.\`F.Soli\`) as fecha_orden_f_soli,
        l.EstadoNotificado,
        COUNT(*) as cantidad
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND (DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL)
        AND l.EnviadoExitosamente = 1
      GROUP BY DATE(t.\`F.Soli\`), l.EstadoNotificado
      ORDER BY fecha_orden_f_soli ASC
    `);

    console.log('=== RESUMEN DE ENVIOS DE HOY ===');
    console.log(`Total enviados con fechas ANTERIORES a hoy: ${totalAnteriores[0].total}`);
    console.log(`Total enviados correspondientes a HOY: ${totalHoy[0].total}`);
    console.log('\n=== DESGLOSE DE ENVIOS CON FECHAS ANTERIORES ===');
    console.log(desglose);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
