require('dotenv').config();
const { pool, MANTRA_CONFIG } = require('./mantra_service.cjs');

const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";

function parseSqlTimestamp(isoDateString) {
  if (!isoDateString) return null;
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Consulta y replica en MySQL todas las páginas de un reporte de plantilla de Mantra
 */
async function syncTemplateReport(grupoKey, templateId, alias, fromDate, toDate) {
  const config = MANTRA_CONFIG[grupoKey];
  if (!config || !templateId) return { error: `Configuración no válida para ${grupoKey} - ${alias}` };

  console.log(`\n=================================================================================`);
  console.log(`📥 Sincronizando Reporte: [${grupoKey}] ${alias}`);
  console.log(`   Template ID: ${templateId} | Rango: ${fromDate} al ${toDate}`);
  console.log(`=================================================================================`);

  let page = 1;
  let totalInserted = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(URL_TEMPLATE_REPORT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.API_KEY}`,
          'GroupId': config.GROUP_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: templateId,
          fromDate: fromDate,
          toDate: toDate,
          page: page,
          limit: 100
        })
      });

      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        console.log(`   Página ${page}: Sin más registros.`);
        break;
      }

      const rows = json.data;
      console.log(`   Página ${page}/${json.totalPages || 1}: Procesando ${rows.length} registros (Total general Mantra: ${json.total})...`);

      for (const item of rows) {
        await pool.query(`
          INSERT INTO REPORTE_PLANTILLAS_MANTRA (
            contacto_id, nombre, telefono, codigo_pais, email,
            agente_asignado, enviado_por,
            custom_1, custom_2, custom_3, custom_4, custom_5,
            custom_6, custom_7, custom_8, custom_9, custom_10,
            creado, fecha_envio, estado_mensaje, estado_chat,
            respuesta_boton, fecha_respuesta_boton, vendor_id,
            template_id, grupo_servicio, nombre_plantilla_alias
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            telefono = VALUES(telefono),
            codigo_pais = VALUES(codigo_pais),
            email = VALUES(email),
            agente_asignado = VALUES(agente_asignado),
            enviado_por = VALUES(enviado_por),
            custom_1 = VALUES(custom_1),
            custom_2 = VALUES(custom_2),
            custom_3 = VALUES(custom_3),
            custom_4 = VALUES(custom_4),
            custom_5 = VALUES(custom_5),
            custom_6 = VALUES(custom_6),
            custom_7 = VALUES(custom_7),
            custom_8 = VALUES(custom_8),
            custom_9 = VALUES(custom_9),
            custom_10 = VALUES(custom_10),
            creado = VALUES(creado),
            fecha_envio = VALUES(fecha_envio),
            estado_mensaje = VALUES(estado_mensaje),
            estado_chat = VALUES(estado_chat),
            respuesta_boton = VALUES(respuesta_boton),
            fecha_respuesta_boton = VALUES(fecha_respuesta_boton),
            vendor_id = VALUES(vendor_id),
            grupo_servicio = VALUES(grupo_servicio),
            nombre_plantilla_alias = VALUES(nombre_plantilla_alias);
        `, [
          item._id || item.contactId,
          item.name || null,
          item.phone ? String(item.phone) : '',
          item.countryCode || '51',
          item.email || null,
          item.agentName || null,
          item.sentBy || null,
          item.custom_1 || null,
          item.custom_2 || null,
          item.custom_3 || null,
          item.custom_4 || null,
          item.custom_5 || null,
          item.custom_6 || null,
          item.custom_7 || null,
          item.custom_8 || null,
          item.custom_9 || null,
          item.custom_10 || null,
          parseSqlTimestamp(item.createdAt),
          parseSqlTimestamp(item.msgSentAt),
          item.msgStatus || null,
          item.chatStatus || null,
          item.qrTxt || null,
          parseSqlTimestamp(item.qrAt),
          item.vendorId || item.contactFlowResponseId || null,
          templateId,
          grupoKey,
          alias
        ]);

        totalInserted++;
      }

      if (page >= (json.totalPages || 1)) {
        hasMore = false;
      } else {
        page++;
        await sleep(300); // Pausa leve para cuidar rate limits
      }
    } catch (err) {
      console.error(`   ❌ Error en página ${page}:`, err.message);
      hasMore = false;
    }
  }

  console.log(`✅ [${alias}] Finalizado: ${totalInserted} registros sincronizados en MySQL.`);
  return { alias, totalInserted };
}

/**
 * Sincroniza todas las plantillas de Averías e Instalaciones
 */
async function syncAllTemplates(fromDate, toDate) {
  const hoy = new Date().toISOString().slice(0, 10);
  const from = fromDate || hoy;
  const to = toDate || hoy;

  console.log(`=================================================================================`);
  console.log(`🚀 INICIANDO SINCRONIZACIÓN GENERAL DE REPORTES DE TODAS LAS PLANTILLAS`);
  console.log(`📅 Rango de Fechas: ${from} al ${to}`);
  console.log(`=================================================================================`);

  const templates = [
    // --- AVERÍAS ---
    {
      grupo: "Averias",
      templateId: MANTRA_CONFIG.Averias.TEMPLATE_ID_DEFAULT,
      alias: "Averías - Default"
    },
    {
      grupo: "Averias",
      templateId: MANTRA_CONFIG.Averias.TEMPLATE_ID_OESTE2,
      alias: "Averías - Sector Oeste 2"
    },
    {
      grupo: "Averias",
      templateId: MANTRA_CONFIG.Averias.TEMPLATE_REPROG_ID,
      alias: "Averías - Reprogramación"
    },
    // --- INSTALACIONES ---
    {
      grupo: "Instalacion",
      templateId: MANTRA_CONFIG.Instalacion.TEMPLATE_ID_DEFAULT,
      alias: "Instalación - Default"
    },
    {
      grupo: "Instalacion",
      templateId: MANTRA_CONFIG.Instalacion.TEMPLATE_ID_OESTE2,
      alias: "Instalación - Sector Oeste 2"
    },
    {
      grupo: "Instalacion",
      templateId: MANTRA_CONFIG.Instalacion.TEMPLATE_REPROG_ID,
      alias: "Instalación - Reprogramación"
    }
  ];

  const results = [];
  for (const t of templates) {
    const res = await syncTemplateReport(t.grupo, t.templateId, t.alias, from, to);
    results.push(res);
    await sleep(500);
  }

  console.log(`\n=================================================================================`);
  console.log(`🏁 RESUMEN GENERAL DE SINCRONIZACIÓN:`);
  console.table(results);
  console.log(`=================================================================================`);
}

module.exports = {
  syncTemplateReport,
  syncAllTemplates
};

// Si se ejecuta directamente desde la terminal
if (require.main === module) {
  const args = process.argv.slice(2);
  const fromDate = args[0] || new Date().toISOString().slice(0, 10);
  const toDate = args[1] || fromDate;

  syncAllTemplates(fromDate, toDate).then(async () => {
    // Mostrar vista de los primeros 10 registros replicados
    const [sample] = await pool.query(`
      SELECT contacto_id, nombre, telefono, custom_1 as Ticket, custom_2 as Fecha, custom_3 as Horario, 
             estado_mensaje, respuesta_boton, nombre_plantilla_alias, DATE_FORMAT(creado, '%Y-%m-%d %H:%i:%s') as f_creado
      FROM REPORTE_PLANTILLAS_MANTRA
      ORDER BY id DESC
      LIMIT 10
    `);
    console.log("\n📊 Muestra de datos replicados en REPORTE_PLANTILLAS_MANTRA:");
    console.table(sample);
    process.exit(0);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
