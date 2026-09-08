require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";
const TEST_PHONE = "935434175";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("=== PRUEBA DE PLANTILLAS OESTE 2 CON ETIQUETA 'TRAKING' ===");

  // 1. Averías - Oeste 2
  console.log("\n1. Probando Averías (Sector Oeste 2)...");
  const averiasConf = MANTRA_CONFIG.Averias;
  const averiasData = {
    name: "TONNY TEST",
    phone: TEST_PHONE,
    countryCode: "51",
    custom_1: "VTEXT-TEST-TAG",
    custom_2: "8 de Septiembre",
    custom_3: "8AM - 12PM",
    custom_4: "AV. LA MARINA 1234",
    custom_5: "https://go.win.pe/seguimiento/test_tag_averias",
    custom_6: "AVERIAS PREFERENTE",
    custom_7: "TONNY TEST",
    custom_8: "8 de Septiembre",
    custom_9: "LIMA / LIMA / San Miguel",
    custom_10: "WI-NET TELECOM SGI",
    tagIds: [averiasConf.TAG_TRAKING_ID]
  };

  const resAveriasContact = await fetch(URL_CREATE_CONTACT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: averiasConf.GROUP_ID,
      apiKey: averiasConf.API_KEY,
      data: averiasData
    })
  });
  console.log("   Contacto Mantra (Averías):", (await resAveriasContact.json()).resultOp || "ok");

  await sleep(1500);

  const resAveriasTpl = await fetch(URL_SEND_TEMPLATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      groupId: averiasConf.GROUP_ID,
      apiKey: averiasConf.API_KEY,
      templateId: averiasConf.TEMPLATE_ID_OESTE2,
      phone: TEST_PHONE,
      countryCode: "51"
    })
  });
  console.log("   Disparo Plantilla Oeste 2 (Averías):", await resAveriasTpl.json());

  await sleep(3000);

  // 2. Instalaciones - Oeste 2
  console.log("\n2. Probando Instalaciones (Sector Oeste 2)...");
  const instaConf = MANTRA_CONFIG.Instalacion;
  const instaData = {
    name: "TONNY TEST",
    phone: TEST_PHONE,
    countryCode: "51",
    custom_1: "22889900",
    custom_2: "8 de Septiembre",
    custom_3: "12PM - 4PM",
    custom_4: "CALLE LOS PINOS 567",
    custom_5: "https://go.win.pe/seguimiento/test_tag_insta",
    custom_6: "WIN 500 Mbps",
    custom_7: "TONNY TEST",
    custom_8: "8 de Septiembre",
    custom_9: "LIMA / LIMA / Callao",
    custom_10: "WI-NET TELECOM SGI",
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

  console.log("\n✅ Pruebas finalizadas.");
})();
