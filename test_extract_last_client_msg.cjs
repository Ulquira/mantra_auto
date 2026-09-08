require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CHAT_HISTORY = "https://wbpback2pro2.mantra.chat/contacts/chats/historial";

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

/**
 * Obtiene y extrae el último mensaje enviado por el cliente (sender = 'contact')
 */
async function getLastClientMessage(groupId, apiKey, phone) {
  try {
    const res = await fetch(URL_CHAT_HISTORY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'GroupId': groupId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: "51",
        phone: phone,
        page: 1,
        limit: 20 // Traer los últimos 20 mensajes para buscar el último del cliente
      })
    });

    const json = await res.json();
    if (!json.data || json.data.length === 0) {
      return { found: false, message: "No hay historial de mensajes." };
    }

    // 1. Último mensaje global del chat
    const lastGlobalMsg = json.data[0];

    // 2. Buscar el último mensaje específicamente emitido por el cliente (sender === 'contact')
    const lastClientMsg = json.data.find(m => m.sender === 'contact');

    return {
      found: true,
      totalMessages: json.total,
      lastGlobal: {
        emisor: lastGlobalMsg.sender === 'contact' ? 'CLIENTE' : 'EMPRESA/BOT',
        tipo: lastGlobalMsg.content?.type || 'text',
        texto: lastGlobalMsg.content?.text || '',
        fechaHoraPeru: formatPeruDateTime(lastGlobalMsg.createdAt),
        rawTimestamp: lastGlobalMsg.createdAt
      },
      lastFromClient: lastClientMsg ? {
        tipo: lastClientMsg.content?.type || 'text',
        texto: lastClientMsg.content?.text || (lastClientMsg.content?.type === 'button_reply' ? '[Opción Seleccionada]' : '[Multimedia]'),
        fechaHoraPeru: formatPeruDateTime(lastClientMsg.createdAt),
        rawTimestamp: lastClientMsg.createdAt,
        minutosDesdeMensaje: Math.round((Date.now() - new Date(lastClientMsg.createdAt).getTime()) / (1000 * 60))
      } : null
    };
  } catch (err) {
    return { error: err.message };
  }
}

(async () => {
  console.log(`========================================================================================`);
  console.log(`💬 EXTRACCIÓN DEL ÚLTIMO MENSAJE DEL CLIENTE EN MANTRA`);
  console.log(`========================================================================================\n`);

  // Probar en grupo de Averías e Instalaciones con los teléfonos de prueba
  const phonesToTest = [
    { phone: "935434175", groupName: "Instalaciones", group: MANTRA_CONFIG.Instalacion },
    { phone: "935434175", groupName: "Averías", group: MANTRA_CONFIG.Averias },
    { phone: "923226270", groupName: "Averías", group: MANTRA_CONFIG.Averias }
  ];

  for (const item of phonesToTest) {
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`📱 Consultando Teléfono: ${item.phone} en Grupo: ${item.groupName}`);
    const result = await getLastClientMessage(item.group.GROUP_ID, item.group.API_KEY, item.phone);

    if (result.found) {
      console.log(`   📊 Total de mensajes en conversación: ${result.totalMessages}`);
      console.log(`   📌 Último mensaje general del chat:`);
      console.log(`      - Emisor:    ${result.lastGlobal.emisor}`);
      console.log(`      - Fecha:     ${result.lastGlobal.fechaHoraPeru}`);
      console.log(`      - Contenido: "${result.lastGlobal.texto.replace(/\n/g, ' ').slice(0, 70)}..."`);

      if (result.lastFromClient) {
        console.log(`   👤 ÚLTIMO MENSAJE ENVIADO POR EL CLIENTE:`);
        console.log(`      - Tipo:      ${result.lastFromClient.tipo}`);
        console.log(`      - Texto:     "${result.lastFromClient.texto}"`);
        console.log(`      - Fecha:     ${result.lastFromClient.fechaHoraPeru}`);
        console.log(`      - Hace:      ${result.lastFromClient.minutosDesdeMensaje} minutos`);
      } else {
        console.log(`   👤 El cliente aún no ha respondido ningún mensaje en este grupo.`);
      }
    } else {
      console.log(`   ℹ️ ${result.message || result.error}`);
    }
  }

  console.log(`\n========================================================================================`);
  process.exit(0);
})();
