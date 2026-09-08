require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";
const TEST_PHONE = "935434175";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("=== PRUEBA DE PLANTILLA INSTALACIONES OESTE 2 CON ESTRUCTURA ANTERIOR ===");

  const instaConf = MANTRA_CONFIG.Instalacion;
  
  // Estructura que espera la plantilla de la imagen:
  // "Hemos programado la instalación de tu plan {{custom_3}} para el día {{custom_1}} en el rango de {{custom_2}}"
  // "Sigue tu instalación con el siguiente enlace: {{custom_10}}"
  const instaData = {
    name: "TONNY TEST",
    phone: TEST_PHONE,
    countryCode: "51",
    custom_1: "8 de Septiembre",                       // Fecha
    custom_2: "12PM - 4PM",                           // Rango horario
    custom_3: "WIN 500 Mbps Simétrico + Win TV",      // Plan
    custom_4: "CALLE LOS PINOS 567",                  // Dirección
    custom_5: "https://go.win.pe/seguimiento/test_insta", // Link
    custom_6: "https://go.win.pe/seguimiento/test_insta",
    custom_7: "TONNY TEST",                           // Nombre
    custom_10: "https://go.win.pe/seguimiento/test_insta", // Link en el texto
    tagIds: [instaConf.TAG_TRAKING_ID]
  };

  const resInstaContact = await fetch(URL_CREATE_CONTACT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: instaConf.GROUP_ID,
      apiKey: instaConf.API_KEY,
      data: instaData
    })
  });
  console.log("   Contacto Mantra (Instalaciones):", (await resInstaContact.json()).resultOp || "ok");

  await sleep(1500);

  const resInstaTpl = await fetch(URL_SEND_TEMPLATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: instaConf.GROUP_ID,
      apiKey: instaConf.API_KEY,
      templateId: instaConf.TEMPLATE_ID_OESTE2,
      phone: TEST_PHONE,
      countryCode: "51"
    })
  });
  console.log("   Disparo Plantilla Oeste 2 (Instalaciones):", await resInstaTpl.json());

  console.log("\n✅ Prueba enviada. Revisa si ahora el texto encaja perfectamente.");
})();
