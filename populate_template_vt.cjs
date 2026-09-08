require('dotenv').config();
const { pool, MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";
const URL_CHAT_HISTORY = "https://wbpback2pro2.mantra.chat/contacts/chats/historial";
const URL_BY_PHONE = "https://wbpback2pro2.mantra.chat/contacts/byphone";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function fetchTemplateMessagesPaginated(groupId, apiKey, templateId, fromDate, toDate) {
  let allMessages = [];
  let page = 1;
  let totalPages = 1;

  console.log(`📡 Consultando reporte de plantilla ${templateId} entre ${fromDate} y ${toDate}...`);

  while (page <= totalPages) {
    try {
      const res = await fetch(URL_TEMPLATE_REPORT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'GroupId': groupId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: templateId,
          fromDate: fromDate,
          toDate: toDate,
          page: page,
          limit: 100
        })
      });

      const json = await res.json();
      if (!json.data || json.data.length === 0) break;

      allMessages = allMessages.concat(json.data);
      totalPages = json.totalPages || 1;
      console.log(`   Página ${page}/${totalPages} descargada (${json.data.length} registros).`);
      page++;
      await sleep(300);
    } catch (err) {
      console.error(`   ❌ Error en página ${page}:`, err.message);
      break;
    }
  }

  return allMessages;
}

