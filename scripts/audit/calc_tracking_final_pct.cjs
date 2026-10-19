const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    // 1. Resumen por fecha (14 al 16 de Octubre) en vw_winordetraba cruzado con Mantra
    const [resumenFechas] = await pool.query(`
      SELECT 
        DATE(t.\`F.Soli\`) as fecha,
        COUNT(*) as total_ordenes_universo,
        SUM(CASE WHEN t.Estado IN ('Agendada', 'Pendiente', 'En camino') THEN 1 ELSE 0 END) as total_calificadas,
        SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) as enviadas_confirmadas_mantra,
        ROUND(
          SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) * 100.0 / 
          SUM(CASE WHEN t.Estado IN ('Agendada', 'Pendiente', 'En camino') THEN 1 ELSE 0 END), 
          2
        ) as pct_cobertura_calificadas,
        ROUND(
          SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pct_cobertura_universo_total
      FROM vw_winordetraba t
      LEFT JOIN (
        SELECT token
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE token IS NOT NULL AND token <> ''
        GROUP BY token
      ) m_tok ON t.token = m_tok.token
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_cod ON (t.CodiSegui = m_cod.codigo_pedido)
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_doc ON (t.\`Número Documento\` = m_doc.codigo_pedido)
      WHERE t.\`F.Soli\` >= '2026-10-14' AND t.\`F.Soli\` < '2026-10-17'
      GROUP BY DATE(t.\`F.Soli\`);
    `);

    console.log("=== 1. COINCIDENCIA POR FECHA (14 AL 16 OCT) ===");
    console.table(resumenFechas);

    // 2. Resumen por Área de Servicio (14 al 16 de Octubre)
    const [resumenAreas] = await pool.query(`
      SELECT 
        ts.Tipo as area_servicio,
        COUNT(*) as total_ordenes,
        SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) as enviadas_confirmadas_mantra,
        ROUND(
          SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pct_cobertura
      FROM vw_winordetraba t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN (
        SELECT token
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE token IS NOT NULL AND token <> ''
        GROUP BY token
      ) m_tok ON t.token = m_tok.token
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_cod ON (t.CodiSegui = m_cod.codigo_pedido)
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_doc ON (t.\`Número Documento\` = m_doc.codigo_pedido)
      WHERE t.\`F.Soli\` >= '2026-10-14' AND t.\`F.Soli\` < '2026-10-17'
        AND ts.Tipo IN ('AVERIAS', 'INSTALACION', 'PROVINCIA', 'AVERIAS PRV')
      GROUP BY ts.Tipo
      ORDER BY total_ordenes DESC;
    `);

    console.log("\n=== 2. COINCIDENCIA POR ÁREA (14 AL 16 OCT) ===");
    console.table(resumenAreas);

    // 3. Estado de HOY (19 Octubre)
    const [resumenHoy] = await pool.query(`
      SELECT 
        ts.Tipo as area_servicio,
        COUNT(*) as total_ordenes_hoy,
        SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) as enviadas_confirmadas_mantra,
        ROUND(
          SUM(CASE WHEN (m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL) THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 
          2
        ) as pct_cobertura
      FROM vw_winordetraba t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN (
        SELECT token
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE token IS NOT NULL AND token <> ''
        GROUP BY token
      ) m_tok ON t.token = m_tok.token
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_cod ON (t.CodiSegui = m_cod.codigo_pedido)
      LEFT JOIN (
        SELECT codigo_pedido
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_doc ON (t.\`Número Documento\` = m_doc.codigo_pedido)
      WHERE DATE(t.\`F.Soli\`) = CURDATE()
        AND ts.Tipo IN ('AVERIAS', 'INSTALACION', 'PROVINCIA', 'AVERIAS PRV')
      GROUP BY ts.Tipo
      ORDER BY total_ordenes_hoy DESC;
    `);

    console.log("\n=== 3. COINCIDENCIA DE HOY (19 OCT) ===");
    console.table(resumenHoy);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
