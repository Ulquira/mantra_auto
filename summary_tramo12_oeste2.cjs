const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        CASE 
          WHEN UPPER(t.\`Sector Operativo\`) LIKE '%OESTE 2%' 
            OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE -2%' 
            OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE-2%' THEN 'OESTE 2 (OESTE -2)'
          ELSE 'OTROS SECTORES'
        END AS Sector,
        COUNT(DISTINCT t.OrdenId) as TotalOrdenesUnicas,
        COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN t.OrdenId END) as NotificadasHoy,
        COUNT(DISTINCT CASE WHEN l.id IS NULL AND t.Estado IN ('Pendiente', 'Agendada', 'En camino') THEN t.OrdenId END) as PendientesHoy
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
      GROUP BY Sector
    `);

    console.log("=== CONTEO EXACTO TRAMO 12:00 (HOY) ===");
    console.table(stats);

    const [oeste2List] = await pool.query(`
      SELECT 
        t.OrdenId,
        t.CodiSegui,
        t.ClienteFinal,
        t.TeleMovilNume,
        t.Estado,
        t.\`Sector Operativo\` AS SectorOperativo,
        CASE WHEN MAX(l.id) IS NOT NULL THEN 'SI' ELSE 'NO' END AS NotificadoHoy
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
        AND (
          UPPER(t.\`Sector Operativo\`) LIKE '%OESTE 2%' 
          OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE -2%' 
          OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE-2%'
        )
      GROUP BY t.OrdenId, t.CodiSegui, t.ClienteFinal, t.TeleMovilNume, t.Estado, t.\`Sector Operativo\`
    `);

    console.log(`\n=== LISTADO COMPLETO CASOS OESTE 2 (TRAMO 12:00) [Total: ${oeste2List.length}] ===`);
    console.table(oeste2List);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