async function syncSinglePhone(phone, groupConfig, grupoKey = 'Averias') {
  try {
    // 1. Obtener asesor asignado y estado
    let asesorAsignado = null;
    let estadoChat = 'Pendiente';
    try {
      const resPhone = await fetch(URL_BY_PHONE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: groupConfig.GROUP_ID,
          apiKey: groupConfig.API_KEY,
          phone: phone,
          countryCode: '51'
        })
      });
      const phoneData = await resPhone.json();
      asesorAsignado = phoneData.agent || phoneData.agentName || null;
      if (phoneData.chatStatusTags && phoneData.chatStatusTags.length > 0) {
        estadoChat = phoneData.chatStatusTags[0];
      }
    } catch (e) {}

    // 2. Obtener historial
    const resHistory = await fetch(URL_CHAT_HISTORY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groupConfig.API_KEY}`,
        'GroupId': groupConfig.GROUP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: '51',
        phone: phone,
        page: 1,
        limit: 15
      })
    });

    const json = await resHistory.json();
    if (!json.data || json.data.length === 0) {
      return { success: false, reason: 'Sin historial' };
    }

    const messages = json.data;
    const totalMensajes = json.total || messages.length;

    const lastGlobal = messages[0];
    const ultimoEmisor = lastGlobal.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA';
    const ultimoTexto = lastGlobal.content?.text || (lastGlobal.content?.type === 'button_reply' ? '[Opción Botón]' : `[${lastGlobal.content?.type || 'media'}]`);
    const ultimoFecha = parseSqlTimestamp(lastGlobal.createdAt);

    const lastClientIndex = messages.findIndex(m => m.sender === 'contact');
    let ultimoClienteTexto = null;
    let ultimoClienteFecha = null;
    let tuvoRespuesta = false;
    let tiempoEsperaMinutos = 0;

    if (lastClientIndex !== -1) {
      const lastClientMsg = messages[lastClientIndex];
      ultimoClienteTexto = lastClientMsg.content?.text || (lastClientMsg.content?.type === 'button_reply' ? '[Opción Botón]' : `[${lastClientMsg.content?.type || 'media'}]`);
      ultimoClienteFecha = parseSqlTimestamp(lastClientMsg.createdAt);

      if (lastClientIndex > 0) {
        tuvoRespuesta = true;
        const msgRespuesta = messages[lastClientIndex - 1];
        const diffMs = new Date(msgRespuesta.createdAt).getTime() - new Date(lastClientMsg.createdAt).getTime();
        tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
      } else {
        tuvoRespuesta = false;
        const diffMs = Date.now() - new Date(lastClientMsg.createdAt).getTime();
        tiempoEsperaMinutos = Math.max(0, Math.round(diffMs / (1000 * 60)));
      }
    } else {
      tuvoRespuesta = true;
      tiempoEsperaMinutos = 0;
    }

    const ultimos3 = messages.slice(0, 3).map((m, idx) => ({
      orden_reciente: idx + 1,
      emisor: m.sender === 'contact' ? 'CLIENTE' : 'ASESOR/EMPRESA',
      texto: m.content?.text || `[${m.content?.type || 'media'}]`,
      fecha_hora_peru: formatPeruDateTime(m.createdAt),
      timestamp_utc: m.createdAt,
      agente: m.agent?.name || m.sentByUser?.name || null,
      estado_envio: m.status
    }));

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
      success: true,
      phone,
      totalMensajes,
      ultimoEmisor,
      ultimoClienteTexto,
      tuvoRespuesta,
      tiempoEsperaMinutos,
      asesorAsignado
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function processBatchConcurrently(phones, groupConfig, grupoKey = 'Averias', concurrency = 8) {
  let index = 0;
  let procesados = 0;
  let conInteraccionCliente = 0;
  let esperandoRespuesta = 0;

  async function worker() {
    while (index < phones.length) {
      const currentIndex = index++;
      const phone = phones[currentIndex];
      
      const res = await syncSinglePhone(phone, groupConfig, grupoKey);
      procesados++;
      
      if (res.success) {
        if (res.ultimoClienteTexto) conInteraccionCliente++;
        if (!res.tuvoRespuesta && res.ultimoClienteTexto) esperandoRespuesta++;
        console.log(`[${procesados}/${phones.length}] ✅ ${phone} | Msgs: ${res.totalMensajes} | Cliente: ${res.ultimoClienteTexto ? 'SÍ' : 'NO'} | Espera: ${res.tiempoEsperaMinutos}m | Asesor: ${res.asesorAsignado || 'Sin Asignar'}`);
      } else {
        console.log(`[${procesados}/${phones.length}] ⚠️ ${phone} | ${res.reason || res.error}`);
      }
      
      await sleep(100);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  return { procesados, conInteraccionCliente, esperandoRespuesta };
}

(async () => {
  const TEMPLATE_ID = "68fac2ea40478663c8b51c36"; // Plantilla solicitada de Averías
  const averiasConf = MANTRA_CONFIG.Averias;
  
  // Rango de fechas: últimos 7 días
  const todayObj = new Date();
  const toDate = todayObj.toISOString().slice(0, 10);
  const fromObj = new Date(todayObj.getTime() - (7 * 24 * 60 * 60 * 1000));
  const fromDate = fromObj.toISOString().slice(0, 10);

  console.log("=================================================================================");
  console.log(`🚀 POBLADO RÁPIDO CONCURRENTE (8 HILOS EN PARALELO)`);
  console.log(`📄 Plantilla VT: ${TEMPLATE_ID} | Rango: ${fromDate} al ${toDate}`);
  console.log("=================================================================================\n");

  const messages = await fetchTemplateMessagesPaginated(
    averiasConf.GROUP_ID,
    averiasConf.API_KEY,
    TEMPLATE_ID,
    fromDate,
    toDate
  );

  console.log(`\n📊 Total de mensajes descargados: ${messages.length}`);

  const uniquePhones = Array.from(new Set(messages.map(m => m.phone).filter(p => p && p.length >= 9)));
  console.log(`📱 Total de clientes únicos a sincronizar: ${uniquePhones.length}\n`);

  const startTime = Date.now();
  const stats = await processBatchConcurrently(uniquePhones, averiasConf, 'Averias', 8);
  const elapsedSec = Math.round((Date.now() - startTime) / 1000);

  console.log("\n=================================================================================");
  console.log(`📈 RESUMEN DEL POBLADO EN MYSQL (${elapsedSec} segundos):`);
  console.log(`   - Clientes procesados: ${stats.procesados}`);
  console.log(`   - Clientes que escribieron mensajes: ${stats.conInteraccionCliente}`);
  console.log(`   - Clientes esperando respuesta actualmente: ${stats.esperandoRespuesta}`);
  console.log("=================================================================================\n");

  console.log("📊 CONSULTANDO VISTA: vw_monitoreo_atencion_chats (Casos con interacción):");
  const [reportRows] = await pool.query(`
    SELECT 
      telefono,
      cliente,
      asesor_asignado,
      estado_chat,
      IF(tuvo_respuesta = 1, 'RESPONDIDO', '⚠️ ESPERANDO') AS estado_atencion,
      CONCAT(tiempo_espera_minutos, ' min') AS espera,
      ultimo_mensaje_emisor AS emisor,
      LEFT(ultimo_mensaje_cliente_texto, 35) AS ultimo_msg_cliente
    FROM vw_monitoreo_atencion_chats
    WHERE ultimo_mensaje_cliente_texto IS NOT NULL
    ORDER BY tuvo_respuesta ASC, tiempo_espera_minutos DESC
    LIMIT 10
  `);
  console.table(reportRows);

  process.exit(0);
})();
