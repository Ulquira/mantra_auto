require('dotenv').config();
const { pool } = require('../../mantra_service.cjs');

async function checkAfterSyncFix() {
  console.log('=== VERIFICANDO DATOS TRAS RE-SINCRONIZACIÓN (16-19 OCTUBRE) ===');

  const [repStats] = await pool.query(`
    SELECT 
      DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as fecha_lima,
      COUNT(*) as total_filas,
      SUM(CASE WHEN telefono IS NULL OR telefono = '' THEN 1 ELSE 0 END) as sin_telefono,
      SUM(CASE WHEN token IS NOT NULL AND token <> '' THEN 1 ELSE 0 END) as con_token
    FROM reporte_plantillas_mantra
    WHERE fecha_envio >= CURDATE() - INTERVAL 4 DAY
    GROUP BY fecha_lima
    ORDER BY fecha_lima DESC
  `);
  console.log('Tabla reporte_plantillas_mantra:');
  console.table(repStats);

  const [vwStats] = await pool.query(`
    SELECT 
      DATE(fecha_solicitud) as dia,
      COUNT(*) as total_ordenes,
      SUM(CASE WHEN se_envio_mantra = 'SI' THEN 1 ELSE 0 END) as enviados_mantra
    FROM vw_reporte_ordenes_tracking
    WHERE fecha_solicitud >= CURDATE() - INTERVAL 4 DAY
    GROUP BY dia
    ORDER BY dia DESC
  `);
  console.log('\nVista vw_reporte_ordenes_tracking (Power BI):');
  console.table(vwStats);

  await pool.end();
}

checkAfterSyncFix().catch(console.error);
