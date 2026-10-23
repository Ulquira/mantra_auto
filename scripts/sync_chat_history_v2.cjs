require('dotenv').config();
const { pool, getControlTables } = require('../mantra_service.cjs');
const { buildChatMetrics } = require('./chat_history_metrics.cjs');
const { resolveTemplateConfig } = require('./mantra_report_helpers.cjs');

const URL_BY_PHONE = 'https://wbpback2pro2.mantra.chat/contacts/byphone';
const URL_CHAT_HISTORY = 'https://wbpback2pro2.mantra.chat/contacts/chats/historial';
const API_TIMEOUT_MS = 6000;
const BATCH_CONCURRENCY = 6;

async function postMantraJson(url, endpointName, options) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`${endpointName} devolvió HTTP ${response.status}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${endpointName} devolvió una respuesta JSON inválida.`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${endpointName} devolvió una respuesta inesperada.`);
  }
  return payload;
}

async function syncSingleChat(candidate, configs) {
  const config = resolveTemplateConfig(candidate, configs);
  let asesorAsignado = null;
  let estadoChat = candidate.estado_chat_reporte || 'Pendiente';

  try {
    const phoneData = await postMantraJson(URL_BY_PHONE, 'Mantra byphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: config.group_id,
        apiKey: config.api_key,
        phone: candidate.phone,
        countryCode: '51'
      })
    });
    if (phoneData.ok === false || phoneData.success === false) {
      throw new Error('Mantra byphone rechazó la consulta.');
    }
    asesorAsignado = phoneData.agent || phoneData.agentName || null;
    if (
      Array.isArray(phoneData.chatStatusTags)
      && typeof phoneData.chatStatusTags[0] === 'string'
      && phoneData.chatStatusTags[0]
    ) {
      estadoChat = phoneData.chatStatusTags[0];
    }
  } catch (error) {
    console.warn(`[Mantra byphone] No se pudo consultar el estado/agente; se conserva el estado del reporte. ${error.message}`);
  }

  const historyData = await postMantraJson(URL_CHAT_HISTORY, 'Mantra historial', {
    method: 'POST',
    headers: {
      Authorization: config.api_key,
      GroupId: config.group_id,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      countryCode: '51',
      phone: candidate.phone,
      page: 1,
      limit: 100
    })
  });
  if (historyData.ok === false || historyData.success === false) {
    throw new Error('Mantra historial rechazó la consulta; no se actualizará el registro.');
  }
  if (!Array.isArray(historyData.data)) {
    throw new Error('Mantra historial no devolvió una lista de mensajes; no se actualizará el registro.');
  }

  const metrics = buildChatMetrics(
    historyData.data,
    candidate.respuesta_boton,
    candidate.fecha_respuesta_boton
  );
  const totalMensajes = Number.isFinite(Number(historyData.total))
    ? Number(historyData.total)
    : metrics.messages.length;
  asesorAsignado = metrics.asesorAsignado || asesorAsignado;

  const recentMessages = metrics.messages.slice(0, 15).map((message, index) => ({
    orden: index + 1,
    emisor: message.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA',
    texto: message.content?.text || `[${message.content?.type || 'mensaje'}]`,
    fecha_utc: message.createdAt,
    agente: message.agent?.name || message.sentByUser?.name || null
  }));

  await pool.query(`
    INSERT INTO HISTORIAL_CHATS_MANTRA (
      orden_id, ticket, phone, grupo_servicio,
      cliente_nombre, producto, tipo_trabajo, motivo_trabajo, distrito, provincia, sector_operativo,
      fecha_gestion_dia,
      cliente_tipo_interaccion, cliente_boton_seleccionado, cliente_ultimo_texto, cliente_ultima_fecha,
      asesor_asignado, asesor_ultimo_texto, asesor_ultima_fecha,
      total_mensajes, ultimo_mensaje_emisor, ultimo_mensaje_texto, ultimo_mensaje_fecha,
      quien_tiene_la_palabra, estado_chat, tuvo_respuesta, tiempo_espera_minutos, semaforo_sla,
      ultimos_mensajes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      orden_id = COALESCE(VALUES(orden_id), orden_id),
      ticket = COALESCE(VALUES(ticket), ticket),
      cliente_nombre = COALESCE(VALUES(cliente_nombre), cliente_nombre),
      producto = COALESCE(VALUES(producto), producto),
      tipo_trabajo = COALESCE(VALUES(tipo_trabajo), tipo_trabajo),
      motivo_trabajo = COALESCE(VALUES(motivo_trabajo), motivo_trabajo),
      distrito = COALESCE(VALUES(distrito), distrito),
      provincia = COALESCE(VALUES(provincia), provincia),
      sector_operativo = COALESCE(VALUES(sector_operativo), sector_operativo),
      cliente_tipo_interaccion = VALUES(cliente_tipo_interaccion),
      cliente_boton_seleccionado = VALUES(cliente_boton_seleccionado),
      cliente_ultimo_texto = VALUES(cliente_ultimo_texto),
      cliente_ultima_fecha = VALUES(cliente_ultima_fecha),
      asesor_asignado = COALESCE(VALUES(asesor_asignado), asesor_asignado),
      asesor_ultimo_texto = VALUES(asesor_ultimo_texto),
      asesor_ultima_fecha = VALUES(asesor_ultima_fecha),
      total_mensajes = VALUES(total_mensajes),
      ultimo_mensaje_emisor = VALUES(ultimo_mensaje_emisor),
      ultimo_mensaje_texto = VALUES(ultimo_mensaje_texto),
      ultimo_mensaje_fecha = VALUES(ultimo_mensaje_fecha),
      quien_tiene_la_palabra = VALUES(quien_tiene_la_palabra),
      estado_chat = VALUES(estado_chat),
      tuvo_respuesta = VALUES(tuvo_respuesta),
      tiempo_espera_minutos = VALUES(tiempo_espera_minutos),
      semaforo_sla = VALUES(semaforo_sla),
      ultimos_mensajes_json = VALUES(ultimos_mensajes_json)
  `, [
    candidate.orden_id || null,
    candidate.ticket || null,
    candidate.phone,
    candidate.grupo_servicio,
    candidate.cliente_nombre || null,
    candidate.producto || null,
    candidate.tipo_trabajo || null,
    candidate.motivo_trabajo || null,
    candidate.distrito || null,
    candidate.provincia || null,
    candidate.sector_operativo || null,
    candidate.fecha_gestion_dia,
    metrics.clienteTipo,
    metrics.clienteBoton,
    metrics.clienteTexto,
    metrics.clienteFecha,
    asesorAsignado,
    metrics.asesorTexto,
    metrics.asesorFecha,
    totalMensajes,
    metrics.ultimoEmisor,
    metrics.ultimoTexto,
    metrics.ultimoFecha,
    metrics.quienTienePalabra,
    estadoChat,
    metrics.tuvoRespuesta,
    metrics.tiempoEsperaMinutos,
    metrics.semaforo,
    JSON.stringify(recentMessages)
  ]);
}

async function runBatch(candidates, configs, concurrency = BATCH_CONCURRENCY) {
  let nextIndex = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex++];
      try {
        await syncSingleChat(candidate, configs);
      } catch (error) {
        failed++;
        console.error(
          `[Historial Mantra] Falló una sincronización (${candidate.grupo_servicio}): ${error.message}`
        );
      }
      completed++;
      if (completed % 50 === 0 || completed === candidates.length) {
        console.log(`[Historial Mantra] Procesados ${completed}/${candidates.length}; fallidos: ${failed}.`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker())
  );
  return { completed, failed };
}

async function main(options = {}) {
  const forceAll = options.forceAll === true;
  console.log(`[Historial Mantra] Iniciando sincronización de chats de HOY (modo: ${forceAll ? 'completo' : 'incremental'}).`);
  const { configs } = await getControlTables(true);

  const [candidates] = await pool.query(`
    SELECT
      candidates.phone,
      candidates.template_id,
      candidates.tipo_servicio,
      candidates.orden_id,
      candidates.ticket,
      candidates.grupo_servicio,
      candidates.cliente_nombre,
      candidates.producto,
      candidates.tipo_trabajo,
      candidates.motivo_trabajo,
      candidates.distrito,
      candidates.provincia,
      candidates.sector_operativo,
      candidates.fecha_gestion_dia,
      candidates.respuesta_boton,
      candidates.fecha_respuesta_boton,
      candidates.estado_chat_reporte
    FROM (
      SELECT
        r.telefono AS phone,
        r.template_id,
        r.grupo_servicio AS tipo_servicio,
        r.orden_id,
        COALESCE(r.codigo_pedido, ot.CodiSegui) AS ticket,
        CASE
          WHEN r.nombre_plantilla_alias LIKE '%Aver%'
            OR r.grupo_servicio LIKE '%Aver%' THEN 'Averias'
          ELSE 'Instalacion'
        END AS grupo_servicio,
        ot.ClienteFinal AS cliente_nombre,
        ot.Producto AS producto,
        COALESCE(ts.Tipo, ot.TipoTraba) AS tipo_trabajo,
        ot.TipoTraba AS motivo_trabajo,
        COALESCE(NULLIF(TRIM(ot.Zona), ''), ot.Localidad) AS distrito,
        ot.Provincia AS provincia,
        ot.\`Sector Operativo\` AS sector_operativo,
        DATE(r.fecha_envio) AS fecha_gestion_dia,
        r.respuesta_boton,
        r.fecha_respuesta_boton,
        r.estado_chat AS estado_chat_reporte,
        ROW_NUMBER() OVER (
          PARTITION BY r.telefono,
            CASE
              WHEN r.nombre_plantilla_alias LIKE '%Aver%'
                OR r.grupo_servicio LIKE '%Aver%' THEN 'Averias'
              ELSE 'Instalacion'
            END,
            DATE(r.fecha_envio)
          ORDER BY r.fecha_respuesta_boton DESC, r.fecha_envio DESC
        ) AS rn
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba ot ON r.orden_id = ot.OrdenId
      LEFT JOIN tiposervicio ts ON ot.Producto = ts.Servicio
      WHERE DATE(r.fecha_envio) = CURDATE()
        AND r.telefono IS NOT NULL
        AND r.telefono <> ''
        AND (
          ${forceAll ? "1 = 1" : "1 = 0"}
          OR r.respuesta_boton IS NOT NULL
          OR r.estado_chat = 'En proceso'
          OR r.fecha_envio >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
          OR NOT EXISTS (
            SELECT 1 FROM HISTORIAL_CHATS_MANTRA h
            WHERE h.phone = r.telefono
              AND h.fecha_gestion_dia = CURDATE()
          )
          OR EXISTS (
            SELECT 1 FROM HISTORIAL_CHATS_MANTRA h
            WHERE h.phone = r.telefono
              AND h.fecha_gestion_dia = CURDATE()
              AND h.quien_tiene_la_palabra = 'CLIENTE'
          )
        )
    ) AS candidates
    WHERE candidates.rn = 1
    ORDER BY
      (candidates.respuesta_boton IS NOT NULL OR candidates.estado_chat_reporte = 'En proceso') DESC,
      candidates.fecha_gestion_dia DESC
  `);

  console.log(`[Historial Mantra] Candidatos encontrados: ${candidates.length}.`);
  if (candidates.length === 0) {
    console.warn('[Historial Mantra] No hay teléfonos válidos en reportes recientes o no se encontraron candidatos.');
  }
  const result = await runBatch(candidates, configs);
  if (result.failed > 0) {
    throw new Error(`Fallaron ${result.failed} de ${result.completed} sincronizaciones de historial.`);
  }

  const [summary] = await pool.query(`
    SELECT
      fecha_gestion_dia,
      COUNT(*) AS total_chats,
      SUM(quien_tiene_la_palabra = 'CLIENTE') AS esperando_asesor,
      SUM(semaforo_sla = 'ROJO') AS sla_rojo,
      SUM(cliente_tipo_interaccion = 'BOTON') AS presionaron_boton,
      SUM(cliente_tipo_interaccion = 'TEXTO_LIBRE') AS escribieron_texto
    FROM HISTORIAL_CHATS_MANTRA
    GROUP BY fecha_gestion_dia
    ORDER BY fecha_gestion_dia DESC
    LIMIT 10
  `);
  console.table(summary);
  console.log('[Historial Mantra] Sincronización completada.');
  return result;
}

let isSyncRunning = false;

async function syncChatHistory(options = {}) {
  if (isSyncRunning) {
    console.warn('[Historial Mantra] Sincronización anterior aún en curso; se omite esta ejecución.');
    return { completed: 0, failed: 0, skipped: true };
  }
  isSyncRunning = true;
  try {
    return await main(options);
  } finally {
    isSyncRunning = false;
  }
}

module.exports = {
  syncChatHistory
};

if (require.main === module) {
  syncChatHistory()
    .catch(error => {
      console.error('[Historial Mantra] Error en la sincronización:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await pool.end();
      } catch (error) {
        console.error('[Historial Mantra] Error cerrando la conexión MySQL:', error.message);
        process.exitCode = 1;
      }
    });
}
