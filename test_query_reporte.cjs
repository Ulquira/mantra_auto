const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=================================================================================");
    console.log("📊 1. TOTAL REGISTROS Y RESUMEN POR ESTADO DE MENSAJE Y PLANTILLA");
    console.log("=================================================================================");
    
    const [resumen] = await pool.query(`
      SELECT 
        nombre_plantilla_alias AS Plantilla,
        COUNT(*) AS Total_Enviados,
        SUM(CASE WHEN estado_mensaje = 'read' THEN 1 ELSE 0 END) AS Leidos,
        SUM(CASE WHEN estado_mensaje = 'delivered' THEN 1 ELSE 0 END) AS Entregados,
        SUM(CASE WHEN estado_mensaje = 'sent' THEN 1 ELSE 0 END) AS Enviados_Sin_Entrega,
        SUM(CASE WHEN estado_mensaje = 'failed' THEN 1 ELSE 0 END) AS Fallidos,
        SUM(CASE WHEN respuesta_boton IS NOT NULL THEN 1 ELSE 0 END) AS Con_Respuesta_Boton
      FROM REPORTE_PLANTILLAS_MANTRA
      GROUP BY nombre_plantilla_alias
    `);
    console.table(resumen);

    console.log("\n=================================================================================");
    console.log("🔘 2. DESGLOSE DE RESPUESTAS RÁPIDAS DE LOS CLIENTES (BOTONES)");
    console.log("=================================================================================");
    
    const [respuestas] = await pool.query(`
      SELECT 
        COALESCE(respuesta_boton, '[Sin interacción]') AS Respuesta_Boton,
        COUNT(*) AS Total,
        CONCAT(ROUND((COUNT(*) / (SELECT COUNT(*) FROM REPORTE_PLANTILLAS_MANTRA)) * 100, 2), '%') AS Porcentaje
      FROM REPORTE_PLANTILLAS_MANTRA
      GROUP BY respuesta_boton
      ORDER BY Total DESC
    `);
    console.table(respuestas);

    console.log("\n=================================================================================");
    console.log("📋 3. VISTA DETALLADA CON TODOS LOS CAMPOS DE UN CASO COMPLETO");
    console.log("=================================================================================");
    
    const [unRegistro] = await pool.query(`
      SELECT *
      FROM REPORTE_PLANTILLAS_MANTRA
      WHERE respuesta_boton IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
    `);
    console.dir(unRegistro[0], { depth: null });

    console.log("\n=================================================================================");
    console.log("🔍 4. CRUCE EN TIEMPO REAL CON LA ORDEN (vw_winordetraba)");
    console.log("=================================================================================");
    
    const [cruceOrdenes] = await pool.query(`
      SELECT 
        r.contacto_id,
        r.nombre AS Cliente_Mantra,
        r.telefono,
        r.custom_1 AS Ticket_Mantra,
        r.custom_2 AS Fecha_Cita,
        r.custom_3 AS Horario,
        r.estado_mensaje AS Estado_WSP,
        r.respuesta_boton AS Respuesta_Cliente,
        t.Estado AS Estado_Actual_BD,
        t.\`Sector Operativo\` AS Sector_Operativo,
        t.Producto
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t ON r.custom_1 = t.CodiSegui OR r.telefono = RIGHT(t.TeleMovilNume, 9)
      WHERE r.respuesta_boton IS NOT NULL
      ORDER BY r.id DESC
      LIMIT 8
    `);
    console.table(cruceOrdenes);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
