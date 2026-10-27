const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== AUDITORÍA PROFUNDA DE CAUSAS RAÍZ: INSTALACIONES NO ENVIADAS (2026-10-26) ===');
    
    // Total de no enviados el 2026-10-26
    const [totalNoEnviados] = await pool.query(`
      SELECT COUNT(*) as total 
      FROM vw_reporte_funnel_casos_360 
      WHERE tipo_operacion = 'INSTALACION' 
        AND fecha_solicitud_dia = '2026-10-26' 
        AND se_envio_wsp = 'NO'
    `);
    const total = totalNoEnviados[0].total;
    console.log(`Total Instalaciones NO enviadas el 26/10: ${total}\n`);

    // Causa 1: Su Ticket (CodiSegui) SÍ fue enviado ese mismo día con OTRO OrdenId (Duplicado de orden por reprog/reagendamiento)
    const [causaTicketEnviado] = await pool.query(`
      SELECT COUNT(DISTINCT f.orden_id) as total
      FROM vw_reporte_funnel_casos_360 f
      INNER JOIN LOG_NOTIFICACIONES_WSP l ON f.ticket = l.CodiSegui
      WHERE f.tipo_operacion = 'INSTALACION' 
        AND f.fecha_solicitud_dia = '2026-10-26' 
        AND f.se_envio_wsp = 'NO'
        AND DATE(l.fecha_envio) = '2026-10-26'
        AND l.EnviadoExitosamente = 1
        AND f.ticket IS NOT NULL AND f.ticket <> '';
    `);

    // Causa 2: Su Teléfono SÍ fue notificado ese mismo día
    const [causaTelefonoEnviado] = await pool.query(`
      SELECT COUNT(DISTINCT f.orden_id) as total
      FROM vw_reporte_funnel_casos_360 f
      INNER JOIN REPORTE_PLANTILLAS_MANTRA m ON f.telefono = m.telefono
      WHERE f.tipo_operacion = 'INSTALACION' 
        AND f.fecha_solicitud_dia = '2026-10-26' 
        AND f.se_envio_wsp = 'NO'
        AND DATE(m.fecha_envio) = '2026-10-26'
        AND f.telefono IS NOT NULL AND f.telefono <> '';
    `);

    // Causa 3: Órdenes que llegaron o terminaron en estado Cancelada / Anulada / Regestión / Finalizada sin haber pasado por Agendada en el cron
    const [porEstadoDetalle] = await pool.query(`
      SELECT 
        f.estado_ot,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / ${total}, 2) as pct
      FROM vw_reporte_funnel_casos_360 f
      WHERE f.tipo_operacion = 'INSTALACION' 
        AND f.fecha_solicitud_dia = '2026-10-26' 
        AND f.se_envio_wsp = 'NO'
      GROUP BY f.estado_ot;
    `);

    // Causa 4: Fallos directos en LOG_NOTIFICACIONES_WSP (EnviadoExitosamente = 0)
    const [fallosDirectos] = await pool.query(`
      SELECT 
        l.DetallesError,
        COUNT(*) as total
      FROM vw_reporte_funnel_casos_360 f
      INNER JOIN LOG_NOTIFICACIONES_WSP l ON f.orden_id = l.OrdenId
      WHERE f.tipo_operacion = 'INSTALACION' 
        AND f.fecha_solicitud_dia = '2026-10-26' 
        AND f.se_envio_wsp = 'NO'
      GROUP BY l.DetallesError;
    `);

    console.log(`1. Ticket (CodiSegui) ya notificado ese mismo día bajo otro OrdenId: ${causaTicketEnviado[0].total}`);
    console.log(`2. Mismo Teléfono notificado ese mismo día en Mantra: ${causaTelefonoEnviado[0].total}`);
    console.log(`3. Fallos registrados en LOG_NOTIFICACIONES_WSP (EnviadoExitosamente = 0): ${fallosDirectos.reduce((a, b) => a + b.total, 0)}`);
    console.log(`\n4. Desglose completo por estado final de la OT:`);
    console.table(porEstadoDetalle);

    // Cruzar todo clasificado exhaustivamente
    const [clasificacion] = await pool.query(`
      SELECT 
        CASE 
          WHEN l_ticket.id IS NOT NULL THEN '1. DEDUP / REAGENDADO: Ticket ya notificado hoy con otro OrdenId'
          WHEN f.estado_ot IN ('Cancelada', 'Anulada') THEN '2. CANCELADA/ANULADA antes de notificación'
          WHEN f.estado_ot = 'Finalizada' THEN '3. FINALIZADA directamente (cerrada en campo/administrativo)'
          WHEN f.estado_ot IN ('Regestión', 'Iniciada') THEN '4. ESTADO DE OPERACIÓN NO NOTIFICABLE (Regestión/Iniciada)'
          WHEN f.estado_ot IN ('Agendada', 'Pendiente', 'En camino') AND l_err.id IS NOT NULL THEN '5. ERROR DE ENVÍO API MANTRA'
          WHEN f.estado_ot IN ('Agendada', 'Pendiente', 'En camino') AND l_err.id IS NULL THEN '6. NO PROCESADA EN COLA (Pendiente/Revisar)'
          ELSE '7. OTROS'
        END as motivo_exacto,
        COUNT(*) as cantidad,
        ROUND(COUNT(*) * 100.0 / ${total}, 2) as porcentaje
      FROM vw_reporte_funnel_casos_360 f
      LEFT JOIN (
        SELECT id, CodiSegui 
        FROM LOG_NOTIFICACIONES_WSP 
        WHERE DATE(fecha_envio) = '2026-10-26' AND EnviadoExitosamente = 1
      ) l_ticket ON f.ticket = l_ticket.CodiSegui AND f.ticket IS NOT NULL AND f.ticket <> ''
      LEFT JOIN (
        SELECT id, OrdenId 
        FROM LOG_NOTIFICACIONES_WSP 
        WHERE DATE(fecha_envio) = '2026-10-26' AND EnviadoExitosamente = 0
      ) l_err ON f.orden_id = l_err.OrdenId
      WHERE f.tipo_operacion = 'INSTALACION' 
        AND f.fecha_solicitud_dia = '2026-10-26' 
        AND f.se_envio_wsp = 'NO'
      GROUP BY motivo_exacto
      ORDER BY cantidad DESC;
    `);

    console.log('\n=== CLASIFICACIÓN EXHAUSTIVA DE LAS 115 INSTALACIONES NO ENVIADAS (26/10) ===');
    console.table(clasificacion);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
