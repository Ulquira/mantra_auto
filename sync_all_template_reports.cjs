require('dotenv').config();
const { pool, getControlTables } = require('./mantra_service.cjs');

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
async function syncTemplateReport(cfg, fromDate, toDate) {
  const { api_key, group_id, template_id, nombre_alias, tipo_servicio } = cfg;
  if (!api_key || !group_id || !template_id) {
    return { error: `Configuración no válida para ${nombre_alias}` };
  }

  console.log(`\n=================================================================================`);
  console.log(`📥 Sincronizando Reporte: [${tipo_servicio}] ${nombre_alias}`);
  console.log(`   Template ID: ${template_id} | Rango: ${fromDate} al ${toDate}`);
  console.log(`=================================================================================`);

  let page = 1;
  let totalInserted = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const res = await fetch(URL_TEMPLATE_REPORT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'GroupId': group_id,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: template_id,
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
            contacto_id, nombre, telefono, email,
            agente_asignado, enviado_por,
            codigo_pedido,
            creado, fecha_envio, estado_mensaje, estado_chat,
            respuesta_boton, fecha_respuesta_boton, vendor_id,
            template_id, grupo_servicio, nombre_plantilla_alias
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            telefono = VALUES(telefono),
            email = VALUES(email),
            agente_asignado = VALUES(agente_asignado),
            enviado_por = VALUES(enviado_por),
            codigo_pedido = VALUES(codigo_pedido),
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
          item.email || null,
          item.agentName || null,
          item.sentBy || null,
          item.custom_1 || null, // custom_1: Código de Pedido / Ticket
          parseSqlTimestamp(item.createdAt),
          parseSqlTimestamp(item.msgSentAt),
          item.msgStatus || null,
          item.chatStatus || null,
          item.qrTxt || null,
          parseSqlTimestamp(item.qrAt),
          item.vendorId || item.contactFlowResponseId || null,
          template_id,
          tipo_servicio,
          nombre_alias
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

  console.log(`✅ [${nombre_alias}] Finalizado: ${totalInserted} registros sincronizados en MySQL.`);
  return { alias: nombre_alias, totalInserted };
}

/**
 * Sincroniza todas las plantillas activas de la tabla dinámica
 */
async function syncAllTemplates(fromDate, toDate) {
  const hoy = new Date().toISOString().slice(0, 10);
  const from = fromDate || hoy;
  const to = toDate || hoy;

  console.log(`=================================================================================`);
  console.log(`🚀 INICIANDO SINCRONIZACIÓN GENERAL DE REPORTES DE TODAS LAS PLANTILLAS`);
  console.log(`📅 Rango de Fechas: ${from} al ${to}`);
  console.log(`=================================================================================`);

  const { configs } = await getControlTables(true);
  const activeConfigs = (configs || []).filter(c => c.activo === 1 && c.api_key && c.template_id);

  const results = [];
  for (const cfg of activeConfigs) {
    const res = await syncTemplateReport(cfg, from, to);
    results.push(res);
    await sleep(500);
  }

  console.log(`\n=================================================================================`);
  console.log(`🏁 SINCRONIZACIÓN GENERAL FINALIZADA CON ÉXITO`);
  console.table(results);
  console.log(`=================================================================================`);
  return results;
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
      SELECT contacto_id, nombre, telefono, codigo_pedido, 
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
