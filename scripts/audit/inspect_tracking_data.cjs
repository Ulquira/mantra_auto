const { pool } = require('../../mantra_service.cjs');

(async () => {
  // Coincidencia usando el TOKEN de seguimiento
  const [resToken] = await pool.query(`
    SELECT 
      COUNT(DISTINCT l.OrdenId) as total_logs_hoy,
      COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.OrdenId END) as coincidencias_por_token,
      ROUND(COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia
    FROM LOG_NOTIFICACIONES_WSP l
    INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON t.token = r.token
    WHERE DATE(l.fecha_envio) = CURDATE()
      AND l.EnviadoExitosamente = 1
      AND l.DetallesError IS NULL;
  `);

  console.log("=== COINCIDENCIA POR TOKEN (HOY) ===");
  console.table(resToken);

  // Coincidencia considerando Token O CodiSegui
  const [resAmbos] = await pool.query(`
    SELECT 
      COUNT(DISTINCT l.OrdenId) as total_logs_hoy,
      COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as total_coincidentes,
      ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_total_coincidencia
    FROM LOG_NOTIFICACIONES_WSP l
    INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
    WHERE DATE(l.fecha_envio) = CURDATE()
      AND l.EnviadoExitosamente = 1
      AND l.DetallesError IS NULL;
  `);

  console.log("=== COINCIDENCIA POR TOKEN O CODISEGUI (HOY) ===");
  console.table(resAmbos);

  pool.end();
})();
