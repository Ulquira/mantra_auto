const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.Estado as EstadoActualPrincipal,
        COUNT(*) as total_ordenes
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND (DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL)
        AND l.EnviadoExitosamente = 1
      GROUP BY t.Estado
      ORDER BY total_ordenes DESC;
    `);

    console.log('=== ÚLTIMO ESTADO ACTUAL EN TABLA PRINCIPAL (vw_winordetraba) ===');
    console.log('Para las órdenes con fechas anteriores enviadas hoy:\n');
    console.table(rows);

    const [detalles] = await pool.query(`
      SELECT 
        ts.Tipo as CategoriaServicio,
        t.Estado as EstadoActualPrincipal,
        COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND (DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL)
        AND l.EnviadoExitosamente = 1
      GROUP BY ts.Tipo, t.Estado
      ORDER BY CategoriaServicio, total DESC;
    `);

    console.log('\n=== DESGLOSE POR TIPO DE SERVICIO Y ESTADO ACTUAL ===');
    console.table(detalles);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
