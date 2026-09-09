const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    const [totalSent] = await pool.query(`
      SELECT COUNT(DISTINCT OrdenId) as total_unicos, COUNT(*) as total_registros
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE() AND EnviadoExitosamente = 1
    `);
    console.log('📊 Enviados exitosos hoy:', totalSent[0]);

    const [tramo12] = await pool.query(`
      SELECT COUNT(*) as pendientes_12
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
    console.log('📌 Pendientes de las 12:00 sin enviar:', tramo12[0]);

    const [tramo16] = await pool.query(`
      SELECT COUNT(*) as pendientes_16
      FROM ${MAIN_TABLE} t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(t.\`F.Soli\`) = CURDATE()
        AND TIME(t.\`F.Soli\`) LIKE '16%'
        AND l.id IS NULL
    `);
    console.log('📌 Pendientes de las 16:00 para la tarde (15:00-17:00h):', tramo16[0]);

    // Revisar la cola actual
    const [cola] = await pool.query(`SELECT COUNT(*) as total_cola FROM COLA_NOTIFICACIONES_MANTRA`);
    console.log('📌 Total en COLA_NOTIFICACIONES_MANTRA:', cola[0]);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
