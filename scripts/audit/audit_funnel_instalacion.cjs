const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== 1. TASA DE ENVÍOS VS NO ENVÍOS (INSTALACION ÚLTIMOS 5 DÍAS) ===');
    const [stats] = await pool.query(`
      SELECT 
        fecha_solicitud_dia,
        COUNT(*) as total_ordenes,
        SUM(CASE WHEN se_envio_wsp = 'SI' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN se_envio_wsp = 'NO' THEN 1 ELSE 0 END) as no_enviados,
        ROUND(SUM(CASE WHEN se_envio_wsp = 'NO' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as pct_no_enviados
      FROM vw_reporte_funnel_casos_360
      WHERE tipo_operacion = 'INSTALACION'
        AND fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
      GROUP BY fecha_solicitud_dia
      ORDER BY fecha_solicitud_dia DESC;
    `);
    console.table(stats);

    console.log('\n=== 2. ESTADO_OT DE LAS NO ENVIADAS (INSTALACION) ===');
    const [porEstado] = await pool.query(`
      SELECT 
        estado_ot,
        COUNT(*) as total,
        ROUND(COUNT(*) * 100.0 / (
          SELECT COUNT(*) FROM vw_reporte_funnel_casos_360 
          WHERE tipo_operacion = 'INSTALACION' AND se_envio_wsp = 'NO' 
            AND fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
        ), 2) as pct
      FROM vw_reporte_funnel_casos_360
      WHERE tipo_operacion = 'INSTALACION'
        AND se_envio_wsp = 'NO'
        AND fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
      GROUP BY estado_ot
      ORDER BY total DESC;
    `);
    console.table(porEstado);

    console.log('\n=== 3. ANÁLISIS DE FILTROS EN LAS NO ENVIADAS CON ESTADO AGENDADA/PENDIENTE/EN CAMINO ===');
    const [analisisFiltros] = await pool.query(`
      SELECT 
        COUNT(*) as total_candidatas_no_enviadas,
        SUM(CASE WHEN telefono IS NULL OR TRIM(telefono) = '' OR LENGTH(REPLACE(telefono, ' ', '')) < 9 THEN 1 ELSE 0 END) as sin_telefono_valido,
        SUM(CASE WHEN link_tracking IS NULL OR link_tracking LIKE '%null' OR token_tracking IS NULL OR TRIM(token_tracking) = '' THEN 1 ELSE 0 END) as sin_token_tracking,
        SUM(CASE WHEN sector_operativo IS NULL OR TRIM(sector_operativo) = '' THEN 1 ELSE 0 END) as sin_sector_operativo,
        SUM(CASE WHEN producto IS NULL OR TRIM(producto) = '' THEN 1 ELSE 0 END) as sin_producto
      FROM vw_reporte_funnel_casos_360
      WHERE tipo_operacion = 'INSTALACION'
        AND se_envio_wsp = 'NO'
        AND estado_ot IN ('Agendada', 'Pendiente', 'En camino')
        AND fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY);
    `);
    console.table(analisisFiltros);

    console.log('\n=== 4. REVISIÓN EN LOG_NOTIFICACIONES_WSP DE LAS NO ENVIADAS (¿HUBIERON ERRORES O OMITIDAS?) ===');
    const [erroresLog] = await pool.query(`
      SELECT 
        l.EnviadoExitosamente,
        l.DetallesError,
        COUNT(*) as total
      FROM vw_reporte_funnel_casos_360 f
      INNER JOIN LOG_NOTIFICACIONES_WSP l ON f.orden_id = l.OrdenId
      WHERE f.tipo_operacion = 'INSTALACION'
        AND f.se_envio_wsp = 'NO'
        AND f.fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
      GROUP BY l.EnviadoExitosamente, l.DetallesError;
    `);
    console.table(erroresLog);

    console.log('\n=== 5. MUESTRA DE 10 CASOS NO ENVIADOS (AGENDADAS / PENDIENTES / EN CAMINO) ===');
    const [muestra] = await pool.query(`
      SELECT 
        orden_id,
        ticket,
        estado_ot,
        fecha_solicitud,
        sector_operativo,
        provincia,
        telefono,
        producto
      FROM vw_reporte_funnel_casos_360
      WHERE tipo_operacion = 'INSTALACION'
        AND se_envio_wsp = 'NO'
        AND estado_ot IN ('Agendada', 'Pendiente', 'En camino')
        AND fecha_solicitud_dia >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
      LIMIT 10;
    `);
    console.table(muestra);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
