const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== 1. AUDITORÍA DE DUPLICADOS EXACTOS (Misma OrdenId, mismo día) ===");
    const [dups] = await pool.query(`
      SELECT 
        l.OrdenId,
        t.CodiSegui,
        t.ClienteFinal,
        t.TeleMovilNume,
        l.EstadoNotificado,
        DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00')) as fecha_dia_envio,
        COUNT(*) as total_envios,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') SEPARATOR ' , ') as horas_envio_lima,
        TIMESTAMPDIFF(SECOND, MIN(l.fecha_envio), MAX(l.fecha_envio)) as segundos_diferencia
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      GROUP BY l.OrdenId, t.CodiSegui, t.ClienteFinal, t.TeleMovilNume, l.EstadoNotificado, DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'))
      HAVING COUNT(*) > 1
      ORDER BY total_envios DESC, fecha_dia_envio DESC
      LIMIT 20
    `);
    console.table(dups);

    console.log("\n=== 2. AUDITORÍA DE ENVIOS HOY 10 DE SEPTIEMBRE ===");
    const [enviosHoy] = await pool.query(`
      SELECT 
        l.id,
        l.OrdenId,
        l.CodiSegui,
        l.EstadoNotificado,
        DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as hora_envio_lima,
        t.ClienteFinal,
        t.TeleMovilNume,
        t.Producto,
        ts.Tipo as Categoria,
        t.\`F.Soli\` as fecha_solicitud_orden
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00')) = '2026-09-10'
      ORDER BY l.id ASC
    `);
    console.log(`Total envíos registrados hoy (10 Sep): ${enviosHoy.length}`);
    console.table(enviosHoy.slice(0, 30));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
