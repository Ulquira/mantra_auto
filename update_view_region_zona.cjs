const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log("=== ACTUALIZANDO VISTA vw_reporte_mantra_enriquecido CON Region Y Zona ===");

    await conn.query(`
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
        t.Region AS region,
        t.Zona AS zona,
        t.Provincia AS provincia,
        t.Localidad AS localidad,
        t.\`Sector Operativo\` AS sector_operativo,
        DATE_FORMAT(t.\`F.Soli\`, '%Y-%m-%d %H:%i:%s') AS fecha_cita_bd,
        t.Direccion AS direccion_completa,
        t.token AS tracking_token,
        CONCAT('https://go.win.pe/seguimiento/', t.token) AS tracking_url
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t 
        ON r.codigo_pedido = t.CodiSegui;
    `);

    console.log("✅ Vista actualizada exitosamente incluyendo Region y Zona.");

    const [rows] = await conn.query(`
      SELECT 
        reporte_id, 
        codigo_pedido, 
        codi_segui, 
        cliente_bd, 
        region, 
        zona, 
        sector_operativo,
        estado_mensaje, 
        respuesta_boton
      FROM vw_reporte_mantra_enriquecido
      WHERE codi_segui IS NOT NULL
      ORDER BY reporte_id DESC
      LIMIT 10
    `);

    console.log("\n📊 Muestra de datos con Region y Zona:");
    console.table(rows);

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
