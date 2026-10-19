const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("Calculando coincidencia LOG_NOTIFICACIONES_WSP vs REPORTE_PLANTILLAS_MANTRA por Área/Servicio...\n");

    // 1. Coincidencia por Área de HOY
    const [porAreaHoy] = await pool.query(`
      SELECT 
        ts.Tipo as Area_Servicio,
        COUNT(DISTINCT l.OrdenId) as logs_exitosos_hoy,
        COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as en_reporte_mantra,
        ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND ts.Tipo IN ('AVERIAS', 'INSTALACION', 'PROVINCIA', 'AVERIAS PRV')
      GROUP BY ts.Tipo
      ORDER BY logs_exitosos_hoy DESC;
    `);

    console.log("=== 1. COINCIDENCIA POR ÁREA (HOY EN VIVO) ===");
    console.table(porAreaHoy);

    // 2. Coincidencia por Área en DÍAS CERRADOS (Consolidados sin desfase de Cron)
    const [porAreaCerrados] = await pool.query(`
      SELECT 
        ts.Tipo as Area_Servicio,
        COUNT(DISTINCT l.OrdenId) as logs_exitosos_historico,
        COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as en_reporte_mantra,
        ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
      WHERE l.fecha_envio >= '2026-10-16' AND l.fecha_envio < '2026-10-19'
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND ts.Tipo IN ('AVERIAS', 'INSTALACION', 'PROVINCIA', 'AVERIAS PRV')
      GROUP BY ts.Tipo
      ORDER BY logs_exitosos_historico DESC;
    `);

    console.log("\n=== 2. COINCIDENCIA POR ÁREA EN DÍAS CERRADOS CONSOLIDADOS (16-18 OCT) ===");
    console.table(porAreaCerrados);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
