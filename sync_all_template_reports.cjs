require('dotenv').config();
const { pool, getControlTables } = require('./mantra_service.cjs');
const {
  extractContactPhone,
  extractOrderId,
  extractTemplateFields,
  extractTicket,
  isValidTicket,
  resolveConfiguredCustomValue
} = require('./scripts/mantra_report_helpers.cjs');
const { getDateInTimeZone } = require('./scripts/date_utils.cjs');

const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";

function parseSqlTimestamp(isoDateString) {
  if (!isoDateString) return null;
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toPeruUtcIsoBounds(fromDateStr, toDateStr) {
  const fromIso = (fromDateStr && fromDateStr.includes('T'))
    ? fromDateStr
    : new Date(`${fromDateStr}T00:00:00-05:00`).toISOString();
  const toIso = (toDateStr && toDateStr.includes('T'))
    ? toDateStr
    : new Date(`${toDateStr}T23:59:59-05:00`).toISOString();
  return { fromIso, toIso };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveCodigoPedido(item, cfg) {
  const fields = item.customFields || item;
  const ticket = extractTicket(item, cfg);
  if (ticket && isValidTicket(ticket)) return ticket;

  const legacyValue = fields.custom_6 || fields.custom_1;
  if (legacyValue) {
    const value = String(legacyValue).trim();
    if (isValidTicket(value)) {
      return value;
    }
  }
  return item.contactId || item._id || null;
}

/**
 * Consulta y replica en MySQL todas las páginas de un reporte de plantilla de Mantra
 */
async function syncTemplateReport(cfg, fromDate, toDate) {
  const { api_key, group_id, template_id, nombre_alias, tipo_servicio } = cfg;
  if (!api_key || !group_id || !template_id) {
    throw new Error(`Configuración incompleta para la plantilla ${nombre_alias}.`);
  }

  console.log(`\n=================================================================================`);
  console.log(`📥 Sincronizando Reporte: [${tipo_servicio}] ${nombre_alias}`);
  const { fromIso, toIso } = toPeruUtcIsoBounds(fromDate, toDate);
  console.log(`   Template ID: ${template_id} | Rango Perú: ${fromDate} al ${toDate} (API UTC: ${fromIso} - ${toIso})`);
  console.log(`=================================================================================`);

  let page = 1;
  let totalInserted = 0;
  let skippedWithoutPhone = 0;
  let insertedWithoutOrderId = 0;
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
          fromDate: fromIso,
          toDate: toIso,
          page: page,
          limit: 100
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!res.ok) {
        throw new Error(`Mantra report devolvió HTTP ${res.status}.`);
      }
      const json = await res.json();
      if (json?.ok === false || json?.success === false) {
        throw new Error('Mantra report rechazó la consulta.');
      }
      if (!json || typeof json !== 'object' || !Array.isArray(json.data)) {
        throw new Error('Mantra report devolvió una respuesta sin una lista de datos válida.');
      }
      if (json.data.length === 0) {
        console.log(`   Página ${page}: Sin más registros.`);
        break;
      }

      const rows = json.data;
      console.log(`   Página ${page}/${json.totalPages || 1}: Procesando ${rows.length} registros (Total general Mantra: ${json.total})...`);

      for (const item of rows) {
        const fields = item.customFields || item;
        const itemOrdenId = extractOrderId(item, cfg);
        const cleanPhone = extractContactPhone(item);
        if (!cleanPhone) {
          skippedWithoutPhone++;
          continue;
        }
        if (itemOrdenId === null) insertedWithoutOrderId++;
        const name = item.contactName || item.name || null;

        let itemToken = resolveConfiguredCustomValue(item, cfg, ['TOKEN'], 8);
        itemToken = itemToken ? String(itemToken).trim() : null;
        if (itemToken && itemToken.length < 20) itemToken = null;
        if (!itemToken) {
          const trackingLink = resolveConfiguredCustomValue(item, cfg, ['LINK', 'URL'], 9);
          const trackingMatch = String(trackingLink || '').match(/\/seguimiento\/([^/?#]+)/i);
          if (trackingMatch) itemToken = trackingMatch[1];
        }

        const rawPin = resolveConfiguredCustomValue(item, cfg, ['PIN', 'PINTOKEN'], 7);
        const itemPin = rawPin === null ? null : String(rawPin).trim() || null;

        const customFields = extractTemplateFields(item);
        const rawCustomFieldsJson = Object.keys(customFields).length > 0
          ? JSON.stringify(customFields)
          : null;

        await pool.query(`
          INSERT INTO REPORTE_PLANTILLAS_MANTRA (
            contacto_id, nombre, telefono, email,
            agente_asignado, enviado_por,
            codigo_pedido, orden_id, token, pin,
            creado, fecha_envio, estado_mensaje, estado_chat,
            respuesta_boton, fecha_respuesta_boton, vendor_id,
            template_id, grupo_servicio, nombre_plantilla_alias,
            custom_fields_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            telefono = VALUES(telefono),
            email = VALUES(email),
            agente_asignado = VALUES(agente_asignado),
            enviado_por = VALUES(enviado_por),
            codigo_pedido = VALUES(codigo_pedido),
            orden_id = COALESCE(VALUES(orden_id), orden_id),
            token = COALESCE(VALUES(token), token),
            pin = COALESCE(VALUES(pin), pin),
            creado = VALUES(creado),
            fecha_envio = VALUES(fecha_envio),
            estado_mensaje = VALUES(estado_mensaje),
            estado_chat = VALUES(estado_chat),
            respuesta_boton = VALUES(respuesta_boton),
            fecha_respuesta_boton = VALUES(fecha_respuesta_boton),
            vendor_id = VALUES(vendor_id),
            grupo_servicio = VALUES(grupo_servicio),
            nombre_plantilla_alias = VALUES(nombre_plantilla_alias),
            custom_fields_json = COALESCE(VALUES(custom_fields_json), custom_fields_json);
        `, [
          item.contactId || item._id,
          name,
          cleanPhone,
          fields.email || item.email || null,
          item.agentName || null,
          item.sentBy || null,
          resolveCodigoPedido(item, cfg),
          itemOrdenId,
          itemToken,
          itemPin,
          parseSqlTimestamp(item.createdAt),
          parseSqlTimestamp(item.msgSentAt),
          item.msgStatus || null,
          item.chatStatus || null,
          item.qrTxt || null,
          parseSqlTimestamp(item.qrAt),
          item.vendorId || item.contactFlowResponseId || null,
          template_id,
          tipo_servicio,
          nombre_alias,
          rawCustomFieldsJson
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
      throw new Error(`Falló la página ${page} de ${nombre_alias}: ${err.message}`);
    }
  }

  if (skippedWithoutPhone > 0) {
    console.warn(`⚠️ [${nombre_alias}] Se omitieron ${skippedWithoutPhone} registros sin un teléfono válido.`);
  }
  if (insertedWithoutOrderId > 0) {
    console.warn(`⚠️ [${nombre_alias}] ${insertedWithoutOrderId} registros guardados llegaron sin un OrdenId numérico válido.`);
  }
  console.log(`✅ [${nombre_alias}] Finalizado: ${totalInserted} registros sincronizados en MySQL.`);
  return { alias: nombre_alias, totalInserted, skippedWithoutPhone, insertedWithoutOrderId };
}

/**
 * Sincroniza todas las plantillas activas de la tabla dinámica
 */
async function syncAllTemplates(fromDate, toDate) {
  const hoy = getDateInTimeZone(new Date(), 'America/Lima');
  const from = fromDate || hoy;
  const to = toDate || hoy;

  console.log(`=================================================================================`);
  console.log(`🚀 INICIANDO SINCRONIZACIÓN GENERAL DE REPORTES DE TODAS LAS PLANTILLAS`);
  console.log(`📅 Rango de Fechas: ${from} al ${to}`);
  console.log(`=================================================================================`);

  const { configs } = await getControlTables(true);
  const activeConfigs = (configs || []).filter(c => c.activo === 1 && c.api_key && c.template_id);
  if (activeConfigs.length === 0) {
    throw new Error('No hay plantillas activas y configuradas para sincronizar.');
  }

  const results = [];
  const errors = [];
  for (const cfg of activeConfigs) {
    try {
      results.push(await syncTemplateReport(cfg, from, to));
    } catch (err) {
      errors.push(err);
      results.push({ alias: cfg.nombre_alias, error: err.message });
    }
    await sleep(500);
  }

  console.log(`\n=================================================================================`);
  console.log(`🏁 SINCRONIZACIÓN GENERAL FINALIZADA`);
  console.table(results);
  console.log(`=================================================================================`);
  const skippedWithoutPhone = results.reduce(
    (total, result) => total + (result.skippedWithoutPhone || 0),
    0
  );
  if (skippedWithoutPhone > 0) {
    console.warn(`⚠️ Se omitieron ${skippedWithoutPhone} registros sin teléfono válido; revisar el formato devuelto por Mantra.`);
  }
  const insertedWithoutOrderId = results.reduce(
    (total, result) => total + (result.insertedWithoutOrderId || 0),
    0
  );
  if (insertedWithoutOrderId > 0) {
    console.warn(`⚠️ ${insertedWithoutOrderId} registros guardados llegaron sin OrdenId numérico válido; revisar mapeo custom_10 y respuesta de Mantra.`);
  }
  if (errors.length > 0) {
    throw new Error(`Falló la sincronización de ${errors.length} de ${activeConfigs.length} plantillas.`);
  }
  return results;
}

module.exports = {
  syncTemplateReport,
  syncAllTemplates
};

// Si se ejecuta directamente desde la terminal
if (require.main === module) {
  const args = process.argv.slice(2);
  const hoy = getDateInTimeZone(new Date(), 'America/Lima');
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 2);
  const defaultFrom = d.toISOString().slice(0, 10);
  const fromDate = args[0] || defaultFrom;
  const toDate = args[1] || hoy;

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
