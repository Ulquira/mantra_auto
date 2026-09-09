const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== ÓRDENES DEL TRAMO 12:00 PARA HOY SEGÚN POLÍTICAS ===");

    // 1. Total del tramo 12:00 separando OESTE 2 vs OTROS SECTORES
    const [rows] = await pool.query(`
      SELECT 
        t.OrdenId,
        t.CodiSegui,
        t.ClienteFinal,
        t.TeleMovilNume,
        t.Estado,
        t.Producto,
        ts.Tipo AS TipoServicio,
        t.\`Sector Operativo\` AS SectorOperativo,
        CASE 
          WHEN UPPER(t.\`Sector Operativo\`) LIKE '%OESTE 2%' 
            OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE -2%' 
            OR UPPER(t.\`Sector Operativo\`) LIKE '%OESTE-2%' THEN 'OESTE 2 (Template Oeste2 + Tag TRAKING + BotEnvio)'
          ELSE 'OTRO SECTOR (Template Default + Tag BotEnvio)'
        END AS TipoPlantillaYTag,
        CASE WHEN l.id IS NOT NULL THEN 'SI' ELSE 'NO' END AS YaNotificadoHoy
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
      ORDER BY TipoPlantillaYTag DESC, t.OrdenId ASC
    `);

    console.log(`\nTotal de órdenes encontradas para el tramo 12:00: ${rows.length}`);
    console.table(rows);

    const oeste2Count = rows.filter(r => r.TipoPlantillaYTag.startsWith('OESTE 2')).length;
    const otrosCount = rows.filter(r => !r.TipoPlantillaYTag.startsWith('OESTE 2')).length;
    console.log(`\n📌 Resumen Tramo 12:00:`);
    console.log(`- Con OESTE 2: ${oeste2Count}`);
    console.log(`- Otros sectores: ${otrosCount}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
