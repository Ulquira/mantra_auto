const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log('========================================================================');
    console.log('🔍 INFORME DE AUDITORÍA: CLIENTES A LOS QUE NO SE DEBIÓ ENVIAR MENSAJE HOY');
    console.log('========================================================================\n');

    // 1. Desglose detallado por tipo de fecha y categoría
    const [desglose] = await pool.query(`
      SELECT 
        CASE 
          WHEN DATE(t.\`F.Soli\`) < CURDATE() THEN 'Fecha Pasada (Anterior a hoy)'
          WHEN DATE(t.\`F.Soli\`) > CURDATE() THEN 'Fecha Futura (Posterior a hoy)'
          WHEN t.\`F.Soli\` IS NULL THEN 'Sin Fecha F.Soli (NULL)'
          WHEN DATE(t.\`F.Soli\`) = CURDATE() THEN 'Fecha de HOY (Correcta)'
          ELSE 'Otro'
        END as Tipo_Fecha,
        IFNULL(ts.Tipo, 'Sin Mapear') as Categoria_Servicio,
        COUNT(*) as total_mensajes_enviados,
        COUNT(DISTINCT l.OrdenId) as ordenes_unicas,
        COUNT(DISTINCT t.TeleMovilNume) as telefonos_unicos
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
      GROUP BY Tipo_Fecha, Categoria_Servicio
      ORDER BY Tipo_Fecha, Categoria_Servicio;
    `);

    console.log('1. DESGLOSE COMPLETO:');
    console.table(desglose);

    // 2. Resumen específico de lo indebido (No son de hoy vs De hoy pero no Averías)
    const [resumenIndebidos] = await pool.query(`
      SELECT 
        CASE 
          WHEN (DATE(t.\`F.Soli\`) <> CURDATE() OR t.\`F.Soli\` IS NULL) AND ts.Tipo = 'AVERIAS' 
            THEN 'Averías con fecha NO de hoy'
          WHEN (DATE(t.\`F.Soli\`) <> CURDATE() OR t.\`F.Soli\` IS NULL) AND (ts.Tipo <> 'AVERIAS' OR ts.Tipo IS NULL) 
            THEN 'Otros Servicios (Insta/Postventa) con fecha NO de hoy'
          WHEN DATE(t.\`F.Soli\`) = CURDATE() AND (ts.Tipo <> 'AVERIAS' OR ts.Tipo IS NULL) 
            THEN 'Otros Servicios (Insta/Postventa) con fecha de HOY'
          WHEN DATE(t.\`F.Soli\`) = CURDATE() AND ts.Tipo = 'AVERIAS' 
            THEN 'Averías con fecha de HOY (CORRECTOS)'
          ELSE 'Otros'
        END as Clasificacion_Impacto,
        COUNT(*) as total_mensajes,
        COUNT(DISTINCT l.OrdenId) as total_ordenes_unicas,
        COUNT(DISTINCT t.TeleMovilNume) as total_clientes_telefonos_unicos
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
      GROUP BY Clasificacion_Impacto
      ORDER BY total_mensajes DESC;
    `);

    console.log('\n2. RESUMEN DE IMPACTO (INCORRECTOS VS CORRECTOS):');
    console.table(resumenIndebidos);

    // 3. Totales exactos de clientes indebidos
    const [totalesNoHoy] = await pool.query(`
      SELECT 
        COUNT(*) as total_mensajes_no_hoy,
        COUNT(DISTINCT l.OrdenId) as ordenes_unicas_no_hoy,
        COUNT(DISTINCT t.TeleMovilNume) as clientes_unicos_no_hoy
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
        AND (DATE(t.\`F.Soli\`) <> CURDATE() OR t.\`F.Soli\` IS NULL);
    `);

    console.log('\n3. TOTAL CONSOLIDADO DE ENVIADOS CON FECHA DIFERENTE DE HOY:');
    console.table(totalesNoHoy);

    // 4. Rango de fechas de esas órdenes no pertenecientes a hoy
    const [rangoFechas] = await pool.query(`
      SELECT 
        DATE(t.\`F.Soli\`) as Fecha_F_Soli,
        COUNT(*) as total_mensajes_enviados
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
        AND (DATE(t.\`F.Soli\`) <> CURDATE() OR t.\`F.Soli\` IS NULL)
      GROUP BY DATE(t.\`F.Soli\`)
      ORDER BY Fecha_F_Soli DESC
      LIMIT 15;
    `);

    console.log('\n4. DISTRIBUCIÓN DE LAS FECHAS ERRÓNEAS (Top 15 fechas F.Soli):');
    console.table(rangoFechas);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
