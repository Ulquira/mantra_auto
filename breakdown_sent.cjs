const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        CASE 
          WHEN ts.Tipo = 'AVERIAS' THEN 'Visita Tecnica (AVERIAS)'
          WHEN ts.Tipo IN ('INSTALACION', 'PROVINCIA') THEN 'Instalacion'
          WHEN ts.Tipo = 'POSTVENTA' THEN 'Postventa'
          WHEN ts.Tipo = 'NO' THEN 'Excluidos (NO)'
          ELSE 'Sin Mapear'
        END as Categoria,
        CASE 
          WHEN DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL THEN 'Fecha Anterior'
          WHEN DATE(t.\`F.Soli\`) = CURDATE() THEN 'Fecha de HOY'
          ELSE 'Fecha Futura'
        END as Periodo,
        COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
      GROUP BY Categoria, Periodo
      ORDER BY Periodo, Categoria;
    `);

    console.log('=== DESGLOSE DE MENSAJES ENVIADOS HOY POR CATEGORÍA Y FECHA ===');
    console.table(rows);

    const [totalPorCategoria] = await pool.query(`
      SELECT 
        CASE 
          WHEN ts.Tipo = 'AVERIAS' THEN 'Visita Tecnica (AVERIAS)'
          WHEN ts.Tipo IN ('INSTALACION', 'PROVINCIA') THEN 'Instalacion'
          WHEN ts.Tipo = 'POSTVENTA' THEN 'Postventa'
          WHEN ts.Tipo = 'NO' THEN 'Excluidos (NO)'
          ELSE 'Sin Mapear'
        END as Categoria,
        COUNT(*) as total_general
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
      GROUP BY Categoria;
    `);

    console.log('\n=== TOTAL GENERAL ENVIADO HOY POR CATEGORÍA ===');
    console.table(totalPorCategoria);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
