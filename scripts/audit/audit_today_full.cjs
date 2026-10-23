const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== AUDITORIA COMPLETA DE ENVIOS HOY ===\n');

    // 1. Total general y desglose por estado notificado
    const [estados] = await pool.query(`
      SELECT 
        EstadoNotificado,
        EnviadoExitosamente,
        COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
      GROUP BY EstadoNotificado, EnviadoExitosamente
    `);
    console.log('1. DESGLOSE LOG NOTIFICACIONES WSP:');
    console.table(estados);

    // 2. Tramos y Servicios
    const [tramos] = await pool.query(`
      SELECT 
        COALESCE(ts.Tipo, 'Sin Mapear') as Servicio,
        TIME(t.\`F.Soli\`) as Tramo,
        COUNT(*) as Total
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      GROUP BY COALESCE(ts.Tipo, 'Sin Mapear'), TIME(t.\`F.Soli\`)
      ORDER BY Servicio, Tramo
    `);
    console.log('\n2. ENVIOS POR SERVICIO Y HORARIO TRAMO (F.Soli):');
    console.table(tramos);

    // 3. Distribución por hora de envío (America/Lima)
    const [porHora] = await pool.query(`
      SELECT 
        HOUR(fecha_envio) as hora_peru,
        COUNT(*) as total_despachados
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE() AND EnviadoExitosamente = 1
      GROUP BY hora_peru
      ORDER BY hora_peru
    `);
    console.log('\n3. RITMO DE DESPACHO POR HORA HOY (Peru Time):');
    console.table(porHora);

    // 4. Reporte Mantra (Recepción / Lectura en WhatsApp)
    const [reporte] = await pool.query(`
      SELECT 
        estado_mensaje,
        COUNT(*) as total,
        SUM(CASE WHEN respuesta_boton IS NOT NULL THEN 1 ELSE 0 END) as con_respuesta_boton
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(fecha_envio) = CURDATE()
      GROUP BY estado_mensaje
    `);
    console.log('\n4. ESTADOS DE ENTREGA EN WHATSAPP (REPORTE_PLANTILLAS_MANTRA):');
    console.table(reporte);

    // 5. Botones seleccionados
    const [botones] = await pool.query(`
      SELECT respuesta_boton, COUNT(*) as cantidad
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(fecha_envio) = CURDATE() AND respuesta_boton IS NOT NULL
      GROUP BY respuesta_boton
    `);
    console.log('\n5. BOTONES SELECCIONADOS POR CLIENTES HOY:');
    console.table(botones);

    // 6. Estado de la cola actual pendiente
    const [cola] = await pool.query(`
      SELECT 
        COALESCE(ts.Tipo, 'Sin Mapear') as TipoServicio,
        TIME(t.\`F.Soli\`) as Tramo,
        COUNT(*) as pendientes_cola
      FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      GROUP BY COALESCE(ts.Tipo, 'Sin Mapear'), TIME(t.\`F.Soli\`)
      ORDER BY TipoServicio, Tramo
    `);
    console.log('\n6. EN COLA PENDIENTE DE DESPACHO AHORA:');
    console.table(cola);

    // 7. Muestra de casos en cola 08 y 12
    const [colaDetalle] = await pool.query(`
      SELECT 
        c.ordenId,
        c.fecha_ingreso,
        t.Estado,
        t.Producto,
        ts.Tipo,
        DATE(t.\`F.Soli\`) as f_soli_date,
        TIME(t.\`F.Soli\`) as f_soli_time,
        t.Localidad,
        l.id as ya_en_log,
        l.DetallesError
      FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (c.ordenId = l.OrdenId AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1)
      WHERE TIME(t.\`F.Soli\`) IN ('08:00:00', '12:00:00')
      LIMIT 10
    `);
    console.log('\n7. DETALLE MUESTRA COLA (08:00 y 12:00):');
    console.table(colaDetalle);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
