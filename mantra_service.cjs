const mysql = require('mysql2/promise');
require('dotenv').config();

// Mapeo dinámico de Credenciales y Plantillas según el Tipo de Servicio
const MANTRA_CONFIG = {
  Instalacion: {
    GROUP_ID: "685dc70e53dd0ac2492c69ca",
    API_KEY: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    TEMPLATE_ID_DEFAULT: "6875723e1cb8562af849400e",
    TEMPLATE_ID_OESTE2: "6a7a457736ef53a657fc03ed",
    TEMPLATE_REPROG_ID: "6a9847e14f6db1b188cd5ce3",
    TAG_TRAKING_ID: "4c888a1a-b530-40e4-abdf-9bb941eb768f",
    TAG_BOT_ENVIO_ID: "ae456b1a-c815-4880-86df-d6b4ab2703c4"
  },
  Averias: {
    GROUP_ID: "68508b455ba42fd0a6660300",
    API_KEY: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    TEMPLATE_ID_DEFAULT: "68fac2ea40478663c8b51c36",
    TEMPLATE_ID_OESTE2: "6a90c047e91ab8e19836a561",
    TEMPLATE_REPROG_ID: "6a984a1d5781ebbf9f145a6b",
    TAG_TRAKING_ID: "638b55de-0565-4a1f-b9eb-a914f450a7fc",
    TAG_BOT_ENVIO_ID: "25371b8b-3844-4243-8ee2-1796fc058029"
  }
};

const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send";

function extractPlanName(idenServi) {
  if (!idenServi) return "tu plan Win";
  const match = idenServi.match(/Paquete\s*:\s*([^|]+)/i);
  if (match && match[1]) {
    const plan = match[1].trim();
    if (plan) return plan;
  }
  return idenServi.split('|')[0].trim() || "tu plan Win";
}

function extractFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') return "Cliente";
  const clean = fullName.trim().replace(/\s+/g, ' ');
  if (!clean) return "Cliente";
  
  // Si viene en formato "APELLIDOS, NOMBRES"
  if (clean.includes(',')) {
    const parts = clean.split(',');
    const nombres = (parts[1] || '').trim();
    if (nombres) {
      return nombres.split(' ')[0];
    }
  }
  
  // Formato normal: "RODRIGO LUIS SANIZ BAZAN" -> "RODRIGO"
  return clean.split(' ')[0];
}

function formatDateSpanish(rawDate) {
  if (!rawDate) return "fecha por confirmar";
  const dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) return String(rawDate);
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${dateObj.getUTCDate()} de ${meses[dateObj.getUTCMonth()]}`;
}

function buildHomologatedCustomData(orden, overrides = {}) {
  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const fullName = orden.ClienteFinal || '';
  const firstName = extractFirstName(fullName);

  const ticket = orden.CodiSegui ? String(orden.CodiSegui).trim() : String(orden.OrdenId || '');
  const fecha = overrides.fechaFormateada || formatDateSpanish(orden.f_date || orden['F.Soli']);
  
  let rangoHorario = overrides.rangoHorario;
  if (!rangoHorario) {
    const t = orden.f_time || (orden['F.Soli'] ? String(orden['F.Soli']).slice(11, 19) : '');
    if (t && t.startsWith('08')) rangoHorario = "8AM - 12PM";
    else if (t && t.startsWith('12')) rangoHorario = "12PM - 4PM";
    else if (t && t.startsWith('16')) rangoHorario = "4PM - 8PM";
    else rangoHorario = t || "horario por confirmar";
  }

  const direccion = orden.Direccion ? orden.Direccion.split('||')[0].trim() : "";
  const trackingLink = orden.token ? `https://go.win.pe/seguimiento/${orden.token}` : (orden.link || '');
  const plan = extractPlanName(orden.IdenServi) || orden.Producto || "tu plan Win";
  
  // custom_8: FechaVenta (FechaUltiEsta o f_visita)
  const fechaVentaRaw = orden.FechaUltiEsta || orden.f_visita || orden.FechaIniVisi;
  const fechaVenta = fechaVentaRaw ? formatDateSpanish(fechaVentaRaw) : fecha;

  // custom_9: Departamento / Provincia / Distrito
  const depProvDist = [orden.Region, orden.Provincia, orden.Zona || orden.Localidad].filter(Boolean).join(' / ') || (orden.Localidad || 'LIMA');

  // custom_10: Canal de venta / Empresa
  const canalVenta = orden.Empresa || orden['Sector Operativo'] || 'WIN';

  const data = {
    name: firstName,
    phone: phone,
    countryCode: "51",
    custom_1: ticket,
    custom_2: fecha,
    custom_3: rangoHorario,
    custom_4: direccion,
    custom_5: trackingLink,
    custom_6: plan,
    custom_7: firstName,
    custom_8: fechaVenta,
    custom_9: depProvDist,
    custom_10: canalVenta
  };

  // Manejo de etiquetas: siempre agregar BotEnvio + TRAKING si corresponde
  const tagList = [];
  if (overrides.tagIds && Array.isArray(overrides.tagIds)) {
    tagList.push(...overrides.tagIds);
  } else if (overrides.tagId) {
    tagList.push(overrides.tagId);
  }
  if (overrides.botEnvioTagId && !tagList.includes(overrides.botEnvioTagId)) {
    tagList.push(overrides.botEnvioTagId);
  }

  if (tagList.length > 0) {
    data.tagIds = tagList;
  }

  return { firstName, fullName, phone, data };
}

