const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        l.OrdenId,
        COALESCE(l.CodiSegui, t.CodiSegui, '-') as Ticket,
        t.Producto,
        LEFT(t.ClienteFinal, 20) as Cliente,
        t.TeleMovilNume as Telefono,
        DATE_FORMAT(t.\`F.Soli\`, '%H:%i') as Tramo,
        DATE_FORMAT(l.fecha_envio, '%H:%i:%s') as Hora_Envio,
        COALESCE(r.estado_mensaje, 'sent') as Estado_WSP
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN REPORTE_PLANTILLAS_MANTRA r ON (
        r.orden_id = l.OrdenId 
        OR r.telefono = t.TeleMovilNume 
        OR (l.CodiSegui IS NOT NULL AND l.CodiSegui <> '' AND r.codigo_pedido = l.CodiSegui)
      ) AND DATE(r.fecha_envio) = CURDATE()
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
      GROUP BY l.OrdenId, l.CodiSegui, t.CodiSegui, t.Producto, t.ClienteFinal, t.TeleMovilNume, t.\`F.Soli\`, l.fecha_envio, r.estado_mensaje
      ORDER BY l.fecha_envio DESC
    `);

    console.log("| OrdenId | Ticket | Producto | Cliente | Teléfono | Tramo | Hora Envío | Plantilla en Mantra | Asesor Asignado | Estado WSP |");
    console.log("| :---: | :---: | :---: | :--- | :---: | :---: | :---: | :---: | :--- | :---: |");
    for (const r of rows) {
      console.log(`| ${r.OrdenId} | \`${r.Ticket}\` | **${r.Producto}** | ${r.Cliente} | \`${r.Telefono}\` | ${r.Tramo} | ${r.Hora_Envio} | Averías - Traking | Backofficepostventa | \`${r.Estado_WSP}\` |`);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
