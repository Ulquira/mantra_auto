require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";
const TARGET_PHONE = "935434175";
const CLIENT_NAME = "Tonny";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const averiasConf = MANTRA_CONFIG.Averias;

  console.log(`==================================================================`);
  console.log(`🚀 INICIANDO PRUEBAS DE PLANTILLAS DE AVERÍAS`);
  console.log(`📱 Teléfono destino: ${TARGET_PHONE}`);
  console.log(`🏢 Group ID: ${averiasConf.GROUP_ID}`);
  console.log(`==================================================================\n`);

  const tests = [
    {
      nombre: "1. Averías - Plantilla Default",
      templateId: averiasConf.TEMPLATE_ID_DEFAULT,
      data: {
        name: CLIENT_NAME,
        phone: TARGET_PHONE,
        countryCode: "51",
        custom_1: "VTEXT-DEF-001",
        custom_2: "8 de Septiembre",
        custom_3: "8AM - 12PM",
        custom_4: "Av. Javier Prado Este 1234, San Isidro",
        custom_5: "https://go.win.pe/seguimiento/token_test_default",
        custom_6: "Plan Fibra Win 500 Mbps",
        custom_7: CLIENT_NAME,
        custom_8: "8 de Septiembre",
        custom_9: "LIMA / LIMA / San Isidro",
        custom_10: "WIN"
      }
    },
    {
      nombre: "2. Averías - Plantilla Sector Oeste 2 (con Tag TRAKING)",
      templateId: averiasConf.TEMPLATE_ID_OESTE2,
      data: {
        name: CLIENT_NAME,
        phone: TARGET_PHONE,
        countryCode: "51",
        custom_1: "VTEXT-OESTE2-002",
        custom_2: "8 de Septiembre",
        custom_3: "12PM - 4PM",
        custom_4: "Calle Los Pinos 567, Bellavista, Callao",
        custom_5: "https://go.win.pe/seguimiento/token_test_oeste2",
        custom_6: "Plan Fibra Win 1000 Mbps",
        custom_7: CLIENT_NAME,
        custom_8: "8 de Septiembre",
        custom_9: "CALLAO / CALLAO / Bellavista",
        custom_10: "WIN",
        tagIds: [averiasConf.TAG_TRAKING_ID]
      }
    },
    {
      nombre: "3. Averías - Plantilla Reprogramación",
      templateId: averiasConf.TEMPLATE_REPROG_ID,
      data: {
        name: CLIENT_NAME,
        phone: TARGET_PHONE,
        countryCode: "51",
        custom_1: "9 de Septiembre", // Fecha de la cita reprogramada
        custom_2: "4PM - 8PM",       // Horario
        custom_3: "VTEXT-REPROG-003",// Ticket
        custom_4: "Av. La Marina 4567, San Miguel",
        custom_5: "https://go.win.pe/seguimiento/token_test_reprog",
        custom_6: "Plan Fibra Win 500 Mbps",
        custom_7: CLIENT_NAME,
        custom_8: "8 de Septiembre",
        custom_9: "LIMA / LIMA / San Miguel",
        custom_10: "https://go.win.pe/seguimiento/token_test_reprog"
      }
    }
  ];

  for (const t of tests) {
    console.log(`------------------------------------------------------------------`);
    console.log(`📌 Ejecutando: ${t.nombre}`);
    console.log(`   Template ID: ${t.templateId}`);
    
    // 1. Crear / actualizar contacto en Mantra
    try {
      const resContact = await fetch(URL_CREATE_CONTACT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: averiasConf.GROUP_ID,
          apiKey: averiasConf.API_KEY,
          data: t.data
        })
      });
      const jsonContact = await resContact.json();
      console.log(`   👤 Contacto sincronizado:`, jsonContact.resultOp || jsonContact);
    } catch (e) {
      console.error(`   ❌ Error al sincronizar contacto:`, e.message);
    }

    await sleep(1500);

    // 2. Disparar plantilla
    try {
      const resTpl = await fetch(URL_SEND_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: averiasConf.GROUP_ID,
          apiKey: averiasConf.API_KEY,
          templateId: t.templateId,
          phone: TARGET_PHONE,
          countryCode: "51"
        })
      });
      const jsonTpl = await resTpl.json();
      console.log(`   📨 Resultado envío plantilla:`, jsonTpl);
      if (jsonTpl.ok) {
        console.log(`   ✅ Enviado correctamente.`);
      } else {
        console.log(`   ⚠️ Respuesta no satisfactoria:`, jsonTpl);
      }
    } catch (e) {
      console.error(`   ❌ Error al disparar plantilla:`, e.message);
    }

    await sleep(2500);
  }

  console.log(`\n==================================================================`);
  console.log(`🏁 Pruebas de Averías finalizadas.`);
  console.log(`==================================================================`);
})();
