const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.OrdenId, 
        t.Estado, 
        t.ClienteFinal, 
        t.Producto, 
        ts.Tipo as TipoServicio, 
        DATE_FORMAT(t.\`F.Soli\`, '%Y-%m-%d %H:%i:%s') as f_soli
      FROM ${MAIN_TABLE} t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(t.\`F.Soli\`) = CURDATE()
        AND TIME(t.\`F.Soli\`) LIKE '12%'
        AND l.id IS NULL
    `);
    console.log(`\n📌 Órdenes pendientes del tramo 12:00 (Total: ${rows.length}):`);
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
