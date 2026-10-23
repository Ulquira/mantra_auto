const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== VERIFICACION CASOS GARANTIA Y REITERADA ===\n');

    // 1. Mapeo en TipoServicio
    const [ts] = await pool.query(`
      SELECT IDservicio, Servicio, Tipo 
      FROM TipoServicio 
      WHERE Servicio IN ('GARANTIA', 'REITERADA', 'REITERADO') 
         OR Tipo IN ('GARANTIA', 'REITERADA', 'POSTVENTA')
    `);
    console.log('1. MAPEO EN TABLA TipoServicio:');
    console.table(ts);

    // 2. Órdenes de HOY con GARANTIA o REITERADA en vw_winordetraba
    const [hoy] = await pool.query(`
      SELECT 
        t.Producto,
        ts.Tipo as TipoServicio_Tipo,
        t.Estado,
        COUNT(*) as total_ordenes_hoy,
        SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) as enviados_hoy,
        SUM(CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END) as en_cola_ahora
      FROM vw_winordetraba t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (t.OrdenId = l.OrdenId AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1)
      LEFT JOIN COLA_NOTIFICACIONES_MANTRA c ON t.OrdenId = c.ordenId
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(t.\`F.Soli\`) = CURDATE()
      GROUP BY t.Producto, ts.Tipo, t.Estado
    `);
    console.log('\n2. ORDENES DE HOY (F.Soli = CURDATE()):');
    console.table(hoy);

    // 3. Tramos y envíos de HOY para GARANTIA y REITERADA
    const [tramos] = await pool.query(`
      SELECT 
        t.Producto,
        TIME(t.\`F.Soli\`) as tramo,
        COUNT(l.id) as total_enviados
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
      GROUP BY t.Producto, TIME(t.\`F.Soli\`)
      ORDER BY t.Producto, tramo
    `);
    console.log('\n3. TRAMOS DESPACHADOS HOY:');
    console.table(tramos);

    // 4. Verificación de Asesor asignado en Mantra hoy (REPORTE_PLANTILLAS_MANTRA)
    const [reporte] = await pool.query(`
      SELECT 
        t.Producto,
        r.agente_asignado,
        r.nombre_plantilla_alias,
        r.grupo_servicio,
        COUNT(*) as total
      FROM REPORTE_PLANTILLAS_MANTRA r
      INNER JOIN vw_winordetraba t ON r.orden_id = t.OrdenId
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(r.fecha_envio) = CURDATE()
      GROUP BY t.Producto, r.agente_asignado, r.nombre_plantilla_alias, r.grupo_servicio
    `);
    console.log('\n4. ASIGNACIÓN EN MANTRA (REPORTE_PLANTILLAS_MANTRA):');
    console.table(reporte);

    // 5. Ver en HISTORIAL_CHATS_MANTRA
    const [hist] = await pool.query(`
      SELECT 
        producto,
        asesor_asignado,
        COUNT(*) as total
      FROM HISTORIAL_CHATS_MANTRA
      WHERE (producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
      GROUP BY producto, asesor_asignado
    `);
    console.log('\n5. ASIGNACIÓN EN HISTORIAL_CHATS_MANTRA (HISTORICO RECIENTE):');
    console.table(hist);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
