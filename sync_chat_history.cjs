require('dotenv').config();
const { pool, MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CHAT_HISTORY = "https://wbpback2pro2.mantra.chat/contacts/chats/historial";
const URL_BY_PHONE = "https://wbpback2pro2.mantra.chat/contacts/byphone";

function formatPeruDateTime(isoDateString) {
  if (!isoDateString) return 'N/A';
  const date = new Date(isoDateString);
  if (isNaN(date.getTime())) return String(isoDateString);
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function parseSqlTimestamp(isoDateString) {
  if (!isoDateString) return null;
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Consulta el historial de Mantra para un teléfono y sincroniza la tabla HISTORIAL_CHATS_MANTRA
 */
async function syncChatHistoryForPhone(phone, grupoKey = 'Averias') {
  const config = MANTRA_CONFIG[grupoKey];
  if (!config) return { error: `Grupo ${grupoKey} no configurado` };

  try {
    // 1. Obtener datos y estado de asesor en Mantra
    let asesorAsignado = null;
    let estadoChat = 'Pendiente';
    try {
      const resPhone = await fetch(URL_BY_PHONE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: config.GROUP_ID,
          apiKey: config.API_KEY,
          phone: phone,
          countryCode: '51'
        })
      });
      const phoneData = await resPhone.json();
      asesorAsignado = phoneData.agent || phoneData.agentName || null;
      if (phoneData.chatStatusTags && phoneData.chatStatusTags.length > 0) {
        estadoChat = phoneData.chatStatusTags[0];
      }
    } catch (e) {
      // Omitir si falla byphone
    }

    // 2. Obtener historial de mensajes
    const resHistory = await fetch(URL_CHAT_HISTORY, {
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
      })
    });

    const json = await resHistory.json();
    if (!json.data || json.data.length === 0) {
      return { phone, synchronized: false, message: 'Sin mensajes en Mantra' };
    }

    const messages = json.data; // ordenados del más reciente al más antiguo
    const totalMensajes = json.total || messages.length;

    // A. Último mensaje global de la conversación
    const lastGlobal = messages[0];
    const ultimoEmisor = lastGlobal.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA';
    const ultimoTexto = lastGlobal.content?.text || (lastGlobal.content?.type === 'button_reply' ? '[Opción Botón]' : `[${lastGlobal.content?.type || 'media'}]`);
    const ultimoFecha = parseSqlTimestamp(lastGlobal.createdAt);

    // B. Buscar el último mensaje emitido por el cliente
    const lastClientIndex = messages.findIndex(m => m.sender === 'contact');
    let ultimoClienteTexto = null;
    let ultimoClienteFecha = null;
    let tuvoRespuesta = false;
    let tiempoEsperaMinutos = 0;

    if (lastClientIndex !== -1) {
      const lastClientMsg = messages[lastClientIndex];
      ultimoClienteTexto = lastClientMsg.content?.text || (lastClientMsg.content?.type === 'button_reply' ? '[Opción Botón]' : `[${lastClientMsg.content?.type || 'media'}]`);
      ultimoClienteFecha = parseSqlTimestamp(lastClientMsg.createdAt);

      // Si el cliente NO es el autor del mensaje [0], significa que hubo una respuesta de la empresa/asesor después de él
      if (lastClientIndex > 0) {
        tuvoRespuesta = true;
        const msgRespuesta = messages[lastClientIndex - 1];
        const diffMs = new Date(msgRespuesta.createdAt).getTime() - new Date(lastClientMsg.createdAt).getTime();
        tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
      } else {
        // El último mensaje global es del cliente -> Aún NO tiene respuesta
        tuvoRespuesta = false;
        const diffMs = Date.now() - new Date(lastClientMsg.createdAt).getTime();
        tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
      }
    } else {
      // El cliente nunca ha escrito (solo se enviaron plantillas)
      tuvoRespuesta = true; // No está esperando nada
      tiempoEsperaMinutos = 0;
    }

    // C. Estructurar los últimos 3 mensajes para guardarlos en JSON
    const ultimos3 = messages.slice(0, 3).map((m, idx) => ({
      orden_reciente: idx + 1,
      emisor: m.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA',
      texto: m.content?.text || `[${m.content?.type || 'media'}]`,
      fecha_hora_peru: formatPeruDateTime(m.createdAt),
      timestamp_utc: m.createdAt,
      agente: m.agent?.name || m.sentByUser?.name || null,
      estado_envio: m.status
    }));

    // 3. Insertar o actualizar en MySQL (Upsert)
    await pool.query(`
      INSERT INTO HISTORIAL_CHATS_MANTRA (
        phone, countryCode, grupo_servicio, total_mensajes,
        ultimo_mensaje_emisor, ultimo_mensaje_texto, ultimo_mensaje_fecha,
        ultimo_mensaje_cliente_texto, ultimo_mensaje_cliente_fecha,
        tuvo_respuesta, tiempo_espera_minutos, estado_chat,
        asesor_asignado, ultimos_3_mensajes_json
      ) VALUES (?, '51', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        total_mensajes = VALUES(total_mensajes),
        ultimo_mensaje_emisor = VALUES(ultimo_mensaje_emisor),
        ultimo_mensaje_texto = VALUES(ultimo_mensaje_texto),
        ultimo_mensaje_fecha = VALUES(ultimo_mensaje_fecha),
        ultimo_mensaje_cliente_texto = VALUES(ultimo_mensaje_cliente_texto),
        ultimo_mensaje_cliente_fecha = VALUES(ultimo_mensaje_cliente_fecha),
        tuvo_respuesta = VALUES(tuvo_respuesta),
        tiempo_espera_minutos = VALUES(tiempo_espera_minutos),
        estado_chat = VALUES(estado_chat),
        asesor_asignado = VALUES(asesor_asignado),
        ultimos_3_mensajes_json = VALUES(ultimos_3_mensajes_json);
    `, [
      phone,
      grupoKey,
      totalMensajes,
      ultimoEmisor,
      ultimoTexto,
      ultimoFecha,
      ultimoClienteTexto,
      ultimoClienteFecha,
      tuvoRespuesta ? 1 : 0,
      tiempoEsperaMinutos,
      estadoChat,
      asesorAsignado,
      JSON.stringify(ultimos3)
    ]);

    return {
      phone,
      synchronized: true,
      grupoKey,
      totalMensajes,
      ultimoEmisor,
      ultimoClienteTexto,
      tuvoRespuesta,
      tiempoEsperaMinutos,
      ultimos3
    };

  } catch (err) {
    return { phone, synchronized: false, error: err.message };
  }
}

