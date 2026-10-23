const { pool } = require('../../mantra_service.cjs');
const {
  extractContactPhone,
  extractOrderId,
  extractTemplateFields,
  extractTicket,
  resolveConfiguredCustomValue
} = require('../mantra_report_helpers.cjs');

const URL_TEMPLATE_REPORT = "https://wbpback2pro2.mantra.chat/report/template/messages/ext";

function parseSqlTimestamp(isoDateString) {
  if (!isoDateString) return null;
  const d = new Date(isoDateString);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const LEGACY_TEMPLATES = [
  {
    template_id: '6ace60478ddbc3f4a1ae625f',
    nombre_alias: 'Instalación - Traking',
    tipo_servicio: 'INSTALACION',
    group_id: '685dc70e53dd0ac2492c69ca',
    api_key: '3d0d59f1-f3ea-47be-b5b0-d7ffca33817d',
    custom_1_campo: 'NOMBRE',
    custom_2_campo: 'FECHA',
    custom_3_campo: 'HORARIO',
    custom_4_campo: 'DIRECCION',
    custom_5_campo: 'TICKET',
    custom_6_campo: 'PLAN',
    custom_7_campo: 'PIN',
    custom_8_campo: 'TOKEN',
    custom_9_campo: 'LINK',
    custom_10_campo: 'LINK'
  },
  {
    template_id: '6ad144fdcec7bdf9280c51e6',
    nombre_alias: 'Provincia - Traking',
    tipo_servicio: 'PROVINCIA',
    group_id: '685dc70e53dd0ac2492c69ca',
    api_key: '3d0d59f1-f3ea-47be-b5b0-d7ffca33817d',
    custom_1_campo: 'NOMBRE',
    custom_2_campo: 'FECHA',
    custom_3_campo: 'HORARIO',
    custom_4_campo: 'DIRECCION',
    custom_5_campo: 'TICKET',
    custom_6_campo: 'PLAN',
    custom_7_campo: 'PIN',
    custom_8_campo: 'TOKEN',
    custom_9_campo: 'LINK',
    custom_10_campo: 'LINK'
  },
  {
    template_id: '6ad28f66cec7bdf9280c5af1',
    nombre_alias: 'Averías - Traking',
    tipo_servicio: 'AVERIAS',
    group_id: '68508b455ba42fd0a6660300',
    api_key: '618684ea-0e61-478f-9b22-bc0fd8b8a934',
    custom_1_campo: 'NOMBRE',
    custom_2_campo: 'FECHA',
    custom_3_campo: 'HORARIO',
    custom_4_campo: 'DIRECCION',
    custom_5_campo: 'TICKET',
    custom_6_campo: 'PLAN',
    custom_7_campo: 'PIN',
    custom_8_campo: 'TOKEN',
    custom_9_campo: 'LINK',
    custom_10_campo: 'LINK'
  },
  {
    template_id: '22cfda18-1a1d-43ab-beab-0c884d780f5d',
    nombre_alias: 'Averías Provincia - Tracking',
    tipo_servicio: 'AVERIAS PRV',
    group_id: '68508b455ba42fd0a6660300',
    api_key: '618684ea-0e61-478f-9b22-bc0fd8b8a934',
    custom_1_campo: 'NOMBRE',
    custom_2_campo: 'FECHA',
    custom_3_campo: 'HORARIO',
    custom_4_campo: 'DIRECCION',
    custom_5_campo: 'TICKET',
    custom_6_campo: 'PLAN',
    custom_7_campo: 'PIN',
    custom_8_campo: 'TOKEN',
    custom_9_campo: 'LINK',
    custom_10_campo: 'LINK'
  }
];

function resolveCodigo(item, cfg) {
  const fields = item.customFields || item;
  const ticket = extractTicket(item, cfg);
  if (ticket && !/^https?:\/\//i.test(ticket)) return ticket;

  const legacyValue = fields.custom_5 || fields.custom_6 || fields.custom_1 || fields.custom_10;
  if (legacyValue) {
    const val = String(legacyValue).trim().replace(/^['"]/, '');
    if (val && !/^https?:\/\//i.test(val) && !/^(internet|paquete|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i.test(val)) {
      return val;
    }
  }
  return item.contactId || item._id || null;
}

(async () => {
  try {
    console.log("=== SINCRONIZACIÓN DE PLANTILLAS LEGACY PARA 2026-10-21 ===");
    const fromIso = '2026-10-21T05:00:00.000Z';
    const toIso = '2026-10-22T04:59:59.000Z';

    for (const cfg of LEGACY_TEMPLATES) {
      console.log(`\nProcesando plantilla: ${cfg.nombre_alias} (${cfg.template_id})...`);
      let page = 1;
      let hasMore = true;
      let totalSynced = 0;

      while (hasMore) {
        const res = await fetch(URL_TEMPLATE_REPORT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.api_key}`,
            'GroupId': cfg.group_id,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateId: cfg.template_id,
            fromDate: fromIso,
            toDate: toIso,
            page: page,
            limit: 100
          })
        });

        if (!res.ok) {
          console.error(`HTTP ${res.status} al consultar ${cfg.nombre_alias}`);
          break;
        }

        const json = await res.json();
        const rows = json.data || [];
        if (rows.length === 0) break;

        for (const item of rows) {
          const fields = item.customFields || item;
          const cleanPhone = extractContactPhone(item);
          if (!cleanPhone) continue;

          let itemToken = resolveConfiguredCustomValue(item, cfg, ['TOKEN'], 8);
          itemToken = itemToken ? String(itemToken).trim() : null;
          if (itemToken && itemToken.length < 20) itemToken = null;
          if (!itemToken) {
            const trackingLink = resolveConfiguredCustomValue(item, cfg, ['LINK', 'URL'], 9);
            const match = String(trackingLink || '').match(/\/seguimiento\/([^/?#]+)/i);
            if (match) itemToken = match[1];
          }

          const rawPin = resolveConfiguredCustomValue(item, cfg, ['PIN'], 7);
          const itemPin = rawPin ? String(rawPin).trim() : null;

          const contactName = item.contactName || item.name || fields.custom_1 || null;
          const codigoPedido = resolveCodigo(item, cfg);

          await pool.query(`
            INSERT INTO REPORTE_PLANTILLAS_MANTRA (
              contacto_id, nombre, telefono, email,
              codigo_pedido, token, pin,
              creado, fecha_envio, estado_mensaje, estado_chat,
              respuesta_boton, fecha_respuesta_boton, vendor_id,
              template_id, grupo_servicio, nombre_plantilla_alias,
              custom_fields_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              nombre = VALUES(nombre),
              telefono = VALUES(telefono),
              codigo_pedido = VALUES(codigo_pedido),
              token = COALESCE(VALUES(token), token),
              pin = COALESCE(VALUES(pin), pin),
              fecha_envio = VALUES(fecha_envio),
              estado_mensaje = VALUES(estado_mensaje),
              estado_chat = VALUES(estado_chat),
              respuesta_boton = VALUES(respuesta_boton),
              fecha_respuesta_boton = VALUES(fecha_respuesta_boton),
              vendor_id = VALUES(vendor_id),
              custom_fields_json = COALESCE(VALUES(custom_fields_json), custom_fields_json)
          `, [
            item.contactId || item._id,
            contactName,
            cleanPhone,
            fields.email || item.email || null,
            codigoPedido,
            itemToken,
            itemPin,
            parseSqlTimestamp(item.createdAt),
            parseSqlTimestamp(item.msgSentAt),
            item.msgStatus || null,
            item.chatStatus || null,
            item.qrTxt || null,
            parseSqlTimestamp(item.qrAt),
            item.vendorId || null,
            cfg.template_id,
            cfg.tipo_servicio,
            cfg.nombre_alias,
            JSON.stringify(fields)
          ]);
          totalSynced++;
        }

        if (page >= (json.totalPages || 1)) break;
        page++;
      }
      console.log(`✔ ${cfg.nombre_alias}: ${totalSynced} registros sincronizados con nombre y código.`);
    }

    // Cruce final con vw_winordetraba
    console.log("\n=== EJECUTANDO CRUCE CON VW_WINORDETRABA ===");
    const [resToken] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN vw_winordetraba w ON r.token IS NOT NULL AND r.token != '' AND r.token = w.token
      SET 
        r.orden_id = COALESCE(r.orden_id, w.OrdenId),
        r.nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), w.ClienteFinal)
      WHERE (r.orden_id IS NULL OR r.nombre IS NULL OR TRIM(r.nombre) = '')
    `);
    console.log(`✔ Actualizados por token: ${resToken.affectedRows}`);

    const [resCod] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN (
        SELECT CodiSegui, MAX(OrdenId) as OrdenId, MAX(ClienteFinal) as ClienteFinal
        FROM vw_winordetraba
        WHERE CodiSegui IS NOT NULL AND CodiSegui != ''
        GROUP BY CodiSegui
      ) w ON r.codigo_pedido = w.CodiSegui
      SET 
        r.orden_id = COALESCE(r.orden_id, w.OrdenId),
        r.nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), w.ClienteFinal)
      WHERE (r.orden_id IS NULL OR r.nombre IS NULL OR TRIM(r.nombre) = '')
        AND r.codigo_pedido REGEXP '^[0-9]+$'
    `);
    console.log(`✔ Actualizados por CodiSegui: ${resCod.affectedRows}`);

    process.exit(0);
  } catch (e) {
    console.error("❌ Error:", e.message);
    process.exit(1);
  }
})();
