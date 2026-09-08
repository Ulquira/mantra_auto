require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";
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

(async () => {
  const hoy = new Date().toISOString().slice(0, 10);
  console.log(`========================================================================================`);
  console.log(`⏱️ EXTRACCIÓN DE FECHAS Y HORAS DETALLADAS EN MANTRA (Hora Perú)`);
  console.log(`========================================================================================\n`);

  const averiasConf = MANTRA_CONFIG.Averias;
  
  // 1. Reporte de mensajes de plantilla con sus fechas/horas de envío
  const resReport = await fetch(URL_TEMPLATE_REPORT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${averiasConf.API_KEY}`,
      'GroupId': averiasConf.GROUP_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      templateId: averiasConf.TEMPLATE_ID_OESTE2,
      fromDate: hoy,
      toDate: hoy,
      page: 1,
      limit: 10
    })
  });
  const reportData = await resReport.json();

  if (reportData.data && reportData.data.length > 0) {
    console.log(`1. FECHAS Y HORAS DE ENVÍO DE PLANTILLAS:`);
    const tableData = reportData.data.map(d => ({
      Cliente: d.name,
      Telefono: d.phone,
      Estado_Envio: d.msgStatus,
      Fecha_Hora_Envio_UTC: d.msgSentAt,
      Fecha_Hora_Peru: formatPeruDateTime(d.msgSentAt)
    }));
    console.table(tableData);
  }

  // 2. Consulta de un contacto específico (Teléfono de prueba 923226270)
  const samplePhone = "923226270";
  console.log(`\n2. AUDITORÍA DE TIEMPOS PARA EL CLIENTE: ${samplePhone}`);

  const resPhone = await fetch(URL_BY_PHONE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: averiasConf.GROUP_ID,
      apiKey: averiasConf.API_KEY,
      phone: samplePhone,
      countryCode: "51"
    })
  });
  const phoneData = await resPhone.json();

  console.log(`   - Fecha/Hora de Creación del Contacto:    ${formatPeruDateTime(phoneData.createdAt)}`);
  console.log(`   - Fecha/Hora de Última Actualización:      ${formatPeruDateTime(phoneData.updatedAt)}`);
  console.log(`   - Fecha/Hora de Asignación de Asesor:     ${formatPeruDateTime(phoneData.agentAssignmentDate)}`);

  // 3. Historial de mensajes con fecha y hora de cada mensaje individual
  console.log(`\n3. LÍNEA DE TIEMPO DEL CHAT (Historial de Mensajes con Fecha y Hora exacta):`);
  const resHistory = await fetch(URL_CHAT_HISTORY, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${averiasConf.API_KEY}`,
      'GroupId': averiasConf.GROUP_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      countryCode: "51",
      phone: samplePhone,
      page: 1,
      limit: 5
    })
  });
  const historyData = await resHistory.json();

  if (historyData.data && historyData.data.length > 0) {
    historyData.data.forEach((m, idx) => {
      const emisor = m.sender === 'contact' ? '👤 CLIENTE' : '🏢 ASESOR / SISTEMA';
      const texto = m.content?.text ? m.content.text.replace(/\n/g, ' ').slice(0, 45) : `[${m.content?.type || 'media'}]`;
      console.log(`   [Msg #${idx + 1}]`);
      console.log(`     Emisor:         ${emisor}`);
      console.log(`     Fecha y Hora:   ${formatPeruDateTime(m.createdAt)}`);
      console.log(`     Estado Mensaje: ${m.status} (received/delivered/read)`);
      console.log(`     Contenido:      "${texto}..."`);
      if (m.agent?.name) {
        console.log(`     Asignado a:     ${m.agent.name} (el ${formatPeruDateTime(m.agent.assignedAt)})`);
      }
    });
  }

  process.exit(0);
})();
