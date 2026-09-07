require('dotenv').config();

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";

const TEST_PHONE = "935434175";
const TEST_NAME = "TONNY TEST";

const TEMPLATES_TO_TEST = [
  // --- AVERÍAS (VISITAS TÉCNICAS) ---
  {
    category: "Averías",
    name: "Averías - Default",
    groupId: "68508b455ba42fd0a6660300",
    apiKey: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    templateId: "68fac2ea40478663c8b51c36",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "VTEXT-TEST-001",
      custom_2: "7 de Septiembre",
      custom_3: "8AM - 12PM",
      custom_4: "Av. La Marina 1234, San Miguel",
      custom_5: "https://go.win.pe/seguimiento/token_test_averias",
      custom_6: "https://go.win.pe/seguimiento/token_test_averias",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_averias"
    }
  },
  {
    category: "Averías",
    name: "Averías - Sector Oeste 2",
    groupId: "68508b455ba42fd0a6660300",
    apiKey: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    templateId: "6a90c047e91ab8e19836a561",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "VTEXT-TEST-002",
      custom_2: "7 de Septiembre",
      custom_3: "12PM - 4PM",
      custom_4: "Calle Los Pinos 567, Callao",
      custom_5: "https://go.win.pe/seguimiento/token_test_oeste2",
      custom_6: "https://go.win.pe/seguimiento/token_test_oeste2",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_oeste2"
    }
  },
  {
    category: "Averías",
    name: "Averías - Reprogramación",
    groupId: "68508b455ba42fd0a6660300",
    apiKey: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    templateId: "6a984a1d5781ebbf9f145a6b",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "VTEXT-TEST-REPROG",
      custom_2: "8 de Septiembre",
      custom_3: "8AM - 12PM",
      custom_4: "Av. Benavides 4567, Surco",
      custom_5: "https://go.win.pe/seguimiento/token_test_reprog",
      custom_6: "https://go.win.pe/seguimiento/token_test_reprog",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_reprog"
    }
  },

  // --- INSTALACIONES ---
  {
    category: "Instalación",
    name: "Instalación - Default",
    groupId: "685dc70e53dd0ac2492c69ca",
    apiKey: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    templateId: "6875723e1cb8562af849400e",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "7 de Septiembre",
      custom_2: "8AM - 12PM",
      custom_3: "WIN 500 Mbps Simétrico + Win TV",
      custom_5: "https://go.win.pe/seguimiento/token_test_insta",
      custom_6: "https://go.win.pe/seguimiento/token_test_insta",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_insta"
    }
  },
  {
    category: "Instalación",
    name: "Instalación - Sector Oeste 2",
    groupId: "685dc70e53dd0ac2492c69ca",
    apiKey: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    templateId: "6a7a457736ef53a657fc03ed",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "7 de Septiembre",
      custom_2: "4PM - 8PM",
      custom_3: "WIN 1000 Mbps Gamer",
      custom_5: "https://go.win.pe/seguimiento/token_test_insta_o2",
      custom_6: "https://go.win.pe/seguimiento/token_test_insta_o2",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_insta_o2"
    }
  },
  {
    category: "Instalación",
    name: "Instalación - Reprogramación",
    groupId: "685dc70e53dd0ac2492c69ca",
    apiKey: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    templateId: "6a9847e14f6db1b188cd5ce3",
    customData: {
      name: TEST_NAME,
      phone: TEST_PHONE,
      countryCode: "51",
      custom_1: "9 de Septiembre",
      custom_2: "12PM - 4PM",
      custom_3: "WIN 600 Mbps Dúo",
      custom_5: "https://go.win.pe/seguimiento/token_test_insta_reprog",
      custom_6: "https://go.win.pe/seguimiento/token_test_insta_reprog",
      custom_7: TEST_NAME,
      custom_10: "https://go.win.pe/seguimiento/token_test_insta_reprog"
    }
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTestAllTemplates() {
  console.log(`=============================================================`);
  console.log(`🚀 INICIANDO TEST DE TODAS LAS PLANTILLAS (${TEMPLATES_TO_TEST.length} en total)`);
  console.log(`📱 Teléfono destino: ${TEST_PHONE}`);
  console.log(`=============================================================\n`);

  for (let i = 0; i < TEMPLATES_TO_TEST.length; i++) {
    const t = TEMPLATES_TO_TEST[i];
    console.log(`-------------------------------------------------------------`);
    console.log(`[${i + 1}/${TEMPLATES_TO_TEST.length}] Probando: ${t.name} (Categoría: ${t.category})`);
    console.log(`   Group ID:    ${t.groupId}`);
    console.log(`   Template ID: ${t.templateId}`);

    // 1. Actualizar Contacto con sus variables correspondientes
    try {
      const contactPayload = {
        groupId: t.groupId,
        apiKey: t.apiKey,
        data: t.customData
      };

      const resContact = await fetch(URL_CREATE_CONTACT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload)
      });
      const jsonContact = await resContact.json();
      console.log(`   👉 Contacto Mantra:`, jsonContact.resultOp || jsonContact);

      // Pequeña pausa para asegurar sincronización en Mantra
      await sleep(1500);

      // 2. Disparar Plantilla
      const templatePayload = {
        groupId: t.groupId,
        apiKey: t.apiKey,
        templateId: t.templateId,
        phone: TEST_PHONE,
        countryCode: "51"
      };

      const resTemplate = await fetch(URL_SEND_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });
      const jsonTemplate = await resTemplate.json();

      if (jsonTemplate.ok === true) {
        console.log(`   ✅ ENVÍO EXITOSO: Mensaje enviado correctamente.`);
      } else {
        console.error(`   ❌ ERROR EN ENVÍO:`, jsonTemplate);
      }
    } catch (err) {
      console.error(`   ❌ ERROR CRÍTICO:`, err.message);
    }

    // Esperar 3 segundos entre envíos para no saturar
    await sleep(3000);
  }

  console.log(`\n=============================================================`);
  console.log(`🏁 TEST FINALIZADO. Revisa tu WhatsApp para confirmar la recepción de los mensajes.`);
  console.log(`=============================================================`);
}

runTestAllTemplates();
