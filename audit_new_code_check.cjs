const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== 1. AUDITORIA DE DUPLICADOS EN LOGS DE HOY (10-SEP) ===");
    const [dupsToday] = await pool.query(`
      SELECT 
        l.OrdenId,
        l.CodiSegui,
        t.ClienteFinal,
        t.TeleMovilNume,
        COUNT(*) as total_envios,
        GROUP_CONCAT(l.id ORDER BY l.id ASC) as log_ids,
        GROUP_CONCAT(l.EstadoNotificado ORDER BY l.id ASC) as estados,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') ORDER BY l.id ASC SEPARATOR ' , ') as horas_lima,
        TIMESTAMPDIFF(SECOND, MIN(l.fecha_envio), MAX(l.fecha_envio)) as segundos_dif
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00')) = CURDATE()
      GROUP BY l.OrdenId, l.CodiSegui, t.ClienteFinal, t.TeleMovilNume
      HAVING COUNT(*) > 1
      ORDER BY total_envios DESC
    `);
    console.log(`Total grupos duplicados hoy: ${dupsToday.length}`);
    console.table(dupsToday);

    console.log("\n=== 2. AUDITORIA DE DUPLICADOS POR TICKET (CodiSegui) HOY ===");
    const [dupsTicket] = await pool.query(`
      SELECT 
        l.CodiSegui,
        COUNT(*) as total_envios,
        GROUP_CONCAT(l.OrdenId ORDER BY l.id ASC) as orden_ids,
        GROUP_CONCAT(l.EstadoNotificado ORDER BY l.id ASC) as estados,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') ORDER BY l.id ASC SEPARATOR ' , ') as horas_lima
      FROM LOG_NOTIFICACIONES_WSP l
      WHERE DATE(CONVERT_TZ(l.fecha_envio, '+00:00', '-05:00')) = CURDATE()
        AND l.CodiSegui IS NOT NULL AND l.CodiSegui <> ''
      GROUP BY l.CodiSegui
      HAVING COUNT(*) > 1
      ORDER BY total_envios DESC
    `);
    console.log(`Total tickets duplicados hoy: ${dupsTicket.length}`);
    console.table(dupsTicket.slice(0, 15));

    console.log("\n=== 3. AUDITORIA DE REPORTE_PLANTILLAS_MANTRA (ENVIOS EN MANTRA HOY) ===");
    const [reporteCount] = await pool.query(`
      SELECT COUNT(*) as total_en_reporte FROM REPORTE_PLANTILLAS_MANTRA
    `);
    console.log(`Total registros en REPORTE_PLANTILLAS_MANTRA: ${reporteCount[0].total_en_reporte}`);

    if (reporteCount[0].total_en_reporte > 0) {
      const [dupsMantra] = await pool.query(`
        SELECT 
          codigo_pedido,
          telefono,
          nombre_plantilla_alias,
          COUNT(*) as envios_mantra,
          GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') SEPARATOR ' , ') as horas_envio
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) = CURDATE()
        GROUP BY codigo_pedido, telefono, nombre_plantilla_alias
        HAVING COUNT(*) > 1
        ORDER BY envios_mantra DESC
        LIMIT 20
      `);
      console.log(`Duplicados detectados desde la API de Mantra: ${dupsMantra.length}`);
      console.table(dupsMantra);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error auditoría:", err.message);
    process.exit(1);
  }
})();
