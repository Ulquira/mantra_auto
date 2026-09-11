const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== Creando/Actualizando vista de agregación de tracking ===");
    
    // Primero, vista o subquery para tracking
    await pool.query(`
      CREATE OR REPLACE VIEW vw_tracking_resumen AS
      SELECT 
        token,
        COUNT(*) AS total_interacciones_web,
        MIN(timestamp) AS primer_ingreso_web,
        MAX(timestamp) AS ultimo_ingreso_web,
        SUBSTRING_INDEX(GROUP_CONCAT(evento ORDER BY timestamp ASC SEPARATOR ' | '), ' | ', 1) AS primer_evento_web,
        SUBSTRING_INDEX(GROUP_CONCAT(evento ORDER BY timestamp DESC SEPARATOR ' | '), ' | ', 1) AS ultimo_evento_web,
        SUBSTRING_INDEX(GROUP_CONCAT(sistema_operativo ORDER BY timestamp DESC SEPARATOR ' | '), ' | ', 1) AS sistema_operativo_web
      FROM logs_traking
      WHERE token IS NOT NULL AND token <> ''
      GROUP BY token;
    `);
    console.log("✔ Vista vw_tracking_resumen creada.");

    // Ahora creamos la vista enriquecida completa
    const viewSql = `
      CREATE OR REPLACE VIEW vw_reporte_mantra_enriquecido AS
      SELECT 
        r.id AS reporte_id,
        r.contacto_id,
        r.codigo_pedido,
        r.nombre AS nombre_mantra,
        r.telefono,
        r.email,
        r.nombre_plantilla_alias AS plantilla,
        r.grupo_servicio,
        r.estado_mensaje,
        -- Indicadores clave
        'SI' AS se_envio_mantra,
        CASE 
          WHEN trk.total_interacciones_web > 0 THEN 'SI' 
          ELSE 'NO' 
        END AS ingreso_link_seguimiento,
        COALESCE(trk.total_interacciones_web, 0) AS total_interacciones_web,
        -- Fechas Mantra en tipo DATETIME y DATE nativo
        r.fecha_envio AS fecha_envio_wsp,
        CAST(r.fecha_envio AS DATE) AS fecha_envio_wsp_dia,
        r.respuesta_boton,
        r.fecha_respuesta_boton AS fecha_respuesta_boton,
        r.estado_chat,
        r.agente_asignado,
        r.vendor_id AS codigo_mensaje_wsp,
        r.creado AS creado_mantra,
        CAST(r.creado AS DATE) AS creado_mantra_dia,
        -- Tracking Web en tipo DATETIME y DATE nativo
        trk.primer_ingreso_web,
        CAST(trk.primer_ingreso_web AS DATE) AS primer_ingreso_web_dia,
        trk.ultimo_ingreso_web,
        CAST(trk.ultimo_ingreso_web AS DATE) AS ultimo_ingreso_web_dia,
        trk.primer_evento_web,
        trk.ultimo_evento_web,
        trk.sistema_operativo_web,
        -- Datos cruzados con la tabla principal (vw_winordetraba)
        t.OrdenId AS orden_id,
        t.CodiSegui AS codi_segui,
        t.ClienteFinal AS cliente_bd,
        t.Estado AS estado_actual_orden,
        t.Producto AS producto,
        t.IdenServi AS plan_servicio,
        t.Region AS region,
        t.Zona AS zona,
        t.Provincia AS provincia,
        t.Localidad AS localidad,
        t.\`Sector Operativo\` AS sector_operativo,
        -- Fechas Orden en tipo DATETIME y DATE nativo
        t.\`F.Soli\` AS fecha_cita_bd,
        CAST(t.\`F.Soli\` AS DATE) AS fecha_cita_bd_dia,
        t.\`F.Visita\` AS fecha_visita_bd,
        t.FechaUltiEsta AS fecha_ultimo_estado_bd,
        t.Direccion AS direccion_completa,
        t.token AS tracking_token,
        CONCAT('https://go.win.pe/seguimiento/', t.token) AS tracking_url
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t 
        ON r.codigo_pedido = t.CodiSegui
      LEFT JOIN vw_tracking_resumen trk
        ON t.token = trk.token;
    `;

    await pool.query(viewSql);
    console.log("✔ Vista vw_reporte_mantra_enriquecido actualizada exitosamente.");

    // Validar tipos de datos de las columnas en la vista
    const [cols] = await pool.query("SHOW COLUMNS FROM vw_reporte_mantra_enriquecido");
    console.log("\n=== TIPOS DE COLUMNAS EN LA VISTA ===");
    console.table(cols.map(c => ({ Columna: c.Field, Tipo: c.Type })));

    // Muestra de datos con tracking e indicadores
    const [sample] = await pool.query(`
      SELECT 
        reporte_id,
        codigo_pedido,
        nombre_mantra,
        plantilla,
        se_envio_mantra,
        ingreso_link_seguimiento,
        total_interacciones_web,
        fecha_envio_wsp,
        primer_ingreso_web,
        respuesta_boton,
        region,
        zona,
        sector_operativo
      FROM vw_reporte_mantra_enriquecido
      ORDER BY total_interacciones_web DESC, reporte_id DESC
      LIMIT 10
    `);
    console.log("\n=== MUESTRA DE DATOS ENRIQUECIDOS ===");
    console.table(sample);

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
