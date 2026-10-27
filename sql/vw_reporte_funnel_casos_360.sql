-- =================================================================================
-- VISTA MAESTRA 360° DE CASOS, NOTIFICACIONES Y FUNNEL DE SEGUIMIENTO (TRACKING)
-- Vista: vw_reporte_funnel_casos_360
-- BD: BD_Phoenix
-- Cruce: vw_winordetraba + tiposervicio + LOG_NOTIFICACIONES_WSP + REPORTE_PLANTILLAS_MANTRA + logs_traking + reprogramaciones + encuestas
-- =================================================================================

CREATE OR REPLACE VIEW vw_reporte_funnel_casos_360 AS
SELECT 
  t.OrdenId AS orden_id,
  t.CodiSegui AS ticket,
  t.ClienteFinal AS cliente,
  t.TeleMovilNume AS telefono,
  t.Producto AS producto,
  COALESCE(ts.Tipo, 'OTRO') AS tipo_operacion,
  t.TipoTraba AS tipo_trabajo,
  t.Estado AS estado_ot,
  t.`F.Soli` AS fecha_solicitud,
  CAST(t.`F.Soli` AS DATE) AS fecha_solicitud_dia,
  t.`F.Visita` AS fecha_visita,
  t.`Sector Operativo` AS sector_operativo,
  COALESCE(NULLIF(TRIM(t.Zona), ''), t.Localidad) AS distrito,
  t.Provincia AS provincia,
  t.Region AS region,
  t.Cuadrilla_nombre AS cuadrilla,
  t.token AS token_tracking,
  CONCAT('https://enruta.win.pe/seguimiento/', t.token) AS link_tracking,
  
  -- 1. Notificación WhatsApp (Consolidado: Log en vivo OrdenId/Ticket + Reporte Mantra)
  CASE 
    WHEN l.OrdenId IS NOT NULL 
      OR l_ticket.CodiSegui IS NOT NULL 
      OR m_ord.orden_id IS NOT NULL 
      OR m_cod.codigo_pedido IS NOT NULL 
      OR m_tok.token IS NOT NULL 
    THEN 'SI' 
    ELSE 'NO' 
  END AS se_envio_wsp,
  COALESCE(m_ord.fecha_envio_wsp, m_cod.fecha_envio_wsp, m_tok.fecha_envio_wsp, l.fecha_envio_wsp, l_ticket.fecha_envio_wsp) AS fecha_envio_wsp,
  COALESCE(
    m_ord.estado_mensaje_wsp, 
    m_cod.estado_mensaje_wsp, 
    m_tok.estado_mensaje_wsp, 
    IF(l.OrdenId IS NOT NULL OR l_ticket.CodiSegui IS NOT NULL, 'SENT', 'NO ENVIADO')
  ) AS estado_wsp,
  COALESCE(m_ord.plantilla_wsp, m_cod.plantilla_wsp, m_tok.plantilla_wsp, l.estado_notificado, l_ticket.estado_notificado) AS plantilla_wsp,
  COALESCE(m_ord.respuesta_boton_wsp, m_cod.respuesta_boton_wsp, m_tok.respuesta_boton_wsp) AS respuesta_boton_wsp,
  
  -- 2. Interacciones en Plataforma Web Tracking (logs_traking)
  CASE 
    WHEN COALESCE(trk_ord.total_interacciones, trk_tok.total_interacciones, 0) > 0 THEN 'SI' 
    ELSE 'NO' 
  END AS ingreso_tracking,
  COALESCE(trk_ord.total_interacciones, trk_tok.total_interacciones, 0) AS total_interacciones_tracking,
  COALESCE(trk_ord.vistas_seguimiento, trk_tok.vistas_seguimiento, 0) AS vistas_mapa_seguimiento,
  COALESCE(trk_ord.refrescos_pagina, trk_tok.refrescos_pagina, 0) AS refrescos_pantalla,
  COALESCE(trk_ord.primer_ingreso, trk_tok.primer_ingreso) AS primer_ingreso_tracking,
  COALESCE(trk_ord.ultimo_ingreso, trk_tok.ultimo_ingreso) AS ultimo_ingreso_tracking,
  
  -- 3. Acciones de Soporte y Reprogramación
  CASE 
    WHEN COALESCE(trk_ord.clicks_soporte, trk_tok.clicks_soporte, 0) > 0 THEN 'SI' 
    ELSE 'NO' 
  END AS pulso_soporte,
  COALESCE(trk_ord.clicks_soporte, trk_tok.clicks_soporte, 0) AS veces_pulso_soporte,
  
  CASE 
    WHEN r.id IS NOT NULL OR COALESCE(trk_ord.reprogramo_web, trk_tok.reprogramo_web, 0) > 0 THEN 'SI' 
    ELSE 'NO' 
  END AS reprogramo,
  CASE 
    WHEN COALESCE(trk_ord.intento_reprogramar, trk_tok.intento_reprogramar, 0) > 0 THEN 'SI' 
    ELSE 'NO' 
  END AS intento_reprogramar,
  r.fecha_solicitada AS fecha_reprogramada,
  r.turno AS turno_reprogramado,
  r.motivo AS motivo_reprogramacion,
  r.fecha_registro AS fecha_registro_reprogramacion,
  
  -- 4. Encuesta de Calidad
  CASE 
    WHEN enc.id IS NOT NULL THEN 'SI' 
    ELSE 'NO' 
  END AS respondio_encuesta,
  enc.satisfaccion_general,
  enc.instalacion_concretada,
  enc.tecnico_puntualidad,
  enc.tecnico_trato,
  enc.satisfaccion_comentario
  
