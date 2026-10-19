const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== ACTUALIZANDO VISTAS DE REPORTERÍA CON ARQUITECTURA DE ALTA VELOCIDAD PARA POWER BI ===");

    // 1. Actualizar vw_reporte_mantra_enriquecido
    console.log("\n1. Actualizando vista vw_reporte_mantra_enriquecido...");
    await pool.query(`
      CREATE OR REPLACE VIEW vw_reporte_mantra_enriquecido AS
      SELECT 
        r.id AS reporte_id,
        r.contacto_id,
        r.codigo_pedido,
        r.token AS token_reporte,
        r.nombre AS nombre_mantra,
        r.telefono,
        r.email,
        r.nombre_plantilla_alias AS plantilla,
        COALESCE(
          ts.Tipo,
          CASE 
            WHEN r.nombre_plantilla_alias LIKE '%Aver%' THEN 'AVERIAS'
            WHEN r.nombre_plantilla_alias LIKE '%Instala%' THEN 'INSTALACION'
            ELSE r.grupo_servicio 
          END
        ) AS grupo_servicio,
        r.estado_mensaje,
        'SI' AS se_envio_mantra,
        CASE 
          WHEN trk.total_interacciones_web > 0 THEN 'SI' 
          ELSE 'NO' 
        END AS ingreso_link_seguimiento,
        COALESCE(trk.total_interacciones_web, 0) AS total_interacciones_web,
        CONVERT_TZ(r.fecha_envio, '+00:00', '-05:00') AS fecha_envio_wsp,
        CAST(CONVERT_TZ(r.fecha_envio, '+00:00', '-05:00') AS DATE) AS fecha_envio_wsp_dia,
        r.respuesta_boton,
        CONVERT_TZ(r.fecha_respuesta_boton, '+00:00', '-05:00') AS fecha_respuesta_boton,
        r.estado_chat,
        r.agente_asignado,
        r.vendor_id AS codigo_mensaje_wsp,
        CONVERT_TZ(r.creado, '+00:00', '-05:00') AS creado_mantra,
        CAST(CONVERT_TZ(r.creado, '+00:00', '-05:00') AS DATE) AS creado_mantra_dia,
        trk.primer_ingreso_web,
        CAST(trk.primer_ingreso_web AS DATE) AS primer_ingreso_web_dia,
        trk.ultimo_ingreso_web,
        CAST(trk.ultimo_ingreso_web AS DATE) AS ultimo_ingreso_web_dia,
        trk.primer_evento_web,
        trk.ultimo_evento_web,
        trk.sistema_operativo_web,
        -- Resolución multillave con vw_winordetraba: Token -> Ticket -> DNI -> Teléfono
        COALESCE(t_token.OrdenId, t_codi.OrdenId, t_doc.OrdenId, t_tel.OrdenId) AS orden_id,
        COALESCE(t_token.CodiSegui, t_codi.CodiSegui, t_doc.CodiSegui, t_tel.CodiSegui) AS codi_segui,
        COALESCE(t_token.ClienteFinal, t_codi.ClienteFinal, t_doc.ClienteFinal, t_tel.ClienteFinal) AS cliente_bd,
        COALESCE(t_token.Estado, t_codi.Estado, t_doc.Estado, t_tel.Estado) AS estado_actual_orden,
        COALESCE(t_token.Producto, t_codi.Producto, t_doc.Producto, t_tel.Producto) AS producto,
        COALESCE(t_token.IdenServi, t_codi.IdenServi, t_doc.IdenServi, t_tel.IdenServi) AS plan_servicio,
        COALESCE(t_token.Region, t_codi.Region, t_doc.Region, t_tel.Region) AS region,
        COALESCE(t_token.Zona, t_codi.Zona, t_doc.Zona, t_tel.Zona) AS zona,
        COALESCE(t_token.Provincia, t_codi.Provincia, t_doc.Provincia, t_tel.Provincia) AS provincia,
        COALESCE(t_token.Localidad, t_codi.Localidad, t_doc.Localidad, t_tel.Localidad) AS localidad,
        COALESCE(t_token.\`Sector Operativo\`, t_codi.\`Sector Operativo\`, t_doc.\`Sector Operativo\`, t_tel.\`Sector Operativo\`) AS sector_operativo,
        COALESCE(t_token.\`F.Soli\`, t_codi.\`F.Soli\`, t_doc.\`F.Soli\`, t_tel.\`F.Soli\`) AS fecha_cita_bd,
        CAST(COALESCE(t_token.\`F.Soli\`, t_codi.\`F.Soli\`, t_doc.\`F.Soli\`, t_tel.\`F.Soli\`) AS DATE) AS fecha_cita_bd_dia,
        COALESCE(t_token.\`F.Visita\`, t_codi.\`F.Visita\`, t_doc.\`F.Visita\`, t_tel.\`F.Visita\`) AS fecha_visita_bd,
        COALESCE(t_token.FechaUltiEsta, t_codi.FechaUltiEsta, t_doc.FechaUltiEsta, t_tel.FechaUltiEsta) AS fecha_ultimo_estado_bd,
        COALESCE(t_token.Direccion, t_codi.Direccion, t_doc.Direccion, t_tel.Direccion) AS direccion_completa,
        COALESCE(t_token.token, t_codi.token, t_doc.token, t_tel.token, r.token) AS tracking_token,
        CONCAT('https://go.win.pe/seguimiento/', COALESCE(t_token.token, t_codi.token, t_doc.token, t_tel.token, r.token)) AS tracking_url
      FROM REPORTE_PLANTILLAS_MANTRA r
      -- 1. Intentar por token exacto
      LEFT JOIN vw_winordetraba t_token 
        ON (r.token IS NOT NULL AND r.token <> '' AND r.token = t_token.token)
      -- 2. Fallback por CodiSegui
      LEFT JOIN vw_winordetraba t_codi 
        ON (t_token.OrdenId IS NULL AND r.codigo_pedido IS NOT NULL AND r.codigo_pedido <> '' AND r.codigo_pedido = t_codi.CodiSegui)
      -- 3. Fallback por DNI / Documento
      LEFT JOIN vw_winordetraba t_doc 
        ON (t_token.OrdenId IS NULL AND t_codi.OrdenId IS NULL AND r.codigo_pedido IS NOT NULL AND r.codigo_pedido <> '' AND r.codigo_pedido = t_doc.\`Número Documento\`)
      -- 4. Fallback directo por Teléfono indexado del mismo día
      LEFT JOIN vw_winordetraba t_tel 
        ON (t_token.OrdenId IS NULL AND t_codi.OrdenId IS NULL AND t_doc.OrdenId IS NULL 
            AND r.telefono IS NOT NULL AND r.telefono <> ''
            AND t_tel.TeleMovilNume = r.telefono
            AND CAST(t_tel.\`F.Soli\` AS DATE) = CAST(CONVERT_TZ(r.fecha_envio, '+00:00', '-05:00') AS DATE))
      -- Tipo de servicio
      LEFT JOIN TipoServicio ts 
        ON (COALESCE(t_token.Producto, t_codi.Producto, t_doc.Producto, t_tel.Producto) = ts.Servicio)
      -- Interacciones de tracking
      LEFT JOIN (
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
        GROUP BY token
      ) trk ON (COALESCE(t_token.token, t_codi.token, t_doc.token, t_tel.token, r.token) = trk.token);
    `);
    console.log("✔ Vista vw_reporte_mantra_enriquecido actualizada exitosamente.");

    // 2. Actualizar vw_reporte_ordenes_tracking (Ultra-rápida, sin OR ni scans)
    console.log("\n2. Actualizando vista vw_reporte_ordenes_tracking con Hash Join puro...");
    await pool.query(`
      CREATE OR REPLACE VIEW vw_reporte_ordenes_tracking AS
      SELECT 
        t.OrdenId AS orden_id,
        CAST(t.CodiSegui AS CHAR(50) CHARSET utf8mb4) AS ticket,
        CAST(t.ClienteFinal AS CHAR(150) CHARSET utf8mb4) AS cliente,
        CAST(t.TeleMovilNume AS CHAR(20) CHARSET utf8mb4) AS telefono,
        CAST(t.Producto AS CHAR(100) CHARSET utf8mb4) AS producto,
        CAST(t.TipoTraba AS CHAR(100) CHARSET utf8mb4) AS tipo_trabajo,
        CAST(t.IdenServi AS CHAR(255) CHARSET utf8mb4) AS plan,
        CAST(t.Estado AS CHAR(50) CHARSET utf8mb4) AS estado_orden,
        t.\`F.Soli\` AS fecha_solicitud,
        CAST(t.\`F.Soli\` AS DATE) AS fecha_solicitud_dia,
        t.\`F.Visita\` AS fecha_visita,
        CAST(t.Region AS CHAR(50) CHARSET utf8mb4) AS region,
        CAST(t.Zona AS CHAR(50) CHARSET utf8mb4) AS zona,
        CAST(t.\`Sector Operativo\` AS CHAR(50) CHARSET utf8mb4) AS sector_operativo,
        CAST(t.Direccion AS CHAR(255) CHARSET utf8mb4) AS direccion,
        CAST(t.Cuadrilla_nombre AS CHAR(100) CHARSET utf8mb4) AS cuadrilla,
        CAST(CONCAT('https://go.win.pe/seguimiento/', t.token) AS CHAR(255) CHARSET utf8mb4) AS link_seguimiento,
        -- Indicador de envío Mantra (Optimizado: Token -> CodiSegui -> DNI)
        CAST(
          CASE 
            WHEN m_tok.token IS NOT NULL OR m_cod.codigo_pedido IS NOT NULL OR m_doc.codigo_pedido IS NOT NULL 
            THEN 'SI' 
            ELSE 'NO' 
          END AS CHAR(2) CHARSET utf8mb4
        ) AS se_envio_mantra,
        COALESCE(m_tok.fecha_envio_wsp, m_cod.fecha_envio_wsp, m_doc.fecha_envio_wsp) AS fecha_envio_wsp,
        CAST(COALESCE(m_tok.estado_mensaje_wsp, m_cod.estado_mensaje_wsp, m_doc.estado_mensaje_wsp) AS CHAR(50) CHARSET utf8mb4) AS estado_wsp,
        CAST(COALESCE(m_tok.plantilla_wsp, m_cod.plantilla_wsp, m_doc.plantilla_wsp) AS CHAR(100) CHARSET utf8mb4) AS plantilla_wsp,
        CAST(COALESCE(m_tok.respuesta_boton_wsp, m_cod.respuesta_boton_wsp, m_doc.respuesta_boton_wsp) AS CHAR(150) CHARSET utf8mb4) AS respuesta_boton,
        -- Interacción Web
        CAST(
          CASE 
            WHEN trk.total_interacciones_web > 0 THEN 'SI' 
            ELSE 'NO' 
          END AS CHAR(2) CHARSET utf8mb4
        ) AS ingreso_link,
        COALESCE(trk.total_interacciones_web, 0) AS total_interacciones_web,
        trk.primer_ingreso_web,
        trk.ultimo_ingreso_web
      FROM vw_winordetraba t
      -- 1. Cruce directo por Token
      LEFT JOIN (
        SELECT 
          token,
          MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS estado_mensaje_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS plantilla_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR ' | '), ' | ', 1) AS respuesta_boton_wsp
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE token IS NOT NULL AND token <> ''
        GROUP BY token
      ) m_tok ON (t.token = m_tok.token)
      -- 2. Fallback por CodiSegui (Ticket) - SIN OR (Hash Join indexado)
      LEFT JOIN (
        SELECT 
          codigo_pedido,
          MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS estado_mensaje_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS plantilla_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR ' | '), ' | ', 1) AS respuesta_boton_wsp
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_cod ON (m_tok.token IS NULL AND t.CodiSegui = m_cod.codigo_pedido)
      -- 3. Fallback por DNI / Documento - SIN OR (Hash Join indexado)
      LEFT JOIN (
        SELECT 
          codigo_pedido,
          MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS estado_mensaje_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR ' | '), ' | ', 1) AS plantilla_wsp,
          SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR ' | '), ' | ', 1) AS respuesta_boton_wsp
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
        GROUP BY codigo_pedido
      ) m_doc ON (m_tok.token IS NULL AND m_cod.codigo_pedido IS NULL AND t.\`Número Documento\` = m_doc.codigo_pedido)
      -- 4. Tracking web
      LEFT JOIN (
        SELECT 
          token,
          COUNT(*) AS total_interacciones_web,
          MIN(timestamp) AS primer_ingreso_web,
          MAX(timestamp) AS ultimo_ingreso_web
        FROM logs_traking
        WHERE token IS NOT NULL AND token <> ''
        GROUP BY token
      ) trk ON (t.token = trk.token)
      WHERE t.\`F.Soli\` >= (CURDATE() - INTERVAL 90 DAY);
    `);
    console.log("✔ Vista vw_reporte_ordenes_tracking actualizada con rendimiento de sub-segundo.");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error actualizando vistas:", err.message);
    process.exit(1);
  }
})();
