const { pool } = require('../../mantra_service.cjs');

(async () => {
  // Coincidencia para mensajes enviados antes de las 14:00 hoy (antes del último corte del Cron)
  const [resCorte] = await pool.query(`
    SELECT 
      COUNT(DISTINCT l.OrdenId) as logs_antes_de_las_14h,
      COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as coincidentes_en_reporte,
      ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia_corte_14h
    FROM LOG_NOTIFICACIONES_WSP l
    INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
    WHERE DATE(l.fecha_envio) = CURDATE()
      AND CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00') <= '2026-10-19 13:56:00'
      AND l.EnviadoExitosamente = 1
      AND l.DetallesError IS NULL;
  `);

  console.log("=== COINCIDENCIA HASTA EL ÚLTIMO CORTE DEL CRON (13:56 Lima) ===");
  console.table(resCorte);

  // Coincidencia de ayer completo (2026-10-18) y anteayer (2026-10-17)
  const [resDiasCompletos] = await pool.query(`
    SELECT 
      DATE(l.fecha_envio) as fecha,
      COUNT(DISTINCT l.OrdenId) as total_logs,
      COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as coincidentes_en_reporte,
      ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia
    FROM LOG_NOTIFICACIONES_WSP l
    INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
    WHERE l.fecha_envio >= '2026-10-16' AND l.fecha_envio < '2026-10-19'
      AND l.EnviadoExitosamente = 1
      AND l.DetallesError IS NULL
    GROUP BY DATE(l.fecha_envio)
    ORDER BY fecha DESC;
  `);

  console.log("=== COINCIDENCIA EN DÍAS COMPLETAMENTE CERRADOS ===");
  console.table(resDiasCompletos);

  pool.end();
})();
