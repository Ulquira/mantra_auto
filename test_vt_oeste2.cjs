require('dotenv').config();
const { MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";
const TARGET_PHONE = "923226270";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("=== ENVIANDO CASO DE PRUEBA VT (OESTE 2 CON ETIQUETA TRAKING) ===");
  console.log(`📱 Teléfono destino: ${TARGET_PHONE}`);

  const averiasConf = MANTRA_CONFIG.Averias;
  
  const customData = {
    name: "PRUEBA VT OESTE 2",
    phone: TARGET_PHONE,
    countryCode: "51",
    custom_1: "VTEXT-OESTE2-TEST",
    custom_2: "8 de Septiembre",
    custom_3: "8AM - 12PM",
    custom_4: "CALLE LOS PINOS 123, CALLAO",
    custom_5: "https://go.win.pe/seguimiento/token_test_oeste2_vt",
    custom_6: "AVERIAS PREFERENTE",
    custom_7: "PRUEBA",
    custom_8: "8 de Septiembre",
    custom_9: "CALLAO / CALLAO / Bellavista",
    custom_10: "WI-NET TELECOM SGI",
    tagIds: [averiasConf.TAG_TRAKING_ID]
  };

  console.log(`\n1. Sincronizando contacto con Tag TRAKING (${averiasConf.TAG_TRAKING_ID})...`);
  try {
    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: averiasConf.GROUP_ID,
        apiKey: averiasConf.API_KEY,
        data: customData
      })
    });
    const jsonContact = await resContact.json();
    console.log("   👉 Respuesta Contacto Mantra:", jsonContact.resultOp || jsonContact);

    await sleep(1500);

    console.log(`\n2. Disparando Plantilla Oeste 2 VT (${averiasConf.TEMPLATE_ID_OESTE2})...`);
    const resTpl = await fetch(URL_SEND_TEMPLATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: averiasConf.GROUP_ID,
        apiKey: averiasConf.API_KEY,
        templateId: averiasConf.TEMPLATE_ID_OESTE2,
        phone: TARGET_PHONE,
        countryCode: "51"
      })
    });
    const jsonTpl = await resTpl.json();
    console.log("   👉 Respuesta Plantilla Mantra:", jsonTpl);

    if (jsonTpl.ok === true) {
      console.log("\n✅ Mensaje de VT Oeste 2 enviado exitosamente con la etiqueta TRAKING.");
    } else {
      console.error("\n❌ Error al enviar plantilla:", jsonTpl);
    }
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
})();