// Configuración de Connection Pool optimizada (Límite bajo, timeouts agresivos y reciclaje)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 3,           // Máximo 3 conexiones simultáneas por instancia
  maxIdle: 2,                    // Máximo 2 conexiones inactivas en espera
  idleTimeout: 30000,            // Liberar conexiones inactivas tras 30 segundos
  connectTimeout: 10000,         // Timeout de conexión 10s
  queueLimit: 100,               // Límite de solicitudes en cola
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

const MAIN_TABLE = process.env.DB_TABLE || 'vw_winordetraba';

async function getDbConnection() {
  return pool;
}

async function ensureLogTableExists(dbOrPool) {
  const executor = dbOrPool || pool;
  await executor.query(`
    CREATE TABLE IF NOT EXISTS LOG_NOTIFICACIONES_WSP (
      id INT AUTO_INCREMENT PRIMARY KEY,
      OrdenId INT NOT NULL,
      CodiSegui VARCHAR(100) NULL,
      EstadoNotificado VARCHAR(50) NOT NULL,
      fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      EnviadoExitosamente BOOLEAN DEFAULT TRUE,
      DetallesError TEXT
    )
  `);
}

async function sendMantraNotification(orden) {
  // Cruce de datos basado en TipoServicioBD: SOLO PERMITIR 'AVERIAS'
  const categoria = (orden.CategoriaServicioMantra || '').toUpperCase();

  if (categoria !== 'AVERIAS') {
    console.log(`[SKIP] El producto no es de tipo AVERIAS (Tipo actual: '${categoria || 'Sin mapear'}').`);
    return { success: true, skipped: true, errorDetail: `Notificación omitida: Producto no es AVERIAS (Tipo: '${categoria || 'Sin mapear'}').` };
  }

  // Verificación estricta de deduplicación antes de emitir a la API de Mantra
  const [existing] = await pool.query(`
    SELECT id FROM LOG_NOTIFICACIONES_WSP
    WHERE (OrdenId = ? OR (CodiSegui = ? AND CodiSegui IS NOT NULL AND CodiSegui <> ''))
      AND DATE(fecha_envio) = CURDATE()
      AND EnviadoExitosamente = 1
    LIMIT 1
  `, [orden.OrdenId, orden.CodiSegui || '']);

  if (existing.length > 0) {
    console.log(`[DEDUP SKIP] La orden ${orden.OrdenId} (Ticket: ${orden.CodiSegui || 'N/A'}) ya fue notificada exitosamente hoy. Omitiendo.`);
    return { success: true, skipped: true, errorDetail: 'Omitido: Ya fue notificado hoy.' };
  }

  const tipoServicio = 'Averias';
  const credentials = MANTRA_CONFIG[tipoServicio];
  const sectorOperativo = (orden['Sector Operativo'] || '').toUpperCase();
  const isOeste2 = sectorOperativo.includes('OESTE 2') || sectorOperativo.includes('OESTE -2') || sectorOperativo.includes('OESTE-2');
  const templateIdToUse = isOeste2 ? credentials.TEMPLATE_ID_OESTE2 : credentials.TEMPLATE_ID_DEFAULT;
  const tagIdToUse = isOeste2 ? credentials.TAG_TRAKING_ID : null;

  const { firstName, fullName, phone, data: customData } = buildHomologatedCustomData(orden, {
    tagId: tagIdToUse,
    botEnvioTagId: credentials.TAG_BOT_ENVIO_ID
  });

  console.log(`\n=================================================`);
  console.log(`Procesando Orden: ${orden.OrdenId} - ${firstName} (${phone}) [Nombre completo: ${fullName}]`);
  console.log(`[Lógica Servicio] Tipo Resuelto: ${tipoServicio} | Sector: ${sectorOperativo || 'N/A'} | Template: ${templateIdToUse} | Etiquetas: BotEnvio (${credentials.TAG_BOT_ENVIO_ID})${isOeste2 ? ' + TRAKING (' + tagIdToUse + ')' : ''}`);
  console.log(`=================================================`);

  const contactPayload = {
    groupId: credentials.GROUP_ID,
    apiKey: credentials.API_KEY,
    data: customData
  };

  try {
    console.log("1. Enviando petición para crear/actualizar contacto con variables homologadas y etiquetas...");
    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload)
    });
    
    const jsonContact = await resContact.json();
    console.log("   Respuesta Servidor (Contacto):", jsonContact.resultOp || jsonContact);

    const templatePayload = {
      groupId: credentials.GROUP_ID,
      apiKey: credentials.API_KEY,
      templateId: templateIdToUse,
      phone: phone,
      countryCode: "51" 
    };

    console.log("\n2. Enviando petición para disparar plantilla...");
    const resTemplate = await fetch(URL_SEND_TEMPLATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templatePayload)
    });
    
    const jsonTemplate = await resTemplate.json();
    console.log("   Respuesta Servidor (Plantilla):", jsonTemplate);

    if (jsonTemplate.ok !== true) {
      console.error("   [ERROR] La plantilla no se pudo enviar. Respuesta de Mantra:", jsonTemplate);
      return { success: false, errorDetail: JSON.stringify(jsonTemplate) };
    }

    return { success: true, errorDetail: null }; 
  } catch (err) {
    console.error("   [ERROR CRÍTICO] Fallo en la red o API de Mantra:", err.message);
    return { success: false, errorDetail: err.message };
  }
}

