const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== AUDITORÍA PROFUNDA DEL 14 AL 16 DE OCTUBRE ===\n");

    // 1. Resumen general del 14 al 16 de Octubre
    const [resumen] = await pool.query(`
      SELECT 
        DATE(l.fecha_envio) as fecha,
        COUNT(DISTINCT l.OrdenId) as total_logs_exitosos,
        COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) as cruzados_por_token_o_ticket,
        COUNT(DISTINCT CASE WHEN r_tok.id IS NULL AND r_cod.id IS NULL THEN l.OrdenId END) as no_cruzados,
        ROUND(COUNT(DISTINCT CASE WHEN r_tok.id IS NOT NULL OR r_cod.id IS NOT NULL THEN l.OrdenId END) * 100.0 / COUNT(DISTINCT l.OrdenId), 2) as pct_coincidencia
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
      WHERE l.fecha_envio >= '2026-10-14' AND l.fecha_envio < '2026-10-17'
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
      GROUP BY DATE(l.fecha_envio)
      ORDER BY fecha ASC;
    `);
    console.table(resumen);

    // 2. Extraer una muestra de los "no cruzados" para ver si existen en el reporte por TELEFONO
    const [muestra] = await pool.query(`
      SELECT 
        l.id as log_id,
        l.OrdenId,
        l.CodiSegui,
        t.token as orden_token,
        t.TeleMovilNume as orden_telefono,
        ts.Tipo as tipo_servicio,
        DATE_FORMAT(l.fecha_envio, '%Y-%m-%d %H:%i:%s') as fecha_envio_log
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_tok ON t.token = r_tok.token
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r_cod ON l.CodiSegui = r_cod.codigo_pedido
      WHERE l.fecha_envio >= '2026-10-14' AND l.fecha_envio < '2026-10-17'
        AND l.EnviadoExitosamente = 1
        AND l.DetallesError IS NULL
        AND r_tok.id IS NULL AND r_cod.id IS NULL
      LIMIT 10;
    `);

    console.log("\n=== MUESTRA DE 10 REGISTROS NO CRUZADOS (ANALIZANDO POR QUÉ NO COINCIDEN) ===");
    console.table(muestra);

    // 3. Para cada uno de la muestra, buscar en REPORTE_PLANTILLAS_MANTRA por teléfono
    console.log("\nBuscando esos teléfonos en REPORTE_PLANTILLAS_MANTRA...");
    for (const item of muestra) {
      const telLimpio = String(item.orden_telefono || '').replace(/\D/g, '').slice(-9);
      const [enReporte] = await pool.query(`
        SELECT id, contacto_id, codigo_pedido, token, telefono, nombre_plantilla_alias, fecha_envio, estado_mensaje
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE telefono LIKE ? OR telefono LIKE ?
        LIMIT 3;
      `, [`%${telLimpio}`, `51${telLimpio}`]);

      console.log(`Orden ${item.OrdenId} | Ticket: ${item.CodiSegui} | Token: ${item.orden_token} | Tel: ${item.orden_telefono}`);
      if (enReporte.length > 0) {
        console.log(`   -> SÍ ESTÁ en reporte con: codigo_pedido='${enReporte[0].codigo_pedido}', token='${enReporte[0].token}', estado='${enReporte[0].estado_mensaje}'`);
      } else {
        console.log(`   -> NO APARECE en REPORTE_PLANTILLAS_MANTRA ni por teléfono.`);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
