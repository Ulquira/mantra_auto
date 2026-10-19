require('dotenv').config();
const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== RESUMEN DE NOTIFICACIONES ENVIADAS - ÚLTIMOS 5 DÍAS ===\n');

    // 1. Resumen por tipo de servicio y día
    const [resumenDia] = await pool.query(`
      SELECT 
        DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00')) AS fecha_lima,
        ts.Tipo AS tipo_servicio,
        COUNT(*) AS total_enviados,
        SUM(l.EnviadoExitosamente = 1) AS exitosos,
        SUM(l.EnviadoExitosamente = 0) AS fallidos,
        SUM(l.EstadoNotificado = 'Reprogramacion') AS reprogramaciones
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
        AND l.EstadoNotificado NOT IN ('Reprogramacion')
      GROUP BY fecha_lima, ts.Tipo
      ORDER BY fecha_lima DESC, total_enviados DESC
    `);

    // 2. Totales globales por tipo
    const [totalesGlobal] = await pool.query(`
      SELECT 
        COALESCE(ts.Tipo, l.EstadoNotificado) AS tipo_servicio,
        COUNT(*) AS total_enviados,
        SUM(l.EnviadoExitosamente = 1) AS exitosos,
        SUM(l.EnviadoExitosamente = 0) AS fallidos,
        COUNT(DISTINCT t.TeleMovilNume) AS clientes_unicos,
        MIN(DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'))) AS primer_dia,
        MAX(DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'))) AS ultimo_dia
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
      GROUP BY COALESCE(ts.Tipo, l.EstadoNotificado)
      ORDER BY total_enviados DESC
    `);

    // 3. Reprogramaciones por tipo
    const [reprogs] = await pool.query(`
      SELECT 
        COALESCE(ts.Tipo, 'DESCONOCIDO') AS tipo_servicio,
        COUNT(*) AS total_reprogramaciones,
        SUM(l.EnviadoExitosamente = 1) AS exitosas
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN reprogramaciones r ON l.OrdenId = r.id
      LEFT JOIN vw_winordetraba t ON r.token = t.token
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE l.EstadoNotificado = 'Reprogramacion'
        AND l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
      GROUP BY ts.Tipo
    `);

    // 4. Gran total
    const [gran_total] = await pool.query(`
      SELECT 
        COUNT(*) AS total_notificaciones,
        SUM(l.EnviadoExitosamente = 1) AS total_exitosas,
        SUM(l.EnviadoExitosamente = 0) AS total_fallidas,
        COUNT(DISTINCT t.TeleMovilNume) AS total_clientes_unicos
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE l.fecha_envio >= DATE_SUB(NOW(), INTERVAL 5 DAY)
    `);

    console.log('📊 TOTALES POR TIPO DE SERVICIO (Últimos 5 días):');
    console.table(totalesGlobal);

    console.log('\n📅 DESGLOSE POR DÍA Y TIPO (excluye reprogramaciones):');
    console.table(resumenDia);

    if (reprogs.length > 0) {
      console.log('\n🔄 REPROGRAMACIONES ENVIADAS:');
      console.table(reprogs);
    }

    console.log('\n🏁 GRAN TOTAL ÚLTIMOS 5 DÍAS:');
    console.table(gran_total);

  } catch (err) {
    console.error('❌ Error ejecutando auditoría:', err.message);
  } finally {
    await pool.end();
  }
})();
