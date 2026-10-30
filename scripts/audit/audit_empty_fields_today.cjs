const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== AUDITORÍA COMPLETA DE CAMPOS VACÍOS DE HOY ===\n');

    const [dbDate] = await pool.query('SELECT CURDATE() as hoy, NOW() as ahora');
    console.log(`Fecha de evaluación (CURDATE): ${dbDate[0].hoy.toISOString ? dbDate[0].hoy.toISOString().slice(0, 10) : dbDate[0].hoy} | Hora DB: ${dbDate[0].ahora}\n`);

    // 1. REPORTE_PLANTILLAS_MANTRA (Todos los envíos sincronizados con fecha de hoy)
    console.log('1. REPORTE_PLANTILLAS_MANTRA (DATE(fecha_envio) = CURDATE()):');
    const [repMantra] = await pool.query(`
      SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN nombre IS NULL OR TRIM(nombre) = '' THEN 1 ELSE 0 END) as nombre_vacio,
        SUM(CASE WHEN orden_id IS NULL OR orden_id = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN codigo_pedido IS NULL OR TRIM(codigo_pedido) = '' THEN 1 ELSE 0 END) as ticket_codigo_pedido_vacio,
        SUM(CASE WHEN telefono IS NULL OR TRIM(telefono) = '' THEN 1 ELSE 0 END) as telefono_vacio,
        SUM(CASE WHEN token IS NULL OR TRIM(token) = '' THEN 1 ELSE 0 END) as token_vacio,
        SUM(CASE WHEN pin IS NULL OR TRIM(pin) = '' THEN 1 ELSE 0 END) as pin_vacio,
        SUM(CASE WHEN agente_asignado IS NULL OR TRIM(agente_asignado) = '' THEN 1 ELSE 0 END) as agente_asignado_vacio
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(fecha_envio) = CURDATE()
    `);
    console.table(repMantra);

    // 1.1 Desglose por Plantilla en REPORTE_PLANTILLAS_MANTRA
    console.log('\n1.1 Desglose por Plantilla en REPORTE_PLANTILLAS_MANTRA:');
    const [repPlantilla] = await pool.query(`
      SELECT 
        nombre_plantilla_alias,
        grupo_servicio,
        COUNT(*) as total,
        SUM(CASE WHEN nombre IS NULL OR TRIM(nombre) = '' THEN 1 ELSE 0 END) as nombre_vacio,
        SUM(CASE WHEN orden_id IS NULL OR orden_id = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN codigo_pedido IS NULL OR TRIM(codigo_pedido) = '' THEN 1 ELSE 0 END) as ticket_vacio,
        SUM(CASE WHEN token IS NULL OR TRIM(token) = '' THEN 1 ELSE 0 END) as token_vacio
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(fecha_envio) = CURDATE()
      GROUP BY nombre_plantilla_alias, grupo_servicio
      ORDER BY total DESC
    `);
    console.table(repPlantilla);

    // 2. HISTORIAL_CHATS_MANTRA (Monitoreo de conversaciones de HOY)
    console.log('\n2. HISTORIAL_CHATS_MANTRA (fecha_gestion_dia = CURDATE()):');
    const [histMantra] = await pool.query(`
      SELECT 
        COUNT(*) as total_chats,
        SUM(CASE WHEN cliente_nombre IS NULL OR TRIM(cliente_nombre) = '' THEN 1 ELSE 0 END) as cliente_nombre_vacio,
        SUM(CASE WHEN orden_id IS NULL OR orden_id = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN ticket IS NULL OR TRIM(ticket) = '' THEN 1 ELSE 0 END) as ticket_vacio,
        SUM(CASE WHEN phone IS NULL OR TRIM(phone) = '' THEN 1 ELSE 0 END) as telefono_vacio,
        SUM(CASE WHEN asesor_asignado IS NULL OR TRIM(asesor_asignado) = '' OR asesor_asignado = 'Sin asignar' THEN 1 ELSE 0 END) as asesor_asignado_vacio,
        SUM(CASE WHEN distrito IS NULL OR TRIM(distrito) = '' THEN 1 ELSE 0 END) as distrito_vacio,
        SUM(CASE WHEN provincia IS NULL OR TRIM(provincia) = '' THEN 1 ELSE 0 END) as provincia_vacio,
        SUM(CASE WHEN producto IS NULL OR TRIM(producto) = '' THEN 1 ELSE 0 END) as producto_vacio
      FROM HISTORIAL_CHATS_MANTRA
      WHERE fecha_gestion_dia = CURDATE()
    `);
    console.table(histMantra);

    // 2.1 Desglose de HISTORIAL_CHATS_MANTRA por grupo de servicio
    console.log('\n2.1 Desglose de HISTORIAL_CHATS_MANTRA por grupo_servicio:');
    const [histGrupo] = await pool.query(`
      SELECT 
        grupo_servicio,
        COUNT(*) as total_chats,
        SUM(CASE WHEN cliente_nombre IS NULL OR TRIM(cliente_nombre) = '' THEN 1 ELSE 0 END) as cliente_nombre_vacio,
        SUM(CASE WHEN orden_id IS NULL OR orden_id = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN ticket IS NULL OR TRIM(ticket) = '' THEN 1 ELSE 0 END) as ticket_vacio,
        SUM(CASE WHEN asesor_asignado IS NULL OR TRIM(asesor_asignado) = '' THEN 1 ELSE 0 END) as asesor_asignado_vacio
      FROM HISTORIAL_CHATS_MANTRA
      WHERE fecha_gestion_dia = CURDATE()
      GROUP BY grupo_servicio
    `);
    console.table(histGrupo);

    // 3. LOG_NOTIFICACIONES_WSP (Despachos emitidos por la API hoy)
    console.log('\n3. LOG_NOTIFICACIONES_WSP (DATE(fecha_envio) = CURDATE()):');
    const [logWsp] = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN OrdenId IS NULL OR OrdenId = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN CodiSegui IS NULL OR TRIM(CodiSegui) = '' THEN 1 ELSE 0 END) as ticket_codisegui_vacio,
        SUM(CASE WHEN EstadoNotificado IS NULL OR TRIM(EstadoNotificado) = '' THEN 1 ELSE 0 END) as estado_vacio,
        SUM(CASE WHEN EnviadoExitosamente = 1 THEN 1 ELSE 0 END) as exitosos,
        SUM(CASE WHEN EnviadoExitosamente = 0 THEN 1 ELSE 0 END) as fallidos
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
    `);
    console.table(logWsp);

    // 4. VW_REPORTE_FUNNEL_CASOS_360 (Vista unificada 360 de hoy)
    console.log('\n4. VW_REPORTE_FUNNEL_CASOS_360 (fecha_solicitud_dia = CURDATE()):');
    const [funnel] = await pool.query(`
      SELECT 
        COUNT(*) as total_ordenes_hoy,
        SUM(CASE WHEN cliente IS NULL OR TRIM(cliente) = '' THEN 1 ELSE 0 END) as cliente_vacio,
        SUM(CASE WHEN orden_id IS NULL OR orden_id = 0 THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN ticket IS NULL OR TRIM(ticket) = '' THEN 1 ELSE 0 END) as ticket_vacio,
        SUM(CASE WHEN telefono IS NULL OR TRIM(telefono) = '' THEN 1 ELSE 0 END) as telefono_vacio,
        SUM(CASE WHEN distrito IS NULL OR TRIM(distrito) = '' THEN 1 ELSE 0 END) as distrito_vacio,
        SUM(CASE WHEN token_tracking IS NULL OR TRIM(token_tracking) = '' THEN 1 ELSE 0 END) as token_tracking_vacio,
        SUM(CASE WHEN se_envio_wsp = 'SI' THEN 1 ELSE 0 END) as wsp_enviado,
        SUM(CASE WHEN se_envio_wsp = 'NO' THEN 1 ELSE 0 END) as wsp_no_enviado
      FROM vw_reporte_funnel_casos_360
      WHERE fecha_solicitud_dia = CURDATE()
    `);
    console.table(funnel);

    // 5. Análisis detallado de los casos con orden_id vacío en REPORTE_PLANTILLAS_MANTRA si existen
    const [muestrasVaciasRep] = await pool.query(`
      SELECT 
        id, 
        telefono, 
        codigo_pedido, 
        orden_id, 
        nombre, 
        nombre_plantilla_alias,
        fecha_envio
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE DATE(fecha_envio) = CURDATE()
        AND (orden_id IS NULL OR orden_id = 0)
      LIMIT 10
    `);
    if (muestrasVaciasRep.length > 0) {
      console.log(`\n5. Casos con orden_id vacío en REPORTE_PLANTILLAS_MANTRA hoy (${muestrasVaciasRep.length} muestra):`);
      console.table(muestrasVaciasRep);
    } else {
      console.log('\n5. REPORTE_PLANTILLAS_MANTRA: 0 casos con orden_id vacío.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error ejecutando auditoría:', err.message);
    process.exit(1);
  }
})();
