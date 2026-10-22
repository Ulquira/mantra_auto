require('dotenv').config();
const { pool, MANTRA_CONFIG } = require('../mantra_service.cjs');

function parseSqlTimestamp(isoDateString) {
  if (!isoDateString) return null;
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function syncSingleChat(candidate) {
  const { phone, orden_id, ticket, grupo_servicio, cliente_nombre, producto, tipo_trabajo, distrito, provincia, sector_operativo, fecha_gestion_dia, respuesta_boton, fecha_respuesta_boton } = candidate;
  const config = MANTRA_CONFIG[grupo_servicio] || MANTRA_CONFIG['Averias'];
  if (!config) return { success: false, error: 'Config missing' };

  let asesorAsignado = null;
  let estadoChat = candidate.estado_chat_reporte || 'Pendiente';

  // 1. byphone
  try {
    const resPhone = await fetch("https://wbpback2pro2.mantra.chat/contacts/byphone", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: config.GROUP_ID,
        apiKey: config.API_KEY,
        phone: phone,
        countryCode: '51'
      }),
      signal: AbortSignal.timeout(6000)
    });
    const phoneData = await resPhone.json();
    asesorAsignado = phoneData.agent || phoneData.agentName || null;
    if (phoneData.chatStatusTags && phoneData.chatStatusTags.length > 0) {
      estadoChat = phoneData.chatStatusTags[0];
    }
  } catch (e) {}

  // 2. chats/historial
  let messages = [];
  let totalMensajes = 0;
  try {
    const resHist = await fetch("https://wbpback2pro2.mantra.chat/contacts/chats/historial", {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.API_KEY}`,
        'GroupId': config.GROUP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: '51',
        phone: phone,
        page: 1,
        limit: 10
      }),
      signal: AbortSignal.timeout(6000)
    });
    const jsonHist = await resHist.json();
    messages = jsonHist.data || [];
    totalMensajes = jsonHist.total || messages.length;
  } catch (e) {}

  // 3. Procesar mensajes y roles
  let clienteTipo = 'NINGUNO';
  let clienteBoton = respuesta_boton || null;
  let clienteTexto = null;
  let clienteFecha = fecha_respuesta_boton ? parseSqlTimestamp(fecha_respuesta_boton) : null;
  if (clienteBoton) clienteTipo = 'BOTON';

  let asesorTexto = null;
  let asesorFecha = null;

  let ultimoEmisor = null;
  let ultimoTexto = null;
  let ultimoFecha = null;

  let quienTienePalabra = 'BOT';
  let tuvoRespuesta = 1;
  let tiempoEsperaMinutos = 0;
  let semaforo = 'VERDE';

  if (messages.length > 0) {
    const lastGlobal = messages[0];
    ultimoEmisor = lastGlobal.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA';
    ultimoTexto = lastGlobal.content?.text || (lastGlobal.content?.type ? `[${lastGlobal.content.type}]` : '[mensaje]');
    ultimoFecha = parseSqlTimestamp(lastGlobal.createdAt);

    // Cliente
    const clientMsg = messages.find(m => m.sender === 'contact');
    if (clientMsg) {
      const type = clientMsg.content?.type || 'text';
      if (type === 'button_reply' || type === 'interactive' || clientMsg.content?.button_reply) {
        clienteTipo = 'BOTON';
        clienteBoton = clientMsg.content?.text || clientMsg.content?.button_reply?.title || clienteBoton || '[Botón]';
      } else if (type === 'image' || type === 'audio' || type === 'document' || type === 'video') {
        clienteTipo = 'MEDIA';
        clienteTexto = `[Archivo ${type}]`;
      } else {
        clienteTipo = 'TEXTO_LIBRE';
        clienteTexto = clientMsg.content?.text || null;
      }
      clienteFecha = parseSqlTimestamp(clientMsg.createdAt);
    }

    // Asesor
    const advisorMsg = messages.find(m => m.sender !== 'contact');
    if (advisorMsg) {
      asesorTexto = advisorMsg.content?.text || (advisorMsg.content?.type ? `[${advisorMsg.content.type}]` : '[mensaje]');
      asesorFecha = parseSqlTimestamp(advisorMsg.createdAt);
      if (advisorMsg.agent?.name || advisorMsg.sentByUser?.name) {
        asesorAsignado = advisorMsg.agent?.name || advisorMsg.sentByUser?.name;
      }
    }

    // Turno y SLA
    const lastClientIdx = messages.findIndex(m => m.sender === 'contact');
    if (lastClientIdx === 0) {
      quienTienePalabra = 'CLIENTE';
      tuvoRespuesta = 0;
      const diffMs = Date.now() - new Date(messages[0].createdAt).getTime();
      tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / 60000));
    } else if (lastClientIdx > 0) {
      quienTienePalabra = 'ASESOR';
      tuvoRespuesta = 1;
      const respMsg = messages[lastClientIdx - 1];
      const diffMs = new Date(respMsg.createdAt).getTime() - new Date(messages[lastClientIdx].createdAt).getTime();
      tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / 60000));
    } else {
      quienTienePalabra = 'BOT';
      tuvoRespuesta = 1;
      tiempoEsperaMinutos = 0;
    }

    if (quienTienePalabra === 'CLIENTE') {
      if (tiempoEsperaMinutos < 5) semaforo = 'VERDE';
      else if (tiempoEsperaMinutos <= 15) semaforo = 'AMARILLO';
      else semaforo = 'ROJO';
    } else {
      semaforo = 'VERDE';
    }
  } else if (clienteBoton) {
    quienTienePalabra = 'CLIENTE';
    tuvoRespuesta = 0;
  }

  const ultimos5 = messages.slice(0, 5).map((m, idx) => ({
    orden: idx + 1,
    emisor: m.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA',
    texto: m.content?.text || `[${m.content?.type || 'mensaje'}]`,
    fecha_utc: m.createdAt,
    agente: m.agent?.name || m.sentByUser?.name || null
  }));

  const sqlUpsert = `
    INSERT INTO HISTORIAL_CHATS_MANTRA (
      orden_id, ticket, phone, grupo_servicio,
      cliente_nombre, producto, tipo_trabajo, distrito, provincia, sector_operativo,
      fecha_gestion_dia,
      cliente_tipo_interaccion, cliente_boton_seleccionado, cliente_ultimo_texto, cliente_ultima_fecha,
      asesor_asignado, asesor_ultimo_texto, asesor_ultima_fecha,
      total_mensajes, ultimo_mensaje_emisor, ultimo_mensaje_texto, ultimo_mensaje_fecha,
      quien_tiene_la_palabra, estado_chat, tuvo_respuesta, tiempo_espera_minutos, semaforo_sla,
      ultimos_mensajes_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      orden_id = COALESCE(VALUES(orden_id), orden_id),
      ticket = COALESCE(VALUES(ticket), ticket),
      cliente_nombre = COALESCE(VALUES(cliente_nombre), cliente_nombre),
      producto = COALESCE(VALUES(producto), producto),
      tipo_trabajo = COALESCE(VALUES(tipo_trabajo), tipo_trabajo),
      distrito = COALESCE(VALUES(distrito), distrito),
      provincia = COALESCE(VALUES(provincia), provincia),
      sector_operativo = COALESCE(VALUES(sector_operativo), sector_operativo),
      cliente_tipo_interaccion = VALUES(cliente_tipo_interaccion),
      cliente_boton_seleccionado = VALUES(cliente_boton_seleccionado),
      cliente_ultimo_texto = VALUES(cliente_ultimo_texto),
      cliente_ultima_fecha = VALUES(cliente_ultima_fecha),
      asesor_asignado = VALUES(asesor_asignado),
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
  `;

  await pool.query(sqlUpsert, [
    orden_id || null, ticket || null, phone, grupo_servicio,
    cliente_nombre || null, producto || null, tipo_trabajo || null, distrito || null, provincia || null, sector_operativo || null,
    fecha_gestion_dia,
    clienteTipo, clienteBoton, clienteTexto, clienteFecha,
    asesorAsignado, asesorTexto, asesorFecha,
    totalMensajes, ultimoEmisor, ultimoTexto, ultimoFecha,
    quienTienePalabra, estadoChat, tuvoRespuesta, tiempoEsperaMinutos, semaforo,
    JSON.stringify(ultimos5)
  ]);

  return { success: true };
}

async function runBatch(items, concurrency = 6) {
  let index = 0;
  let total = items.length;
  let completed = 0;

  async function worker() {
    while (index < total) {
      const current = items[index++];
      try {
        await syncSingleChat(current);
      } catch (err) {
        console.error(`Error syncing ${current.phone}:`, err.message);
      }
      completed++;
      if (completed % 50 === 0 || completed === total) {
        console.log(`[Progreso] Sincronizados ${completed}/${total} chats (${Math.round(completed * 100 / total)}%)...`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
}

async function main() {
  console.log("=================================================================================");
  console.log("🚀 INICIANDO SINCRONIZACIÓN DE CHATS MANTRA V2 (ÚLTIMOS 5 DÍAS)");
  console.log("=================================================================================");

  // Extraer candidatos con interacción (botones, en proceso) y despachos recientes
  const [candidates] = await pool.query(`
    SELECT 
      t.phone,
      t.orden_id,
      t.ticket,
      t.grupo_servicio,
      t.cliente_nombre,
      t.producto,
      t.tipo_trabajo,
      t.distrito,
      t.provincia,
      t.sector_operativo,
      t.fecha_gestion_dia,
      t.respuesta_boton,
      t.fecha_respuesta_boton,
      t.estado_chat_reporte
    FROM (
      SELECT 
        r.telefono AS phone,
        r.orden_id,
        COALESCE(r.codigo_pedido, ot.CodiSegui) AS ticket,
        CASE 
          WHEN r.nombre_plantilla_alias LIKE '%Aver%' OR r.grupo_servicio LIKE '%Aver%' THEN 'Averias'
          ELSE 'Instalacion'
        END AS grupo_servicio,
        ot.ClienteFinal AS cliente_nombre,
        ot.Producto AS producto,
        ot.TipoTraba AS tipo_trabajo,
        COALESCE(NULLIF(TRIM(ot.Zona), ''), ot.Localidad) AS distrito,
        ot.Provincia AS provincia,
        ot.\`Sector Operativo\` AS sector_operativo,
        CAST(convert_tz(r.fecha_envio, '+00:00', '-05:00') AS DATE) AS fecha_gestion_dia,
        r.respuesta_boton,
        convert_tz(r.fecha_respuesta_boton, '+00:00', '-05:00') AS fecha_respuesta_boton,
        r.estado_chat AS estado_chat_reporte,
        ROW_NUMBER() OVER (
          PARTITION BY r.telefono, (CASE WHEN r.nombre_plantilla_alias LIKE '%Aver%' OR r.grupo_servicio LIKE '%Aver%' THEN 'Averias' ELSE 'Instalacion' END), CAST(convert_tz(r.fecha_envio, '+00:00', '-05:00') AS DATE)
          ORDER BY r.fecha_respuesta_boton DESC, r.fecha_envio DESC
        ) AS rn
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba ot ON r.orden_id = ot.OrdenId
      WHERE r.fecha_envio >= DATE_SUB(CURDATE(), INTERVAL 5 DAY)
        AND r.telefono IS NOT NULL AND r.telefono <> ''
        AND (
          r.respuesta_boton IS NOT NULL 
          OR r.estado_chat IN ('En proceso', 'Pendiente')
          OR r.fecha_envio >= DATE_SUB(CURDATE(), INTERVAL 2 DAY)
        )
    ) t
    WHERE t.rn = 1
    ORDER BY (t.respuesta_boton IS NOT NULL OR t.estado_chat_reporte = 'En proceso') DESC, t.fecha_gestion_dia DESC
  `);

  console.log(`📋 Total candidatos encontrados: ${candidates.length}`);
  await runBatch(candidates, 6);

  console.log("\n=================================================================================");
  console.log("📊 RESUMEN DE MONITOREO DE CHATS EN BD (ÚLTIMOS 5 DÍAS)");
  console.log("=================================================================================");
  const [summary] = await pool.query(`
    SELECT 
      fecha_gestion_dia,
      COUNT(*) AS total_chats_auditados,
      SUM(CASE WHEN quien_tiene_la_palabra = 'CLIENTE' THEN 1 ELSE 0 END) AS esperando_asesor,
      SUM(CASE WHEN semaforo_sla = 'ROJO' THEN 1 ELSE 0 END) AS sla_rojo,
      SUM(CASE WHEN cliente_tipo_interaccion = 'BOTON' THEN 1 ELSE 0 END) AS presionaron_boton,
      SUM(CASE WHEN cliente_tipo_interaccion = 'TEXTO_LIBRE' THEN 1 ELSE 0 END) AS escribieron_texto
    FROM HISTORIAL_CHATS_MANTRA
    GROUP BY fecha_gestion_dia
    ORDER BY fecha_gestion_dia DESC
  `);
  console.table(summary);

  console.log("\n✅ Sincronización v2 finalizada.");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Error en script:", err);
  process.exit(1);
});
