const { pool } = require('../../mantra_service.cjs');

(async () => {
  // Coincidencia incorporando el teléfono (limpio a 9 dígitos) para Oct 14 al 16
  const [resPhoneMatch] = await pool.query(`
    SELECT 
      DATE(l.fecha_envio) as fecha,
      COUNT(DISTINCT l.OrdenId) as total_logs_exitosos,
      COUNT(DISTINCT CASE 
        WHEN (r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL OR r_tel.id IS NOT NULL) 
        THEN l.OrdenId 
      END) as total_coincidentes,
      ROUND(COUNT(DISTINCT CASE 
        WHEN (r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL OR r_tel.id IS NOT NULL) 
        THEN l.OrdenId 
      END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia_real
    FROM LOG_NOTIFICACIONES_WSP l
    INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
    LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tel ON (
      RIGHT(REGEXP_REPLACE(t.TeleMovilNume, '[^0-9]', ''), 9) = RIGHT(REGEXP_REPLACE(r_tel.telefono, '[^0-9]', ''), 9)
      AND DATE(CONVERT_TZ(r_tel.fecha_envio, '+00:00', '-05:00')) = DATE(l.fecha_envio)
    )
    WHERE l.fecha_envio >= '2026-10-14' AND l.fecha_envio < '2026-10-17'
      AND l.EnviadoExitosamente = 1
      AND l.DetallesError IS NULL
    GROUP BY DATE(l.fecha_envio)
    ORDER BY fecha ASC;
  `);

  console.log("=== COINCIDENCIA REAL CONSIDERANDO TOKEN + TICKET + TELÉFONO (14 AL 16 OCT) ===");
  console.table(resPhoneMatch);

  pool.end();
})();