FROM vw_winordetraba t

-- Cruce con tiposervicio para segmentación operativa (Instalación, Averías, Provincia, etc.)
LEFT JOIN tiposervicio ts ON t.Producto = ts.Servicio

-- Log transaccional directo de envíos en vivo: Cruce 1 por OrdenId
LEFT JOIN (
  SELECT 
    OrdenId,
    MAX(fecha_envio) AS fecha_envio_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(EstadoNotificado ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS estado_notificado
  FROM LOG_NOTIFICACIONES_WSP
  WHERE EnviadoExitosamente = 1
  GROUP BY OrdenId
) l ON t.OrdenId = l.OrdenId

-- Log transaccional directo de envíos en vivo: Cruce 2 Fallback por CodiSegui (Ticket) en misma fecha de gestión
LEFT JOIN (
  SELECT 
    CodiSegui,
    CAST(fecha_envio AS DATE) AS fecha_envio_dia,
    MAX(fecha_envio) AS fecha_envio_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(EstadoNotificado ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS estado_notificado
  FROM LOG_NOTIFICACIONES_WSP
  WHERE EnviadoExitosamente = 1 AND CodiSegui IS NOT NULL AND CodiSegui <> ''
  GROUP BY CodiSegui, CAST(fecha_envio AS DATE)
) l_ticket ON (
  l.OrdenId IS NULL 
  AND t.CodiSegui IS NOT NULL 
  AND t.CodiSegui <> '' 
  AND t.CodiSegui = l_ticket.CodiSegui 
  AND CAST(t.`F.Soli` AS DATE) = l_ticket.fecha_envio_dia
)

-- Subconsulta Mantra indexada por orden_id
LEFT JOIN (
  SELECT 
    orden_id,
    MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS estado_mensaje_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS plantilla_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR '|'), '|', 1) AS respuesta_boton_wsp
  FROM REPORTE_PLANTILLAS_MANTRA
  WHERE orden_id IS NOT NULL
  GROUP BY orden_id
) m_ord ON t.OrdenId = m_ord.orden_id

-- Subconsulta Mantra fallback por CodiSegui (Ticket / codigo_pedido) en misma fecha de gestión
LEFT JOIN (
  SELECT 
    codigo_pedido,
    CAST(CONVERT_TZ(fecha_envio, '+00:00', '-05:00') AS DATE) AS fecha_envio_dia,
    MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS estado_mensaje_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS plantilla_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR '|'), '|', 1) AS respuesta_boton_wsp
  FROM REPORTE_PLANTILLAS_MANTRA
  WHERE codigo_pedido IS NOT NULL AND codigo_pedido <> ''
  GROUP BY codigo_pedido, CAST(CONVERT_TZ(fecha_envio, '+00:00', '-05:00') AS DATE)
) m_cod ON (
  m_ord.orden_id IS NULL 
  AND t.CodiSegui IS NOT NULL 
  AND t.CodiSegui <> '' 
  AND t.CodiSegui = m_cod.codigo_pedido 
  AND CAST(t.`F.Soli` AS DATE) = m_cod.fecha_envio_dia
)

-- Subconsulta Mantra fallback por token
LEFT JOIN (
  SELECT 
    token,
    MAX(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) AS fecha_envio_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(estado_mensaje ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS estado_mensaje_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(nombre_plantilla_alias ORDER BY fecha_envio DESC SEPARATOR '|'), '|', 1) AS plantilla_wsp,
    SUBSTRING_INDEX(GROUP_CONCAT(respuesta_boton ORDER BY fecha_respuesta_boton DESC SEPARATOR '|'), '|', 1) AS respuesta_boton_wsp
  FROM REPORTE_PLANTILLAS_MANTRA
  WHERE orden_id IS NULL AND token IS NOT NULL AND token <> ''
  GROUP BY token
) m_tok ON (m_ord.orden_id IS NULL AND m_cod.codigo_pedido IS NULL AND t.token = m_tok.token AND t.token IS NOT NULL AND t.token <> '')

