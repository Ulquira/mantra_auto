require('dotenv').config();
const fs = require('fs');

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";

// Configuración de credenciales y plantillas de Fe de Erratas por Segmento
const FE_ERRATAS_CONFIG = {
  Averias: {
    name: "Visita Técnica (Averías)",
    GROUP_ID: "68508b455ba42fd0a6660300",
    API_KEY: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    TEMPLATE_ID: "6a9ed6b828ea246e3f3ab36b"
  },
  Instalaciones: {
    name: "Instalaciones (Lima y Provincia)",
    GROUP_ID: "685dc70e53dd0ac2492c69ca",
    API_KEY: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    TEMPLATE_ID: "6a9ed6c428ea246e3f3ab36c"
  }
};

function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return "Cliente";
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean) return "Cliente";
  if (clean.includes(',')) {
    const parts = clean.split(',');
    const nombres = (parts[1] || '').trim();
    if (nombres) return nombres.split(' ')[0];
  }
  return clean.split(' ')[0];
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSingleClient(targetPhone, targetCategory = 'Averias') {
  const config = FE_ERRATAS_CONFIG[targetCategory];
  console.log(`\n======================================================`);
  console.log(`🧪 PROBANDO ENVÍO DE FE DE ERRATAS: ${config.name}`);
  console.log(`📱 Teléfono destino: ${targetPhone}`);
  console.log(`🔑 Group ID: ${config.GROUP_ID}`);
  console.log(`📄 Template ID: ${config.TEMPLATE_ID}`);
  console.log(`======================================================\n`);

  try {
    // 1. Contacto
    const contactPayload = {
      groupId: config.GROUP_ID,
      apiKey: config.API_KEY,
      data: {
        name: "TEST FE DE ERRATAS",
        phone: targetPhone,
        countryCode: "51",
        custom_7: "TEST FE DE ERRATAS"
      }
    };

    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload)
    });
    const jsonContact = await resContact.json();
    console.log(`👉 Respuesta Contacto Mantra:`, jsonContact.resultOp || jsonContact);

    await sleep(1500);

    // 2. Disparo de Plantilla
    const templatePayload = {
      groupId: config.GROUP_ID,
      apiKey: config.API_KEY,
      templateId: config.TEMPLATE_ID,
      phone: targetPhone,
      countryCode: "51"
    };

    const resTemplate = await fetch(URL_SEND_TEMPLATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templatePayload)
    });
    const jsonTemplate = await resTemplate.json();
    console.log(`👉 Respuesta Plantilla Mantra:`, jsonTemplate);

    if (jsonTemplate.ok === true) {
      console.log(`\n✅ ÉXITO: Plantilla de Fe de Erratas (${config.name}) enviada correctamente.`);
    } else {
      console.error(`\n❌ ERROR: La plantilla no se pudo enviar:`, jsonTemplate);
    }
  } catch (err) {
    console.error(`❌ ERROR CRÍTICO:`, err.message);
  }
}

