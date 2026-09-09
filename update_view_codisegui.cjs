const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== ACTUALIZANDO VISTA: CRUCE ESTRICTO DE codigo_pedido (custom_1) CON CodiSegui ===");

    await pool.query(`
      CREATE OR REPLACE VIEW vw_reporte_mantra_enriquecido AS
      SELECT 
        r.id AS reporte_id,
        r.contacto_id,
        r.codigo_pedido,
        r.nombre AS nombre_mantra,
        r.telefono,
        r.email,
        r.nombre_plantilla_alias AS plantilla,
        r.estado_mensaje,
        DATE_FORMAT(r.fecha_envio, '%Y-%m-%d %H:%i:%s') AS fecha_envio_wsp,
        r.respuesta_boton,
        DATE_FORMAT(r.fecha_respuesta_boton, '%Y-%m-%d %H:%i:%s') AS fecha_respuesta_boton,
        r.estado_chat,
        r.agente_asignado,
        r.vendor_id AS codigo_mensaje_wsp,
        DATE_FORMAT(r.creado, '%Y-%m-%d %H:%i:%s') AS creado_mantra,
        -- Datos cruzados con la tabla principal (vw_winordetraba)
        t.OrdenId AS orden_id,
        t.CodiSegui AS codi_segui,
        t.ClienteFinal AS cliente_bd,
        t.Estado AS estado_actual_orden,
        t.Producto AS producto,
        t.IdenServi AS plan_servicio,
        t.Zona AS distrito,
        t.\`Sector Operativo\` AS sector_operativo,
        DATE_FORMAT(t.\`F.Soli\`, '%Y-%m-%d %H:%i:%s') AS fecha_cita_bd,
        t.Direccion AS direccion_completa,
        t.token AS tracking_token,
        CONCAT('https://go.win.pe/seguimiento/', t.token) AS tracking_url
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t 
        ON r.codigo_pedido = t.CodiSegui;
    `);

    console.log("✅ Vista vw_reporte_mantra_enriquecido actualizada (JOIN directo: r.codigo_pedido = t.CodiSegui).");

    const [test] = await pool.query(`
      SELECT 
        reporte_id, 
        codigo_pedido, 
        codi_segui, 
        cliente_bd, 
        estado_actual_orden, 
        estado_mensaje, 
        respuesta_boton, 
        sector_operativo
      FROM vw_reporte_mantra_enriquecido
      ORDER BY reporte_id DESC
      LIMIT 10
    `);

    console.log("\n📊 Muestra de datos cruzados:");
    console.table(test);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
