-- =================================================================================
-- VISTA DE MONITOREO EN VIVO DE ATENCIÓN DE CHATS (MANTRA WHATSAPP)
-- Vista: vw_monitoreo_atencion_chats
-- BD: BD_Phoenix
-- Origen: HISTORIAL_CHATS_MANTRA (Cero JOINs en lectura, ultra-alta velocidad)
-- =================================================================================

CREATE OR REPLACE VIEW vw_monitoreo_atencion_chats AS
SELECT 
  id,
  fecha_gestion_dia,
  phone AS telefono,
  grupo_servicio,
  orden_id,
  ticket AS ticket_pedido,
  cliente_nombre AS cliente,
  producto AS producto_servicio,
  tipo_trabajo,
  motivo_trabajo,
  distrito AS distrito_zona,
  provincia,
  sector_operativo,
  
  -- Estado y Asignación Operativa
  estado_chat,
  asesor_asignado,
  quien_tiene_la_palabra,
  semaforo_sla,
  tuvo_respuesta,
  tiempo_espera_minutos,
  
  -- Detalle Interacción Cliente
  cliente_tipo_interaccion,
  cliente_boton_seleccionado,
  cliente_ultimo_texto,
  cliente_ultima_fecha,
  
  -- Detalle Atención Asesor Humano
  asesor_ultimo_texto,
  asesor_ultima_fecha,
  
  -- Último Mensaje Global
  ultimo_mensaje_emisor,
  ultimo_mensaje_texto,
  ultimo_mensaje_fecha,
  total_mensajes,
  
  -- Contexto y Auditoría
  ultimos_mensajes_json,
  fecha_auditoria
FROM HISTORIAL_CHATS_MANTRA;
