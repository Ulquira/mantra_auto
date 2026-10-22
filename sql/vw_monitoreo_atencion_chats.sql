-- =================================================================================
-- VISTA DE MONITOREO EN VIVO DE ATENCIÓN DE CHATS (MANTRA WHATSAPP)
-- Vista: vw_monitoreo_atencion_chats
-- BD: BD_Phoenix
-- Cruce: HISTORIAL_CHATS_MANTRA + vw_winordetraba
-- =================================================================================

CREATE OR REPLACE VIEW vw_monitoreo_atencion_chats AS
SELECT 
  h.id,
  h.fecha_gestion_dia,
  h.phone AS telefono,
  h.grupo_servicio,
  h.orden_id,
  COALESCE(h.ticket, t_ord.CodiSegui, t_tel.CodiSegui) AS ticket_pedido,
  COALESCE(t_ord.ClienteFinal, t_tel.ClienteFinal) AS cliente,
  COALESCE(t_ord.Producto, t_tel.Producto) AS producto_servicio,
  COALESCE(NULLIF(TRIM(t_ord.Zona), ''), t_ord.Localidad, NULLIF(TRIM(t_tel.Zona), ''), t_tel.Localidad) AS distrito_zona,
  COALESCE(t_ord.`Sector Operativo`, t_tel.`Sector Operativo`) AS sector_operativo,
  
  -- Estado y Asignación
  h.estado_chat,
  h.asesor_asignado,
  h.quien_tiene_la_palabra,
  h.semaforo_sla,
  h.tuvo_respuesta,
  h.tiempo_espera_minutos,
  
  -- Detalle Cliente
  h.cliente_tipo_interaccion,
  h.cliente_boton_seleccionado,
  h.cliente_ultimo_texto,
  h.cliente_ultima_fecha,
  
  -- Detalle Asesor
  h.asesor_ultimo_texto,
  h.asesor_ultima_fecha,
  
  -- Último Mensaje Global
  h.ultimo_mensaje_emisor,
  h.ultimo_mensaje_texto,
  h.ultimo_mensaje_fecha,
  h.total_mensajes,
  
  -- Contexto y Auditoría
  h.ultimos_mensajes_json,
  h.fecha_auditoria
FROM HISTORIAL_CHATS_MANTRA h
LEFT JOIN vw_winordetraba t_ord ON (h.orden_id IS NOT NULL AND h.orden_id = t_ord.OrdenId)
LEFT JOIN vw_winordetraba t_tel ON (h.orden_id IS NULL AND h.phone = RIGHT(t_tel.TeleMovilNume, 9) AND CAST(t_tel.`F.Soli` AS DATE) = h.fecha_gestion_dia);
