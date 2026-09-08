require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";
const TEST_PHONE = "935434175";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("=== PROBANDO PLANTILLA REPROGRAMACIÓN VT CON CAMPOS CORREGIDOS ===");

  const averiasConf = MANTRA_CONFIG.Averias;
  
  // custom_1: Fecha (ej. "10 de Septiembre")
  // custom_2: Rango horario (ej. "12pm - 4pm")
  // custom_3: Ticket (ej. "VTEXT-45903140")
  const reprogData = {
    name: "TONNY TEST",
    phone: TEST_PHONE,
    countryCode: "51",
    custom_1: "10 de Septiembre",
    custom_2: "12pm - 4pm",
    custom_3: "VTEXT-45903140",
    custom_4: "AV. LA MARINA 1234, SAN MIGUEL",
    custom_5: "https://go.win.pe/seguimiento/test_reprog",
    custom_6: "AVERIAS PREFERENTE",
    custom_7: "TONNY TEST",
    custom_8: "8 de Septiembre",
    custom_9: "LIMA / LIMA / San Miguel",
    custom_10: "https://go.win.pe/seguimiento/test_reprog"
  };

  console.log("1. Actualizando contacto para reprogramación...");
  const resContact = await fetch(URL_CREATE_CONTACT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: averiasConf.GROUP_ID,
      apiKey: averiasConf.API_KEY,
      data: reprogData
    })
  });
  console.log("   👉 Contacto Mantra:", (await resContact.json()).resultOp || "ok");

  await sleep(1500);

  console.log("2. Disparando plantilla de Reprogramación Averías...");
  const resTpl = await fetch(URL_SEND_TEMPLATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: averiasConf.GROUP_ID,
      apiKey: averiasConf.API_KEY,
      templateId: averiasConf.TEMPLATE_REPROG_ID,
      phone: TEST_PHONE,
      countryCode: "51"
    })
  });
  const jsonTpl = await resTpl.json();
  console.log("   👉 Disparo Plantilla Reprog:", jsonTpl);

  console.log("\n✅ Mensaje de Reprogramación enviado. Por favor valida cómo se lee ahora.");
})();
