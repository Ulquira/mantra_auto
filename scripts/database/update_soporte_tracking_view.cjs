const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== ACTUALIZANDO VISTA vw_reporte_soporte_tracking_app ===");

    const sql = `
      CREATE OR REPLACE VIEW vw_reporte_soporte_tracking_app AS 
      SELECT 
        l.id AS tracking_log_id,
        l.token AS token,
        l.evento AS evento,
        l.sistema_operativo AS sistema_operativo,
        l.timestamp AS fecha_evento_web,
        CAST(CONVERT_TZ(l.timestamp, '+00:00', '-05:00') AS DATE) AS fecha_evento_web_dia_lima,
        DATE_FORMAT(CONVERT_TZ(l.timestamp, '+00:00', '-05:00'), '%H:%i:%s') AS hora_evento_web_lima,
        t.OrdenId AS orden_id,
        t.CodiSegui AS ticket,
        t.ClienteFinal AS cliente,
        t.TeleMovilNume AS telefono,
        t.Producto AS producto,
        t.TipoTraba AS tipo_trabajo,
        t.IdenServi AS plan_servicio,
        t.Estado AS estado_orden,
        t.Region AS region,
        t.Zona AS zona,
        t.\`Sector Operativo\` AS sector_operativo,
        t.Direccion AS direccion,
        CONCAT('https://go.win.pe/seguimiento/', l.token) AS tracking_url,
        trk_summary.ultimas_interacciones_web AS ultimas_interacciones_web,
        m.nombre_plantilla_alias AS plantilla_wsp,
        m.estado_mensaje AS estado_wsp,
        m.fecha_envio AS fecha_envio_wsp,
        m.respuesta_boton AS respuesta_boton_wsp,
        COALESCE(CONVERT(m.agente_asignado USING utf8mb4), h.asesor_asignado, 'Sin asignar') AS asesor_asignado,
        h.cliente_ultimo_texto AS mensaje_escrito_cliente,
        DATE_FORMAT(CONVERT_TZ(h.cliente_ultima_fecha, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') AS fecha_mensaje_cliente_lima,
        h.asesor_ultimo_texto AS ultima_respuesta_asesor,
        DATE_FORMAT(CONVERT_TZ(h.asesor_ultima_fecha, '+00:00', '-05:00'), '%Y-%m-%d %H:%i:%s') AS fecha_respuesta_asesor_lima,
        CASE WHEN h.tuvo_respuesta = 1 THEN 'SI' ELSE 'NO' END AS asesor_respondio,
        COALESCE(h.tiempo_espera_minutos, 0) AS tiempo_espera_minutos
      FROM logs_traking l
      JOIN vw_winordetraba t ON l.token = t.token
      LEFT JOIN reporte_plantillas_mantra m ON t.CodiSegui = m.codigo_pedido
      LEFT JOIN historial_chats_mantra h ON (
        (h.orden_id IS NOT NULL AND h.orden_id = t.OrdenId)
        OR (h.orden_id IS NULL AND t.TeleMovilNume IS NOT NULL AND t.TeleMovilNume != '' AND RIGHT(t.TeleMovilNume, 9) = RIGHT(h.phone, 9))
      )
      LEFT JOIN (
        SELECT 
          token,
          GROUP_CONCAT(CONCAT(DATE_FORMAT(CONVERT_TZ(timestamp, '+00:00', '-05:00'), '%H:%i'), ': ', evento) ORDER BY timestamp DESC SEPARATOR ' | ') AS ultimas_interacciones_web
        FROM logs_traking
        WHERE token IS NOT NULL AND token != ''
        GROUP BY token
      ) trk_summary ON l.token = trk_summary.token
      WHERE l.evento IN ('click_contactar_soporte', 'click_contactar_soporte_cerrada');
    `;

    await pool.query(sql);
    console.log("✔ Vista vw_reporte_soporte_tracking_app recreada con éxito.");

    console.log("\nProbando consulta SELECT sobre la vista...");
    const [rows] = await pool.query("SELECT * FROM vw_reporte_soporte_tracking_app LIMIT 3");
    console.log(`✔ Consulta exitosa. Se obtuvieron ${rows.length} registros.`);
    if (rows.length > 0) {
      console.log("Muestra del primer registro:");
      console.table([rows[0]]);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