-- Subconsulta Logs Tracking indexada por OrdenId
LEFT JOIN (
  SELECT 
    OrdenId,
    COUNT(*) AS total_interacciones,
    SUM(CASE WHEN evento = 'ver_seguimiento_instalacion' THEN 1 ELSE 0 END) AS vistas_seguimiento,
    SUM(CASE WHEN evento = 'pagina_refrescada' THEN 1 ELSE 0 END) AS refrescos_pagina,
    SUM(CASE WHEN evento IN ('click_contactar_soporte', 'click_contactar_soporte_cerrada') THEN 1 ELSE 0 END) AS clicks_soporte,
    SUM(CASE WHEN evento = 'click_iniciar_reprogramacion' THEN 1 ELSE 0 END) AS intento_reprogramar,
    SUM(CASE WHEN evento = 'reprogramar_solicitud_completada' THEN 1 ELSE 0 END) AS reprogramo_web,
    MIN(CONVERT_TZ(timestamp, '+00:00', '-05:00')) AS primer_ingreso,
    MAX(CONVERT_TZ(timestamp, '+00:00', '-05:00')) AS ultimo_ingreso
  FROM logs_traking
  WHERE OrdenId IS NOT NULL
  GROUP BY OrdenId
) trk_ord ON t.OrdenId = trk_ord.OrdenId

-- Subconsulta Logs Tracking fallback por token
LEFT JOIN (
  SELECT 
    token,
    COUNT(*) AS total_interacciones,
    SUM(CASE WHEN evento = 'ver_seguimiento_instalacion' THEN 1 ELSE 0 END) AS vistas_seguimiento,
    SUM(CASE WHEN evento = 'pagina_refrescada' THEN 1 ELSE 0 END) AS refrescos_pagina,
    SUM(CASE WHEN evento IN ('click_contactar_soporte', 'click_contactar_soporte_cerrada') THEN 1 ELSE 0 END) AS clicks_soporte,
    SUM(CASE WHEN evento = 'click_iniciar_reprogramacion' THEN 1 ELSE 0 END) AS intento_reprogramar,
    SUM(CASE WHEN evento = 'reprogramar_solicitud_completada' THEN 1 ELSE 0 END) AS reprogramo_web,
    MIN(CONVERT_TZ(timestamp, '+00:00', '-05:00')) AS primer_ingreso,
    MAX(CONVERT_TZ(timestamp, '+00:00', '-05:00')) AS ultimo_ingreso
  FROM logs_traking
  WHERE OrdenId IS NULL AND token IS NOT NULL AND token <> ''
  GROUP BY token
) trk_tok ON (trk_ord.OrdenId IS NULL AND t.token = trk_tok.token AND t.token IS NOT NULL AND t.token <> '')

-- Reprogramaciones
LEFT JOIN (
  SELECT 
    token, 
    MAX(id) AS id, 
    MAX(fecha_solicitada) AS fecha_solicitada, 
    SUBSTRING_INDEX(GROUP_CONCAT(turno ORDER BY id DESC SEPARATOR '|'), '|', 1) AS turno, 
    SUBSTRING_INDEX(GROUP_CONCAT(motivo ORDER BY id DESC SEPARATOR '|'), '|', 1) AS motivo,
    MAX(fecha_registro) AS fecha_registro
  FROM reprogramaciones
  GROUP BY token
) r ON t.token = r.token AND t.token IS NOT NULL AND t.token <> ''

-- Encuestas
LEFT JOIN (
  SELECT 
    token, 
    MAX(id) AS id, 
    SUBSTRING_INDEX(GROUP_CONCAT(satisfaccion_general ORDER BY id DESC SEPARATOR '|'), '|', 1) AS satisfaccion_general, 
    SUBSTRING_INDEX(GROUP_CONCAT(instalacion_concretada ORDER BY id DESC SEPARATOR '|'), '|', 1) AS instalacion_concretada,
    SUBSTRING_INDEX(GROUP_CONCAT(tecnico_puntualidad ORDER BY id DESC SEPARATOR '|'), '|', 1) AS tecnico_puntualidad,
    SUBSTRING_INDEX(GROUP_CONCAT(tecnico_trato ORDER BY id DESC SEPARATOR '|'), '|', 1) AS tecnico_trato,
    SUBSTRING_INDEX(GROUP_CONCAT(satisfaccion_comentario ORDER BY id DESC SEPARATOR '|'), '|', 1) AS satisfaccion_comentario
  FROM encuestas
  GROUP BY token
) enc ON t.token = enc.token AND t.token IS NOT NULL AND t.token <> '';
