const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const tickets = ['VTR-47354682', 'AT-47270996', 'VTR-47354944', 'GAR-47363743', 'VTR-47366979'];
    
    console.log("=== COMPARATIVA LOG_NOTIFICACIONES_WSP VS REPORTE_PLANTILLAS_MANTRA ===");
    for (const t of tickets) {
      const [logs] = await pool.query(`
        SELECT id, OrdenId, CodiSegui, EstadoNotificado, DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as fecha_envio_lima 
        FROM LOG_NOTIFICACIONES_WSP 
        WHERE CodiSegui = ? OR OrdenId IN (SELECT OrdenId FROM vw_winordetraba WHERE CodiSegui = ?)
      `, [t, t]);

      const [mantra] = await pool.query(`
        SELECT id, contacto_id, codigo_pedido, telefono, nombre_plantilla_alias, DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') as fecha_envio_lima, estado_mensaje
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido = ?
      `, [t]);

      console.log(`\nTicket: ${t}`);
      console.log(`  Filas en LOG_NOTIFICACIONES_WSP (${logs.length}):`, logs.map(l => `LogId ${l.id} | ${l.EstadoNotificado} | ${l.fecha_envio_lima}`));
      console.log(`  Filas en REPORTE_PLANTILLAS_MANTRA (${mantra.length}):`, mantra.map(m => `MantraId ${m.id} | ${m.nombre_plantilla_alias} | ${m.fecha_envio_lima} | ${m.estado_mensaje}`));
    }

    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
