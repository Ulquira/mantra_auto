require('dotenv').config();
const { pool, getControlTables } = require('./mantra_service.cjs');

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
  // Aplanar el objeto si viene en la nueva estructura anidada customFields
  const fields = item.customFields || item;

  // 1. Buscar en las columnas configuradas si alguna es TICKET o DOCUMENTO
  for (let i = 1; i <= 20; i++) {
    const colName = `custom_${i}_campo`;
    if (cfg && (cfg[colName] === 'TICKET' || cfg[colName] === 'DOCUMENTO' || cfg[colName] === 'ORDENID' || cfg[colName] === 'ORDEN_ID' || cfg[colName] === 'ORDEN')) {
      const val = fields[`custom_${i}`];
      if (val && typeof val === 'string' && val.trim() !== '' && !val.startsWith('http')) {
        return val.trim();
      }
    }
  }

  // 2. Si custom_10 o custom_6 es ticket / documento y no es link ni plan
  if (fields.custom_10 && !String(fields.custom_10).startsWith('http') && !/^(internet|paquete)/i.test(fields.custom_10)) {
    return String(fields.custom_10).trim();
  }
  if (fields.custom_6 && !String(fields.custom_6).startsWith('http') && !/^(internet|paquete)/i.test(fields.custom_6)) {
    return String(fields.custom_6).trim();
  }

  // 3. Si custom_1 no es plan ni fecha, usar custom_1
  if (fields.custom_1 && !/^(internet|paquete|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(fields.custom_1)) {
    return String(fields.custom_1).trim();
  }

  return fields.custom_1 ? String(fields.custom_1).trim() : (item.contactId || item._id || null);
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
  const { fromIso, toIso } = toPeruUtcIsoBounds(fromDate, toDate);
  console.log(`   Template ID: ${template_id} | Rango Perú: ${fromDate} al ${toDate} (API UTC: ${fromIso} - ${toIso})`);
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
          fromDate: fromIso,
          toDate: toIso,
          page: page,
          limit: 100
        }),
        signal: AbortSignal.timeout(15000)
      });

      const json = await res.json();
      if (!json.data || json.data.length === 0) {
        console.log(`   Página ${page}: Sin más registros.`);
        break;
      }

      const rows = json.data;
      console.log(`   Página ${page}/${json.totalPages || 1}: Procesando ${rows.length} registros (Total general Mantra: ${json.total})...`);

      for (const item of rows) {
        // Soporte híbrido para nueva estructura anidada o antigua plana
        const fields = item.customFields || item;
        const rawPhone = item.contactPhone || item.phone || '';
        const cleanPhone = rawPhone ? String(rawPhone).replace(/\D/g, '').slice(-9) : '';
        const name = item.contactName || item.name || null;

        let itemOrdenId = null;
        for (let i = 1; i <= 20; i++) {
          const colName = `custom_${i}_campo`;
          if (cfg && (cfg[colName] === 'ORDEN' || cfg[colName] === 'ORDENID' || cfg[colName] === 'ORDEN_ID') && fields[`custom_${i}`]) {
            const num = parseInt(String(fields[`custom_${i}`]).trim(), 10);
            if (!isNaN(num) && num > 0) { itemOrdenId = num; break; }
          }
        }
        if (!itemOrdenId && fields.custom_20) {
          const num = parseInt(String(fields.custom_20).trim(), 10);
          if (!isNaN(num) && num > 0) { itemOrdenId = num; }
        }
        if (!itemOrdenId && fields.custom_15) {
          const num = parseInt(String(fields.custom_15).trim(), 10);
          if (!isNaN(num) && num > 0 && !String(fields.custom_15).startsWith('VT') && !String(fields.custom_15).startsWith('GAR')) { 
            itemOrdenId = num; 
          }
        }

        let itemToken = null;
        for (let i = 1; i <= 20; i++) {
          const colName = `custom_${i}_campo`;
          if (cfg && cfg[colName] === 'TOKEN' && fields[`custom_${i}`]) {
            const val = String(fields[`custom_${i}`]).trim();
            if (val.length >= 20) { itemToken = val; break; }
          }
        }
        if (!itemToken && fields.custom_18 && String(fields.custom_18).trim().length >= 20) {
          itemToken = String(fields.custom_18).trim();
        }
        if (!itemToken) {
          const custom9Val = fields.custom_9 ? String(fields.custom_9).trim() : null;
          const custom10Val = fields.custom_10 ? String(fields.custom_10).trim() : null;
          itemToken = (custom9Val && custom9Val.length >= 20) 
            ? custom9Val 
            : (custom10Val && custom10Val.includes('/seguimiento/') ? custom10Val.split('/seguimiento/').pop().trim() : null);
        }

        await pool.query(`
          INSERT INTO REPORTE_PLANTILLAS_MANTRA (
            contacto_id, nombre, telefono, email,
            agente_asignado, enviado_por,
            codigo_pedido, orden_id, token,
            creado, fecha_envio, estado_mensaje, estado_chat,
            respuesta_boton, fecha_respuesta_boton, vendor_id,
            template_id, grupo_servicio, nombre_plantilla_alias
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            telefono = VALUES(telefono),
            email = VALUES(email),
            agente_asignado = VALUES(agente_asignado),
            enviado_por = VALUES(enviado_por),
            codigo_pedido = VALUES(codigo_pedido),
            orden_id = COALESCE(VALUES(orden_id), orden_id),
            token = COALESCE(VALUES(token), token),
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
          item.contactId || item._id,
          name,
          cleanPhone,
          fields.email || item.email || null,
          item.agentName || null,
          item.sentBy || null,
          resolveCodigoPedido(item, cfg),
          itemOrdenId,
          itemToken,
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
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const defaultFrom = d.toISOString().slice(0, 10);
  const hoy = new Date().toISOString().slice(0, 10);
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