async function sendFeDeErratasBatch(isDryRun = true) {
  const rawList = JSON.parse(fs.readFileSync('clientes_no_debieron_enviarse.json', 'utf8'));

  // Deduplicamos por (Telefono + Segmento) para no enviar dos veces al mismo número del mismo segmento
  const uniqueTargetsMap = new Map();
  rawList.forEach(item => {
    const segmento = item.Tipo_Categoria === 'AVERIAS' ? 'Averias' : 'Instalaciones';
    const key = `${item.Telefono}_${segmento}`;
    if (!uniqueTargetsMap.has(key) && item.Telefono && item.Telefono.length === 9) {
      uniqueTargetsMap.set(key, {
        ordenId: item.OrdenId,
        cliente: item.Cliente,
        telefono: item.Telefono,
        segmento: segmento
      });
    }
  });

  const targets = Array.from(uniqueTargetsMap.values());
  const averiasTargets = targets.filter(t => t.segmento === 'Averias');
  const instaTargets = targets.filter(t => t.segmento === 'Instalaciones');

  console.log(`========================================================================`);
  console.log(`📋 RESUMEN DEL PADRÓN DEDUPLICADO PARA FE DE ERRATAS:`);
  console.log(`   Total registros originales: ${rawList.length}`);
  console.log(`   Total envíos únicos a realizar: ${targets.length}`);
  console.log(`   - Visitas Técnicas (Averías): ${averiasTargets.length} clientes`);
  console.log(`   - Instalaciones: ${instaTargets.length} clientes`);
  console.log(`========================================================================\n`);

  if (isDryRun) {
    console.log(`🛡️ MODO SIMULACIÓN (DRY RUN): No se enviarán mensajes reales.`);
    console.log(`Para ejecutar el envío real masivo, se debe invocar con isDryRun = false tras confirmación.`);
    return;
  }

  console.log(`🚀 INICIANDO ENVÍO MASIVO REAL...`);
  
  // Archivo de persistencia de progreso para evitar duplicados en caso de corte o reanudación
  const PROGRESS_FILE = 'fe_erratas_progreso.json';
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    } catch (e) {
      progress = {};
    }
  }

  let enviadosExito = 0;
  let fallidos = 0;
  let yaEnviadosPrevios = 0;

  for (let i = 0; i < targets.length; i++) {
    const item = targets[i];
    const targetKey = `${item.telefono}_${item.segmento}`;

    // Si ya fue procesado con éxito previamente, lo saltamos
    if (progress[targetKey] && progress[targetKey].success) {
      yaEnviadosPrevios++;
      continue;
    }

    const config = FE_ERRATAS_CONFIG[item.segmento];
    const firstName = extractFirstName(item.cliente);

    console.log(`[${i + 1}/${targets.length}] Enviando Fe de Erratas a ${firstName} (${item.telefono}) | Segmento: ${config.name}`);

    try {
      // 1. Sincronizar contacto
      const contactPayload = {
        groupId: config.GROUP_ID,
        apiKey: config.API_KEY,
        data: {
          name: firstName,
          phone: item.telefono,
          countryCode: "51",
          custom_7: firstName
        }
      };

      await fetch(URL_CREATE_CONTACT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactPayload)
      });

      await sleep(1000);

      // 2. Disparar plantilla
      const templatePayload = {
        groupId: config.GROUP_ID,
        apiKey: config.API_KEY,
        templateId: config.TEMPLATE_ID,
        phone: item.telefono,
        countryCode: "51"
      };

      const resTemplate = await fetch(URL_SEND_TEMPLATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });
      const jsonTemplate = await resTemplate.json();

      if (jsonTemplate.ok === true) {
        enviadosExito++;
        progress[targetKey] = { success: true, timestamp: new Date().toISOString(), cliente: firstName, telefono: item.telefono, segmento: item.segmento };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.log(`   ✅ Enviado con éxito.`);
      } else {
        fallidos++;
        progress[targetKey] = { success: false, error: jsonTemplate, timestamp: new Date().toISOString() };
        fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        console.error(`   ❌ Fallo al disparar plantilla:`, jsonTemplate);
      }
    } catch (err) {
      fallidos++;
      console.error(`   ❌ Error en petición:`, err.message);
    }

    // Pausa de 1.5 segundos entre envíos para proteger el rate limit de Mantra
    await sleep(1500);
  }

  console.log(`\n========================================================================`);
  console.log(`🏁 PROCESO FINALIZADO.`);
  console.log(`   ✅ Exitosos en esta sesión: ${enviadosExito}`);
  console.log(`   ⏭️ Omitidos (ya enviados previamente): ${yaEnviadosPrevios}`);
  console.log(`   ❌ Fallidos: ${fallidos}`);
  console.log(`========================================================================`);
}

// Exportar funciones y ejecutar resumen en dry-run si se corre directamente
module.exports = {
  testSingleClient,
  sendFeDeErratasBatch
};

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    // Prueba a número específico
    const phone = args[1] || '935434175';
    testSingleClient(phone, 'Averias').then(() => testSingleClient(phone, 'Instalaciones'));
  } else if (args.includes('--execute')) {
    // Envío real controlado
    sendFeDeErratasBatch(false);
  } else {
    // Por defecto corre en modo seguro (Dry Run)
    sendFeDeErratasBatch(true);
  }
}