async function sendReprogramacionNotification(reprog, orden) {
  // Evaluamos tipo de servicio basado en tabla TipoServicio: SOLO PERMITIR 'AVERIAS'
  const categoria = (orden.CategoriaServicioMantra || '').toUpperCase();

  if (categoria !== 'AVERIAS') {
    console.log(`[SKIP] La reprogramación no es de tipo AVERIAS (Tipo actual: '${categoria || 'Sin mapear'}').`);
    return { success: true, skipped: true, errorDetail: `Reprogramación omitida: Producto no es AVERIAS (Tipo: '${categoria || 'Sin mapear'}').` };
  }

  // Verificación de deduplicación para reprogramaciones
  const [existingReprog] = await pool.query(`
    SELECT id FROM LOG_NOTIFICACIONES_WSP
    WHERE OrdenId = ?
      AND EstadoNotificado = 'Reprogramacion'
      AND EnviadoExitosamente = 1
    LIMIT 1
  `, [reprog.id]);

  if (existingReprog.length > 0) {
    console.log(`[DEDUP SKIP] La reprogramación ID ${reprog.id} ya fue notificada previamente. Omitiendo.`);
    return { success: true, skipped: true, errorDetail: 'Omitido: Reprogramación ya fue notificada previamente.' };
  }

  const tipoServicio = 'Averias';
  const credentials = MANTRA_CONFIG[tipoServicio];
  
  if (!credentials.TEMPLATE_REPROG_ID) {
    console.log(`[SKIP] No hay plantilla de reprogramación configurada para el tipo ${tipoServicio}.`);
    return { success: true, skipped: true, errorDetail: 'Plantilla de reprogramación no configurada.' };
  }

  const sectorOperativo = (orden['Sector Operativo'] || '').toUpperCase();
  const isOeste2 = sectorOperativo.includes('OESTE 2') || sectorOperativo.includes('OESTE -2') || sectorOperativo.includes('OESTE-2');
  const tagIdToUse = isOeste2 ? credentials.TAG_TRAKING_ID : null;

  const fechaReprog = formatDateSpanish(reprog.fecha_solicitada);
  const rangoHorario = reprog.turno || "horario por confirmar";

  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const fullName = orden.ClienteFinal || '';
  const firstName = extractFirstName(fullName);

  const ticket = orden.CodiSegui ? String(orden.CodiSegui).trim() : String(orden.OrdenId || '');
  const direccion = orden.Direccion ? orden.Direccion.split('||')[0].trim() : "";
  const trackingLink = orden.token ? `https://go.win.pe/seguimiento/${orden.token}` : (orden.link || '');
  const plan = extractPlanName(orden.IdenServi) || orden.Producto || "tu plan Win";
  const fechaVentaRaw = orden.FechaUltiEsta || orden.f_visita || orden.FechaIniVisi;
  const fechaVenta = fechaVentaRaw ? formatDateSpanish(fechaVentaRaw) : fechaReprog;
  const depProvDist = [orden.Region, orden.Provincia, orden.Zona || orden.Localidad].filter(Boolean).join(' / ') || (orden.Localidad || 'LIMA');
  const canalVenta = orden.Empresa || orden['Sector Operativo'] || 'WIN';

  // Mapeo exacto para la plantilla de Reprogramación:
  // "Tu visita técnica está programada para el {{custom_1}} (Fecha). Nuestro equipo técnico estará en tu dirección entre las {{custom_2}} (Horario)."
  const customData = {
    name: firstName,
    phone: phone,
    countryCode: "51",
    custom_1: fechaReprog,       // Fecha de la nueva cita
    custom_2: rangoHorario,      // Rango horario/turno
    custom_3: ticket,            // Ticket / Pedido
    custom_4: direccion,         // Dirección
    custom_5: trackingLink,      // Link seguimiento
    custom_6: plan,              // Plan
    custom_7: firstName,         // Nombre
    custom_8: fechaVenta,        // Fecha Venta
    custom_9: depProvDist,       // Ubicación
    custom_10: trackingLink      // Link seguimiento
  };

  const tagList = [credentials.TAG_BOT_ENVIO_ID];
  if (tagIdToUse) {
    tagList.push(tagIdToUse);
  }
  customData.tagIds = tagList;

  console.log(`\n=================================================`);
  console.log(`Procesando Reprogramación ID: ${reprog.id} | Orden: ${orden.OrdenId} - ${firstName} (${phone}) [Nombre completo: ${fullName}]`);
  console.log(`[Lógica Servicio] Tipo Resuelto: ${tipoServicio} | Template Asignado: ${credentials.TEMPLATE_REPROG_ID} | Etiquetas: BotEnvio (${credentials.TAG_BOT_ENVIO_ID})${isOeste2 ? ' + TRAKING' : ''}`);
  console.log(`=================================================`);

  const contactPayload = {
    groupId: credentials.GROUP_ID,
    apiKey: credentials.API_KEY,
    data: customData
  };

  try {
    console.log("1. Enviando petición para crear/actualizar contacto (Reprogramación)...");
    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload)
    });
    
    const jsonContact = await resContact.json();
    console.log("   Respuesta Servidor (Contacto):", jsonContact.resultOp || jsonContact);

    const templatePayload = {
      groupId: credentials.GROUP_ID,
      apiKey: credentials.API_KEY,
      templateId: credentials.TEMPLATE_REPROG_ID,
      phone: phone,
      countryCode: "51" 
    };

    console.log("\n2. Enviando petición para disparar plantilla de reprogramación...");
    const resTemplate = await fetch(URL_SEND_TEMPLATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templatePayload)
    });
    
    const jsonTemplate = await resTemplate.json();
    console.log("   Respuesta Servidor (Plantilla):", jsonTemplate);

    if (jsonTemplate.ok !== true) {
      console.error("   [ERROR] La plantilla no se pudo enviar. Respuesta de Mantra:", jsonTemplate);
      return { success: false, errorDetail: JSON.stringify(jsonTemplate) };
    }

    return { success: true, errorDetail: null }; 
  } catch (err) {
    console.error("   [ERROR CRÍTICO] Fallo en la red o API de Mantra:", err.message);
    return { success: false, errorDetail: err.message };
  }
}

