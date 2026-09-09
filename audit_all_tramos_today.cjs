const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log(`=== REVISIÓN DE ÓRDENES DE HOY (FECHA: CURDATE()) EN ${MAIN_TABLE} ===`);

    // 1. Total general por tramos para el servicio AVERÍAS con estados válidos (Agendada, Pendiente, En camino)
    const [tramosValidos] = await pool.query(`
      SELECT 
        CASE 
          WHEN TIME(t.\`F.Soli\`) LIKE '08%' THEN '08:00 (8AM - 12PM)'
          WHEN TIME(t.\`F.Soli\`) LIKE '12%' THEN '12:00 (12PM - 4PM)'
          WHEN TIME(t.\`F.Soli\`) LIKE '16%' THEN '16:00 (4PM - 8PM)'
          ELSE CONCAT('Otro Horario (', TIME(t.\`F.Soli\`), ')')
        END AS Tramo,
        t.Estado,
        COUNT(*) AS Total
      FROM ${MAIN_TABLE} t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE ts.Tipo = 'AVERIAS'
        AND DATE(t.\`F.Soli\`) = CURDATE()
      GROUP BY Tramo, t.Estado
      ORDER BY Tramo, t.Estado
    `);

    console.log('\n📊 Desglose por Tramo y Estado:');
    console.table(tramosValidos);

    // 2. Resumen consolidado por tramos (Agrupando estados elegibles: Pendiente, Agendada, En camino vs Otros)
    const [resumenTramos] = await pool.query(`
      SELECT 
        CASE 
          WHEN TIME(t.\`F.Soli\`) LIKE '08%' THEN 'Tramo 08:00 (07:00 - 09:00h)'
          WHEN TIME(t.\`F.Soli\`) LIKE '12%' THEN 'Tramo 12:00 (11:00 - 13:00h)'
          WHEN TIME(t.\`F.Soli\`) LIKE '16%' THEN 'Tramo 16:00 (15:00 - 17:00h)'
          ELSE 'Otros Horarios'
        END AS Tramo,
        COUNT(CASE WHEN t.Estado IN ('Pendiente', 'Agendada', 'En camino') THEN 1 END) AS Elegibles,
        COUNT(CASE WHEN t.Estado NOT IN ('Pendiente', 'Agendada', 'En camino') THEN 1 END) AS NoElegibles_Canceladas_Cerradas,
        COUNT(*) AS Total_General
      FROM ${MAIN_TABLE} t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE ts.Tipo = 'AVERIAS'
        AND DATE(t.\`F.Soli\`) = CURDATE()
      GROUP BY Tramo
      ORDER BY Tramo
    `);

    console.log('\n📌 Resumen Consolidado por Tramo:');
    console.table(resumenTramos);

    // 3. Cuántas de las elegibles ya fueron notificadas hoy vs cuántas faltan notificar
    const [estadoNotificaciones] = await pool.query(`
      SELECT 
        CASE 
          WHEN TIME(t.\`F.Soli\`) LIKE '08%' THEN 'Tramo 08:00'
          WHEN TIME(t.\`F.Soli\`) LIKE '12%' THEN 'Tramo 12:00'
          WHEN TIME(t.\`F.Soli\`) LIKE '16%' THEN 'Tramo 16:00'
          ELSE 'Otros'
        END AS Tramo,
        COUNT(DISTINCT CASE WHEN l.id IS NOT NULL THEN t.OrdenId END) AS Ya_Notificadas_Hoy,
        COUNT(DISTINCT CASE WHEN l.id IS NULL AND t.Estado IN ('Pendiente', 'Agendada', 'En camino') THEN t.OrdenId END) AS Pendientes_Por_Notificar
      FROM ${MAIN_TABLE} t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND DATE(t.\`F.Soli\`) = CURDATE()
      GROUP BY Tramo
      ORDER BY Tramo
    `);

    console.log('\n📬 Estado de Envíos Hoy (Notificadas vs Pendientes):');
    console.table(estadoNotificaciones);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
