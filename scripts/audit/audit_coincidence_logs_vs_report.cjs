const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("Calculando coincidencia indexada entre LOG_NOTIFICACIONES_WSP y REPORTE_PLANTILLAS_MANTRA...\n");

    // 1. Coincidencia por CodiSegui para el día de HOY
    const [resHoy] = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.CodiSegui) as total_logs_con_ticket_hoy,
        COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.CodiSegui END) as coincidentes_en_reporte,
        COUNT(DISTINCT CASE WHEN r.id IS NULL THEN l.CodiSegui END) as pendientes_de_sincronizar,
        ROUND(COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.CodiSegui END) * 100.0 / COUNT(DISTINCT l.CodiSegui), 2) as pct_coincidencia
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON l.CodiSegui = r.codigo_pedido
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND l.CodiSegui IS NOT NULL AND l.CodiSegui <> '';
    `);

    console.log("=== 1. COINCIDENCIA DE HOY (POR TICKET / CODISEGUI) ===");
    console.table(resHoy);

    // 2. Coincidencia de los últimos 5 días
    const [resDias] = await pool.query(`
      SELECT 
        DATE(l.fecha_envio) as fecha,
        COUNT(DISTINCT l.CodiSegui) as logs_exitosos_con_ticket,
        COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.CodiSegui END) as en_reporte_mantra,
        ROUND(COUNT(DISTINCT CASE WHEN r.id IS NOT NULL THEN l.CodiSegui END) * 100.0 / COUNT(DISTINCT l.CodiSegui), 2) as pct_coincidencia
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON l.CodiSegui = r.codigo_pedido
      WHERE l.fecha_envio >= CURDATE() - INTERVAL 4 DAY
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND l.CodiSegui IS NOT NULL AND l.CodiSegui <> ''
      GROUP BY DATE(l.fecha_envio)
      ORDER BY fecha DESC;
    `);

    console.log("\n=== 2. HISTÓRICO ÚLTIMOS 5 DÍAS ===");
    console.table(resDias);

    // 3. Totales globales en REPORTE_PLANTILLAS_MANTRA hoy
    const [totalReporte] = await pool.query(`
      SELECT 
        COUNT(*) as total_filas_reporte_hoy,
        COUNT(DISTINCT codigo_pedido) as tickets_unicos_reporte_hoy,
        MIN(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as primer_envio_reporte,
        MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as ultimo_envio_reporte
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) = CURDATE();
    `);

    console.log("\n=== 3. VENTANA Y VOLUMEN DE REPORTE MANTRA HOY ===");
    console.table(totalReporte);

    // 4. Últimos envíos de logs para ver si los "pendientes" son de hace minutos
    const [pendientes] = await pool.query(`
      SELECT 
        l.CodiSegui,
        l.EstadoNotificado,
        DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') as hora_envio_log,
        CASE WHEN r.id IS NOT NULL THEN 'SI' ELSE 'NO (Desfase Cron)' END as sincronizado_en_reporte
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON l.CodiSegui = r.codigo_pedido
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND l.CodiSegui IS NOT NULL AND l.CodiSegui <> ''
      ORDER BY l.fecha_envio DESC
      LIMIT 10;
    `);

    console.log("\n=== 4. MUESTRA ÚLTIMOS 10 ENVÍOS (LOGS VS REPORTE) ===");
    console.table(pendientes);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
