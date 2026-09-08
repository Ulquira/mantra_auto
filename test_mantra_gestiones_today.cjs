require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

// Endpoints oficiales de Mantra
const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";
const URL_CHAT_HISTORY = "https://wbpback2pro2.mantra.chat/contacts/chats/historial";

async function fetchTemplateReport(groupId, apiKey, templateId, fromDate, toDate, limit = 50) {
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
        page: 1,
        limit: limit
      })
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

async function fetchChatHistory(groupId, apiKey, phone) {
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
        limit: 10
      })
    });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

(async () => {
  const hoy = new Date().toISOString().slice(0, 10);
  console.log(`=============================================================`);
  console.log(`📊 CONSULTANDO ESTADO DE GESTIONES EN MANTRA`);
  console.log(`📅 Fecha de consulta: ${hoy}`);
  console.log(`=============================================================\n`);

  // 1. Consultar Reporte de Averías (Default y Oeste 2)
  const averiasConf = MANTRA_CONFIG.Averias;
  console.log(`🔍 1. Consultando Plantilla Averías Default (${averiasConf.TEMPLATE_ID_DEFAULT})...`);
  const reportAveriasDefault = await fetchTemplateReport(averiasConf.GROUP_ID, averiasConf.API_KEY, averiasConf.TEMPLATE_ID_DEFAULT, hoy, hoy, 50);

  console.log(`🔍 2. Consultando Plantilla Averías Oeste 2 (${averiasConf.TEMPLATE_ID_OESTE2})...`);
  const reportAveriasOeste2 = await fetchTemplateReport(averiasConf.GROUP_ID, averiasConf.API_KEY, averiasConf.TEMPLATE_ID_OESTE2, hoy, hoy, 50);

  // 2. Consultar Reporte de Instalaciones (Default y Oeste 2)
  const instaConf = MANTRA_CONFIG.Instalacion;
  console.log(`🔍 3. Consultando Plantilla Instalaciones Default (${instaConf.TEMPLATE_ID_DEFAULT})...`);
  const reportInstaDefault = await fetchTemplateReport(instaConf.GROUP_ID, instaConf.API_KEY, instaConf.TEMPLATE_ID_DEFAULT, hoy, hoy, 50);

  console.log(`🔍 4. Consultando Plantilla Instalaciones Oeste 2 (${instaConf.TEMPLATE_ID_OESTE2})...`);
  const reportInstaOeste2 = await fetchTemplateReport(instaConf.GROUP_ID, instaConf.API_KEY, instaConf.TEMPLATE_ID_OESTE2, hoy, hoy, 50);

  const allReports = [
    { name: "Averías Default", report: reportAveriasDefault, group: averiasConf },
    { name: "Averías Oeste 2", report: reportAveriasOeste2, group: averiasConf },
    { name: "Instalaciones Default", report: reportInstaDefault, group: instaConf },
    { name: "Instalaciones Oeste 2", report: reportInstaOeste2, group: instaConf }
  ];

  console.log(`\n=============================================================`);
  console.log(`📈 RESUMEN GENERAL DE CHATS Y ESTADOS POR PLANTILLA`);
  console.log(`=============================================================`);

  let totalChats = 0;
  const chatsMuestra = [];

  allReports.forEach(item => {
    const total = item.report.total || 0;
    totalChats += total;
    console.log(`📌 ${item.name}: ${total} mensajes registrados hoy.`);

    if (item.report.data && item.report.data.length > 0) {
      item.report.data.forEach(d => {
        chatsMuestra.push({
          plantilla: item.name,
          nombre: d.name,
          telefono: d.phone,
          msgStatus: d.msgStatus,
          chatStatus: d.chatStatus,
          agentName: d.agentName || 'Sin Asignar',
          sentAt: d.msgSentAt,
          groupId: item.group.GROUP_ID,
          apiKey: item.group.API_KEY
        });
      });
    }
  });

  console.log(`\nTotal general de mensajes/chats encontrados: ${totalChats}`);

  if (chatsMuestra.length > 0) {
    console.log(`\n=============================================================`);
    console.log(`📋 MUESTRA DE CONVERSACIONES ACTIVAS Y ASESORES (Primeros 10)`);
    console.log(`=============================================================`);
    console.table(chatsMuestra.slice(0, 10).map(c => ({
      Cliente: c.nombre,
      Telefono: c.telefono,
      Plantilla: c.plantilla,
      Estado_Mensaje: c.msgStatus,
      Estado_Chat: c.chatStatus,
      Asesor_Asignado: c.Asesor_Asignado || c.agentName
    })));

    // Análisis de inactividad en los primeros 3 casos
    console.log(`\n=============================================================`);
    console.log(`⏱️ ANÁLISIS DE TIEMPO / INACTIVIDAD (Primeros 3 casos con historial)`);
    console.log(`=============================================================`);

    for (let i = 0; i < Math.min(3, chatsMuestra.length); i++) {
      const c = chatsMuestra[i];
      console.log(`\n🔍 Analizando chat de ${c.nombre} (${c.telefono}) [Asesor: ${c.agentName}]...`);
      const history = await fetchChatHistory(c.groupId, c.apiKey, c.telefono);

      if (history.data && history.data.length > 0) {
        const ultimosMensajes = history.data.slice(0, 3);
        console.log(`   Total mensajes en historial: ${history.total}`);
        
        ultimosMensajes.forEach((m, idx) => {
          const emisor = m.sender === 'contact' ? 'CLIENTE' : 'EMPRESA/ASESOR';
          const texto = m.content ? (m.content.text || `[${m.content.type}]`) : 'N/A';
          console.log(`   [Msg ${idx + 1}] (${m.createdAt}) ${emisor}: "${texto.slice(0, 50)}"`);
        });

        const ultMsg = history.data[0];
        if (ultMsg.sender === 'contact') {
          const min = (Date.now() - new Date(ultMsg.createdAt).getTime()) / (1000 * 60);
          console.log(`   👉 ÚLTIMO MENSAJE FUE DEL CLIENTE: Lleva ${Math.round(min)} minutos esperando respuesta.`);
        } else {
          console.log(`   👉 ÚLTIMO MENSAJE FUE DE LA EMPRESA/ASESOR (Atendido o enviado).`);
        }
      } else {
        console.log(`   ℹ️ Sin mensajes bidireccionales adicionales (solo plantilla enviada).`);
      }
    }
  }

  process.exit(0);
})();
