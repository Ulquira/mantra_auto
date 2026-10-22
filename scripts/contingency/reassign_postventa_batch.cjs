require('dotenv').config();
const mysql = require('mysql2/promise');

const URL_CREATE_CONTACT_BY_USER = "https://wbpback2pro2.mantra.chat/contacts/newbyuser";
const GROUP_ID_AVERIAS = "68508b455ba42fd0a6660300";
const API_KEY_AVERIAS = "618684ea-0e61-478f-9b22-bc0fd8b8a934";
const POSTVENTA_EMAIL = process.env.AGENT_EMAIL_POSTVENTA_LIMA || "Backofficepostventa@win.pe";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reassignBatch() {
  console.log(`[START] Iniciando reasignación masiva de Postventa y Garantía/Reiterado Lima a ${POSTVENTA_EMAIL}...`);

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    ssl: { rejectUnauthorized: false }
  });

  // 1. Obtener los candidatos pendientes de asignación
  const [candidates] = await pool.query(`
    SELECT id, orden_id, phone, cliente_nombre, producto, tipo_trabajo, provincia, grupo_servicio
    FROM HISTORIAL_CHATS_MANTRA
    WHERE (tipo_trabajo = 'POSTVENTA' OR (producto IN ('GARANTIA', 'REITERADA', 'REITERADO') AND provincia IN ('LIMA', 'CALLAO')))
      AND (asesor_asignado IS NULL OR asesor_asignado = '')
    ORDER BY id ASC
  `);

  console.log(`[INFO] Candidatos encontrados: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log('[INFO] No hay casos pendientes de reasignación.');
    await pool.end();
    return;
  }

  // Agrupar por teléfono para no repetir llamadas a Mantra
  const phoneMap = new Map();
  for (const c of candidates) {
    if (!phoneMap.has(c.phone)) {
      phoneMap.set(c.phone, {
        name: c.cliente_nombre || 'Cliente',
        rows: []
      });
    }
    phoneMap.get(c.phone).rows.push(c.id);
  }

  console.log(`[INFO] Teléfonos únicos a procesar en Mantra: ${phoneMap.size}`);

  let successCount = 0;
  let failCount = 0;
  let updatedRowsCount = 0;

  const phoneEntries = Array.from(phoneMap.entries());

  for (let i = 0; i < phoneEntries.length; i++) {
    const [phone, info] = phoneEntries[i];
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-9);

    const payload = {
      groupId: GROUP_ID_AVERIAS,
      apiKey: API_KEY_AVERIAS,
      userEmail: POSTVENTA_EMAIL,
      data: {
        name: info.name,
        phone: cleanPhone,
        countryCode: "51"
      }
    };

    let attempts = 0;
    let ok = false;
    let errorMsg = null;

    while (attempts < 2 && !ok) {
      attempts++;
      try {
        const resp = await fetch(URL_CREATE_CONTACT_BY_USER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });

        if (resp.ok) {
          const resJson = await resp.json().catch(() => ({}));
          ok = true;
        } else {
          const txt = await resp.text().catch(() => '');
          errorMsg = `HTTP ${resp.status}: ${txt}`;
        }
      } catch (err) {
        errorMsg = err.message;
        await delay(500);
      }
    }

    if (ok) {
      successCount++;
      // Actualizar en base de datos para todas las filas asociadas a este teléfono
      const rowIds = info.rows;
      await pool.query(`
        UPDATE HISTORIAL_CHATS_MANTRA
        SET asesor_asignado = ?,
            fecha_auditoria = CURRENT_TIMESTAMP
        WHERE id IN (?)
      `, [POSTVENTA_EMAIL, rowIds]);

      updatedRowsCount += rowIds.length;
      if ((i + 1) % 25 === 0 || i + 1 === phoneEntries.length) {
        console.log(`[PROGRESO] ${i + 1}/${phoneEntries.length} contactos procesados exitosamente...`);
      }
    } else {
      failCount++;
      console.error(`[ERROR] Teléfono ${phone} falló reasignación: ${errorMsg}`);
    }

    // Pequeño retardo entre peticiones para proteger el rate limit
    await delay(120);
  }

  console.log(`\n=============================================`);
  console.log(`[RESULTADOS DE REASIGNACIÓN]`);
  console.log(`Total teléfonos únicos: ${phoneEntries.length}`);
  console.log(`Exitosos en Mantra:     ${successCount}`);
  console.log(`Fallidos en Mantra:     ${failCount}`);
  console.log(`Filas actualizadas DB:  ${updatedRowsCount}`);
  console.log(`Asesor asignado:        ${POSTVENTA_EMAIL}`);
  console.log(`=============================================\n`);

  // Verificar estado final en la tabla
  const [remaining] = await pool.query(`
    SELECT COUNT(*) as restantes
    FROM HISTORIAL_CHATS_MANTRA
    WHERE (tipo_trabajo = 'POSTVENTA' OR (producto IN ('GARANTIA', 'REITERADA', 'REITERADO') AND provincia IN ('LIMA', 'CALLAO')))
      AND (asesor_asignado IS NULL OR asesor_asignado = '')
  `);
  console.log(`[VERIFICACIÓN] Casos Postventa pendientes tras ejecución: ${remaining[0].restantes}`);

  await pool.end();
}

reassignBatch().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
