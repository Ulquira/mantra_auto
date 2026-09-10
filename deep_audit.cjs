const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== 1. AUDITORÍA GENERAL DE ENVIOS POR DÍA ===");
    const [enviosPorDia] = await pool.query(`
      SELECT 
        DATE(fecha_envio) as fecha_envio_utc,
        DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as fecha_envio_lima,
        HOUR(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as hora_envio_lima,
        EstadoNotificado,
        EnviadoExitosamente,
        COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP
      GROUP BY DATE(fecha_envio), DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')), HOUR(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')), EstadoNotificado, EnviadoExitosamente
      ORDER BY fecha_envio_utc DESC, hora_envio_lima DESC
    `);
    console.table(enviosPorDia);

    console.log("\n=== 2. DETECCIÓN DE DUPLICADOS POR OrdenId ===");
    const [dupOrden] = await pool.query(`
      SELECT 
        OrdenId,
        COUNT(*) as cantidad_envios,
        GROUP_CONCAT(id ORDER BY id ASC) as log_ids,
        GROUP_CONCAT(EstadoNotificado ORDER BY id ASC) as estados,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') ORDER BY id ASC SEPARATOR ' | ') as fechas_envio_lima,
        GROUP_CONCAT(EnviadoExitosamente ORDER BY id ASC) as exitos
      FROM LOG_NOTIFICACIONES_WSP
      GROUP BY OrdenId
      HAVING COUNT(*) > 1
      ORDER BY cantidad_envios DESC
      LIMIT 30
    `);
    console.log(`Total OrdenIds con más de 1 envío: ${dupOrden.length}`);
    console.table(dupOrden.slice(0, 15));

    console.log("\n=== 3. DETECCIÓN DE DUPLICADOS POR Ticket (CodiSegui) o Teléfono ===");
    const [dupTickets] = await pool.query(`
      SELECT 
        t.CodiSegui,
        t.ClienteFinal,
        t.TeleMovilNume,
        COUNT(l.id) as cantidad_envios,
        GROUP_CONCAT(l.OrdenId ORDER BY l.id ASC) as orden_ids,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') ORDER BY l.id ASC SEPARATOR ' | ') as fechas_envio_lima
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE t.CodiSegui IS NOT NULL AND t.CodiSegui <> ''
      GROUP BY t.CodiSegui, t.ClienteFinal, t.TeleMovilNume
      HAVING COUNT(l.id) > 1
      ORDER BY cantidad_envios DESC
      LIMIT 30
    `);
    console.log(`Total Tickets con más de 1 envío a través de diferentes órdenes o reintentos: ${dupTickets.length}`);
    console.table(dupTickets.slice(0, 15));

    console.log("\n=== 4. ANÁLISIS DE REPROGRAMACIONES ENVIADAS ===");
    const [reprogLogs] = await pool.query(`
      SELECT 
        l.id as log_id,
        l.OrdenId as reprog_id,
        l.EstadoNotificado,
        CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00') as fecha_envio_lima,
        r.token,
        r.fecha_solicitada,
        r.turno,
        t.OrdenId as orden_real,
        t.ClienteFinal,
        t.Producto,
        ts.Tipo as tipo_servicio
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN reprogramaciones r ON l.OrdenId = r.id
      LEFT JOIN vw_winordetraba t ON r.token = t.token
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE l.EstadoNotificado = 'Reprogramacion'
      ORDER BY l.id DESC
      LIMIT 20
    `);
    console.table(reprogLogs);

    console.log("\n=== 5. ENVIOS REALIZADOS HOY (10 de Septiembre) O FECHAS RECIENTES ===");
    const [recientes] = await pool.query(`
      SELECT 
        l.id,
        l.OrdenId,
        l.EstadoNotificado,
        CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00') as fecha_envio_lima,
        t.ClienteFinal,
        t.Producto,
        ts.Tipo as Categoria,
        t.\`F.Soli\` as fecha_soli_orden
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      ORDER BY l.id DESC
      LIMIT 20
    `);
    console.table(recientes);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
