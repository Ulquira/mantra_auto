require('dotenv').config();
const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== ATENCIONES vs MENSAJES ENVIADOS - ÚLTIMOS 5 DÍAS ===\n');

    // 1. Total de órdenes activas/trabajadas por tipo en los últimos 5 días
    //    (universo real de atenciones que DEBERIAN haber recibido notificación)
    const [ordenes] = await pool.query(`
      SELECT 
        ts.Tipo AS tipo_servicio,
        COUNT(DISTINCT t.OrdenId) AS total_atenciones
      FROM vw_winordetraba t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE t.FechaTrabajo >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND t.TeleMovilNume IS NOT NULL
        AND t.TeleMovilNume != ''
        AND t.TeleMovilNume != '0'
      GROUP BY ts.Tipo
      ORDER BY total_atenciones DESC
    `);

    // 2. Total de mensajes enviados exitosamente por tipo
    const [mensajes] = await pool.query(`
      SELECT 
        COALESCE(ts.Tipo, 'SIN TIPO') AS tipo_servicio,
        COUNT(DISTINCT l.OrdenId) AS ordenes_notificadas,
        COUNT(*) AS total_mensajes,
        SUM(l.EnviadoExitosamente = 1) AS mensajes_exitosos,
        SUM(l.EnviadoExitosamente = 0) AS mensajes_fallidos
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND l.EstadoNotificado != 'Reprogramacion'
      GROUP BY COALESCE(ts.Tipo, 'SIN TIPO')
      ORDER BY total_mensajes DESC
    `);

    // 3. Cruce: atenciones vs notificadas vs cobertura
    const [cobertura] = await pool.query(`
      SELECT 
        ts.Tipo AS tipo_servicio,
        COUNT(DISTINCT t.OrdenId) AS total_atenciones,
        COUNT(DISTINCT l.OrdenId) AS ordenes_con_msj,
        COUNT(DISTINCT CASE WHEN l.EnviadoExitosamente = 1 THEN l.OrdenId END) AS ordenes_exitosas,
        COUNT(DISTINCT CASE WHEN t.OrdenId IS NOT NULL AND l.OrdenId IS NULL THEN t.OrdenId END) AS sin_notificacion,
        ROUND(
          COUNT(DISTINCT l.OrdenId) * 100.0 / NULLIF(COUNT(DISTINCT t.OrdenId), 0), 1
        ) AS pct_cobertura,
        ROUND(
          COUNT(DISTINCT CASE WHEN l.EnviadoExitosamente = 1 THEN l.OrdenId END) * 100.0 
          / NULLIF(COUNT(DISTINCT t.OrdenId), 0), 1
        ) AS pct_exitoso
      FROM vw_winordetraba t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l 
        ON l.OrdenId = t.OrdenId 
        AND l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND l.EstadoNotificado != 'Reprogramacion'
      WHERE t.FechaTrabajo >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND t.TeleMovilNume IS NOT NULL
        AND t.TeleMovilNume != ''
        AND t.TeleMovilNume != '0'
        AND ts.Tipo IN ('INSTALACION','AVERIAS','PROVINCIA','AVERIAS PRV')
      GROUP BY ts.Tipo
      ORDER BY total_atenciones DESC
    `);

    // 4. Gran total
    const [gran_total] = await pool.query(`
      SELECT 
        COUNT(DISTINCT t.OrdenId) AS total_atenciones_universo,
        COUNT(DISTINCT l.OrdenId) AS ordenes_con_msj_enviado,
        COUNT(DISTINCT CASE WHEN l.EnviadoExitosamente = 1 THEN l.OrdenId END) AS ordenes_exitosas,
        ROUND(
          COUNT(DISTINCT l.OrdenId) * 100.0 / NULLIF(COUNT(DISTINCT t.OrdenId),0), 1
        ) AS pct_cobertura_total,
        COUNT(l.id) AS total_mensajes_generados,
        SUM(l.EnviadoExitosamente = 1) AS total_mensajes_exitosos
      FROM vw_winordetraba t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l 
        ON l.OrdenId = t.OrdenId 
        AND l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND l.EstadoNotificado != 'Reprogramacion'
      WHERE t.FechaTrabajo >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND t.TeleMovilNume IS NOT NULL
        AND t.TeleMovilNume != ''
        AND t.TeleMovilNume != '0'
        AND ts.Tipo IN ('INSTALACION','AVERIAS','PROVINCIA','AVERIAS PRV')
    `);

    console.log('📦 UNIVERSO DE ATENCIONES CON TELÉFONO (últimos 5 días):');
    console.table(ordenes);

    console.log('\n💬 MENSAJES GENERADOS EN LOG por tipo:');
    console.table(mensajes);

    console.log('\n📊 CRUCE: ATENCIONES vs NOTIFICACIONES (cobertura real):');
    console.table(cobertura);

    console.log('\n🏁 GRAN TOTAL:');
    console.table(gran_total);

    console.log('\n💡 NOTA:');
    console.log('  - total_atenciones   = órdenes en vw_winordetraba con teléfono válido');
    console.log('  - ordenes_con_msj    = órdenes que tienen al menos 1 registro en LOG');
    console.log('  - ordenes_exitosas   = órdenes donde al menos 1 mensaje llegó OK');
    console.log('  - sin_notificacion   = órdenes que NUNCA recibieron un mensaje');
    console.log('  - pct_cobertura      = % de atenciones que fueron notificadas (incluyendo reintentos)');
    console.log('  - pct_exitoso        = % de atenciones con al menos 1 mensaje exitoso');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
})();
