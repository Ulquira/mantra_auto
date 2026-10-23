const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        l.id as log_id,
        l.OrdenId,
        l.CodiSegui as Ticket,
        t.Producto,
        LEFT(t.ClienteFinal, 25) as Cliente,
        t.TeleMovilNume as Telefono,
        t.Estado as Estado_Actual,
        l.EstadoNotificado,
        DATE_FORMAT(t.\`F.Soli\`, '%Y-%m-%d %H:%i') as F_Soli,
        DATE_FORMAT(l.fecha_envio, '%Y-%m-%d %H:%i:%s') as Fecha_Envio,
        l.EnviadoExitosamente as Ok
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(l.fecha_envio) = CURDATE()
      ORDER BY l.id DESC
    `);

    console.log(`\n📋 TOTAL REGISTROS EN LOG HOY: ${rows.length}`);
    console.table(rows);

    // Cruzar con REPORTE_PLANTILLAS_MANTRA para ver qué registró Mantra realmente
    const [cruceMantra] = await pool.query(`
      SELECT 
        l.OrdenId,
        t.Producto,
        t.TeleMovilNume,
        r.id as mantra_report_id,
        r.template_id,
        r.nombre_plantilla_alias,
        r.grupo_servicio,
        r.agente_asignado,
        r.estado_mensaje,
        r.fecha_envio as fecha_mantra
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON (
        r.orden_id = l.OrdenId 
        OR r.telefono = t.TeleMovilNume 
        OR (l.CodiSegui IS NOT NULL AND l.CodiSegui <> '' AND r.codigo_pedido = l.CodiSegui)
      ) AND DATE(r.fecha_envio) = CURDATE()
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(l.fecha_envio) = CURDATE()
      ORDER BY l.id DESC
    `);

    console.log(`\n🔍 CRUCE CON REPORTE_PLANTILLAS_MANTRA:`);
    console.table(cruceMantra);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