// Prueba de ejecución
(async () => {
  console.log("=================================================================================");
  console.log("📥 SINCRONIZANDO HISTORIAL DE MENSAJES Y RESPUESTAS DESDE MANTRA A MYSQL");
  console.log("=================================================================================\n");

  const testPhones = [
    { phone: "923226270", grupo: "Averias" },
    { phone: "935434175", grupo: "Averias" },
    { phone: "935434175", grupo: "Instalacion" }
  ];

  for (const item of testPhones) {
    console.log(`🔍 Sincronizando Teléfono ${item.phone} (${item.grupo})...`);
    const res = await syncChatHistoryForPhone(item.phone, item.grupo);
    if (res.synchronized) {
      console.log(`   ✅ Sincronizado:`, {
        Telefono: res.phone,
        Total_Mensajes: res.totalMensajes,
        Ultimo_Emisor: res.ultimoEmisor,
        Ultimo_Msg_Cliente: res.ultimoClienteTexto,
        Tuvo_Respuesta: res.tuvoRespuesta ? 'SI' : 'NO (Esperando)',
        Tiempo_Espera: `${res.tiempoEsperaMinutos} min`
      });
    } else {
      console.log(`   ❌ Error:`, res);
    }
  }

  console.log("\n=================================================================================");
  console.log("📊 CONSULTANDO LA TABLA DIRECTA: HISTORIAL_CHATS_MANTRA");
  console.log("=================================================================================");
  const [rows] = await pool.query(`
    SELECT phone, grupo_servicio, total_mensajes, ultimo_mensaje_emisor, 
           IF(tuvo_respuesta = 1, 'SI', 'NO (Esperando)') as respondido, 
           CONCAT(tiempo_espera_minutos, ' min') as espera,
           LEFT(ultimo_mensaje_texto, 30) as ultimo_texto,
           LEFT(ultimo_mensaje_cliente_texto, 30) as ultimo_cliente_texto
    FROM HISTORIAL_CHATS_MANTRA
  `);
  console.table(rows);

  process.exit(0);
})();