async function processOrderById(ordenId) {
  try {
    await ensureLogTableExists(pool);

    const [rows] = await pool.query(`
      SELECT t.*, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM ${MAIN_TABLE} t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE t.OrdenId = ? 
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND l.id IS NULL
    `, [ordenId]);

    if (rows.length === 0) {
      return {
        success: false,
        message: `La orden ${ordenId} no es elegible o ya fue notificada hoy.`
      };
    }

    const row = rows[0];
    const result = await sendMantraNotification(row);

    if (!result.skipped) {
      await pool.query(
        'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
        [row.OrdenId, row.CodiSegui || null, row.Estado, result.success, result.errorDetail]
      );
    }

    return {
      success: result.success,
      ordenId: row.OrdenId,
      estado: row.Estado,
      skipped: !!result.skipped,
      errorDetail: result.errorDetail
    };
  } catch (err) {
    console.error(`❌ Error en processOrderById(${ordenId}):`, err.message);
    return { success: false, errorDetail: err.message };
  }
}

let isQueueCronRunning = false;

async function runQueueCron() {
  if (isQueueCronRunning) {
    console.log('[QUEUE] Ejecución anterior aún en curso. Omitiendo ciclo...');
    return;
  }
  isQueueCronRunning = true;

  try {
    // 1. Validar la hora actual en zona horaria America/Lima
    const options = { timeZone: 'America/Lima', hour12: false, hour: 'numeric' };
    const formatter = new Intl.DateTimeFormat([], options);
    const horaActual = parseInt(formatter.format(new Date()), 10);

    // 2. Determinar el tramo objetivo basado en la hora actual
    let tramoFiltro = null;
    if (horaActual >= 7 && horaActual <= 9) tramoFiltro = '08';
    else if (horaActual >= 11 && horaActual <= 13) tramoFiltro = '12';
    else if (horaActual >= 15 && horaActual <= 17) tramoFiltro = '16';

    if (!tramoFiltro) {
      return;
    }

    // 2.1 Limpieza automática de la cola: descartar IDs cuyas fechas no sean HOY, no sean 'AVERIAS' o ya fueron notificados HOY
    await pool.query(`
      DELETE c FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN ${MAIN_TABLE} t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE DATE(t.\`F.Soli\`) <> CURDATE() 
         OR ts.Tipo <> 'AVERIAS' 
         OR ts.Tipo IS NULL
         OR l.id IS NOT NULL
    `);

    // 3. Extraer de la tabla principal SOLO los IDs que estén en la cola, sean de HOY, correspondan al tramo, sean 'AVERIAS' y no tengan envío HOY
    // IMPORTANTE: GROUP BY t.OrdenId para evitar duplicados si un mismo OrdenId ingresó más de una vez a la cola
    const queryStr = `
      SELECT t.*, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time, MIN(c.id) as colaId, ts.Tipo as CategoriaServicioMantra
      FROM COLA_NOTIFICACIONES_MANTRA c
      INNER JOIN ${MAIN_TABLE} t ON c.ordenId = t.OrdenId
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(t.\`F.Soli\`) = CURDATE() 
        AND TIME(t.\`F.Soli\`) LIKE ? 
        AND l.id IS NULL
      GROUP BY t.OrdenId
      ORDER BY colaId ASC LIMIT 50
    `;
    const searchPattern = `${tramoFiltro}%`;

    const [rows] = await pool.query(queryStr, [searchPattern]);
    
    if (rows.length === 0) {
      return;
    }

    console.log(`[QUEUE] Evaluando Tramo Horario [${tramoFiltro}:00]. Procesando ${rows.length} órdenes únicas en cola desde ${MAIN_TABLE}.`);

    for (const row of rows) {
      const result = await sendMantraNotification(row);
      
      if (!result.skipped) {
        await pool.query(
          'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
          [row.OrdenId, row.CodiSegui || null, row.Estado, result.success, result.errorDetail]
        );
      }

      // Eliminamos todas las instancias de esta orden en la cola
      await pool.query('DELETE FROM COLA_NOTIFICACIONES_MANTRA WHERE ordenId = ?', [row.OrdenId]);
      console.log(`[QUEUE] Orden ${row.OrdenId} procesada y eliminada de la cola.`);
    }
  } catch (err) {
    console.error("❌ Error en QueueCron:", err.message);
  } finally {
    isQueueCronRunning = false;
  }
}

module.exports = {
  pool,
  MAIN_TABLE,
  MANTRA_CONFIG,
  getDbConnection,
  ensureLogTableExists,
  sendMantraNotification,
  sendReprogramacionNotification,
  processOrderById,
  runQueueCron
};
