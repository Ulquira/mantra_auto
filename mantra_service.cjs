const mysql = require('mysql2/promise');
require('dotenv').config();

// Caché en memoria para reglas de tablas de control (TTL: 2 minutos)
let cacheConfig = null;
let cacheSectores = null;
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 2 * 60 * 1000;

async function getControlTables(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cacheConfig && cacheSectores && (now - lastCacheUpdate < CACHE_TTL_MS)) {
    return { configs: cacheConfig, sectores: cacheSectores };
  }

  try {
    const [configs] = await pool.query('SELECT * FROM CONFIG_PLANTILLAS_MANTRA');
    const [sectores] = await pool.query('SELECT * FROM SECTORES_PILOTO_TRACKING WHERE activo = 1');
    
    cacheConfig = configs;
    cacheSectores = sectores;
    lastCacheUpdate = now;
    return { configs: cacheConfig, sectores: cacheSectores };
  } catch (err) {
    console.error('❌ Error cargando tablas de control desde MySQL:', err.message);
    if (cacheConfig && cacheSectores) {
      return { configs: cacheConfig, sectores: cacheSectores };
    }
    throw err;
  }
}

function resolveServiceType(orden) {
  const categoria = (orden.CategoriaServicioMantra || '').toUpperCase();
  if (categoria === 'AVERIAS' || categoria === 'POSTVENTA') return 'AVERIAS';
  if (categoria === 'INSTALACION' || categoria === 'PROVINCIA') return 'INSTALACION';
  
  const tipoOrden = (orden.TipoOrden || '').toUpperCase();
  const producto = (orden.Producto || '').toUpperCase();
  if (tipoOrden.includes('AVERIA') || tipoOrden.includes('VISITA') || producto.includes('AVERIA')) {
    return 'AVERIAS';
  }
  return 'INSTALACION';
}

function isSectorPiloto(tipoServicio, sectorOperativo, sectoresList) {
  if (!sectorOperativo) return false;
  const sectorClean = String(sectorOperativo).toUpperCase().trim();
  
  return sectoresList.some(s => {
    if (s.tipo_servicio !== tipoServicio || s.activo !== 1) return false;
    const target = String(s.sector_operativo).toUpperCase().trim();
    return sectorClean === target || sectorClean.includes(target) || target.includes(sectorClean);
  });
}

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
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  
  const diaSemana = dias[dateObj.getUTCDay()];
  const diaMes = dateObj.getUTCDate();
  const mes = meses[dateObj.getUTCMonth()];
  const anio = dateObj.getUTCFullYear();
  
  return `${diaSemana} ${diaMes} de ${mes} ${anio}`;
}

function formatTitleCase(str) {
  if (!str || typeof str !== 'string') return "";
  const minorWords = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'a', 'o', 'u', 'e', 'con', 'por', 'sin', 'para', 'al']);
  
  return str.toLowerCase().replace(/[a-záéíóúñ0-9]+/gi, (word, offset, fullText) => {
    const isAfterParen = offset > 0 && fullText[offset - 1] === '(';
    if (offset > 0 && !isAfterParen && minorWords.has(word.toLowerCase())) {
      return word.toLowerCase();
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function formatRangoHorario(rawTime) {
  if (!rawTime) return "08:00-12:00";
  const t = String(rawTime).trim();
  if (t.includes('08:') || t.includes('08:00') || t.includes('8AM')) return "08:00-12:00";
  if (t.includes('12:') || t.includes('12:00') || t.includes('12PM') || t.includes('12pm')) return "12:00-16:00";
  if (t.includes('16:') || t.includes('16:00') || t.includes('4PM') || t.includes('4pm')) return "16:00-20:00";
  return t;
}

function buildDynamicCustomData(orden, cfg, overrides = {}) {
  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const fullName = orden.ClienteFinal || '';
  const firstName = extractFirstName(fullName);

  const ticket = orden.CodiSegui ? String(orden.CodiSegui).trim() : String(orden.OrdenId || '');
  const fecha = overrides.fechaFormateada || formatDateSpanish(orden.f_date || orden['F.Soli']);
  
  let rangoHorario = overrides.rangoHorario;
  if (!rangoHorario) {
    const t = orden.f_time || (orden['F.Soli'] ? String(orden['F.Soli']).slice(11, 19) : '');
    rangoHorario = formatRangoHorario(t);
  } else {
    rangoHorario = formatRangoHorario(rangoHorario);
  }

  const rawDireccion = orden.Direccion ? orden.Direccion.split('||')[0].trim() : "";
  const direccion = formatTitleCase(rawDireccion);
  const trackingLink = orden.token ? `https://go.win.pe/seguimiento/${orden.token}` : (orden.link || '');
  const plan = extractPlanName(orden.IdenServi) || orden.Producto || "tu plan Win";
  
  const fechaVentaRaw = orden.FechaUltiEsta || orden.f_visita || orden.FechaIniVisi;
  const fechaVenta = fechaVentaRaw ? formatDateSpanish(fechaVentaRaw) : fecha;
  const depProvDist = [orden.Region, orden.Provincia, orden.Zona || orden.Localidad].filter(Boolean).join(' / ') || (orden.Localidad || 'LIMA');
  const canalVenta = orden.Empresa || orden['Sector Operativo'] || 'WIN';

  const valueMap = {
    'TICKET': ticket,
    'FECHA': fecha,
    'HORARIO': rangoHorario,
    'DIRECCION': direccion,
    'LINK': trackingLink,
    'PLAN': plan,
    'NOMBRE': firstName,
    'FECHA_VENTA': fechaVenta,
    'UBICACION': depProvDist,
    'CANAL': canalVenta
  };

  function resolveVal(key, fallback = null) {
    if (!key) return fallback;
    const upper = String(key).toUpperCase().trim();
    return valueMap[upper] !== undefined ? valueMap[upper] : fallback;
  }

  const data = {
    name: firstName,
    phone: phone,
    countryCode: "51",
    custom_1: resolveVal(cfg.custom_1_campo, ticket),
    custom_2: resolveVal(cfg.custom_2_campo, fecha),
    custom_3: resolveVal(cfg.custom_3_campo, rangoHorario),
    custom_4: resolveVal(cfg.custom_4_campo, direccion),
    custom_5: resolveVal(cfg.custom_5_campo, trackingLink),
    custom_6: resolveVal(cfg.custom_6_campo, plan),
    custom_7: resolveVal(cfg.custom_7_campo, firstName),
    custom_10: resolveVal(cfg.custom_10_campo, trackingLink)
  };

  // Manejo de etiquetas: siempre agregar BotEnvio + TRAKING si corresponde
  const tagList = [];
  if (cfg.tag_tracking_id) tagList.push(cfg.tag_tracking_id);
  if (cfg.tag_bot_envio_id && !tagList.includes(cfg.tag_bot_envio_id)) {
    tagList.push(cfg.tag_bot_envio_id);
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
  const { configs, sectores } = await getControlTables();
  const tipoServicio = resolveServiceType(orden);
  const sectorOperativo = (orden['Sector Operativo'] || '').toUpperCase();

  // 1. Determinar si va a la plantilla TRACKING o DEFAULT según SECTORES_PILOTO_TRACKING
  const enPiloto = isSectorPiloto(tipoServicio, sectorOperativo, sectores);
  const tipoPlantilla = enPiloto ? 'TRACKING' : 'DEFAULT';

  // 2. Buscar configuración en CONFIG_PLANTILLAS_MANTRA
  const cfg = configs.find(c => c.tipo_servicio === tipoServicio && c.tipo_plantilla === tipoPlantilla);

  if (!cfg || cfg.activo !== 1) {
    console.log(`[SKIP] Configuración desactivada o inexistente para ${tipoServicio} (${tipoPlantilla}). Activo: ${cfg ? cfg.activo : 0}`);
    return { success: true, skipped: true, errorDetail: `Servicio ${tipoServicio} (${tipoPlantilla}) desactivado en CONFIG_PLANTILLAS_MANTRA.` };
  }

  // 3. Verificación estricta de deduplicación antes de emitir a la API de Mantra
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

  const { firstName, fullName, phone, data: customData } = buildDynamicCustomData(orden, cfg);

  console.log(`\n=================================================`);
  console.log(`Procesando Orden: ${orden.OrdenId} - ${firstName} (${phone}) [Nombre completo: ${fullName}]`);
  console.log(`[Control Dinámico] Servicio: ${tipoServicio} | Sector: ${sectorOperativo || 'N/A'} | Plantilla: ${cfg.nombre_alias} (${cfg.template_id}) | Piloto: ${enPiloto ? 'SI' : 'NO'}`);
  console.log(`=================================================`);

  const contactPayload = {
    groupId: cfg.group_id,
    apiKey: cfg.api_key,
    data: customData
  };

  try {
    console.log("1. Enviando petición para crear/actualizar contacto con variables dinámicas...");
    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload)
    });
    
    const jsonContact = await resContact.json();
    console.log("   Respuesta Servidor (Contacto):", jsonContact.resultOp || jsonContact);

    const templatePayload = {
      groupId: cfg.group_id,
      apiKey: cfg.api_key,
      templateId: cfg.template_id,
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
  const { configs } = await getControlTables();
  const tipoServicio = resolveServiceType(orden);

  // Buscar configuración de REPROGRAMACION en CONFIG_PLANTILLAS_MANTRA
  const cfg = configs.find(c => c.tipo_servicio === tipoServicio && c.tipo_plantilla === 'REPROGRAMACION');

  if (!cfg || cfg.activo !== 1) {
    console.log(`[SKIP] Reprogramación desactivada para ${tipoServicio}. Activo: ${cfg ? cfg.activo : 0}`);
    return { success: true, skipped: true, errorDetail: `Reprogramaciones de ${tipoServicio} desactivadas en CONFIG_PLANTILLAS_MANTRA.` };
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

  const fechaReprog = formatDateSpanish(reprog.fecha_solicitada);
  const rangoHorario = formatRangoHorario(reprog.turno || "08:00-12:00");

  const { firstName, fullName, phone, data: customData } = buildDynamicCustomData(orden, cfg, {
    fechaFormateada: fechaReprog,
    rangoHorario: rangoHorario
  });

  console.log(`\n=================================================`);
  console.log(`Procesando Reprogramación ID: ${reprog.id} | Orden: ${orden.OrdenId} - ${firstName} (${phone}) [Nombre completo: ${fullName}]`);
  console.log(`[Control Dinámico] Servicio: ${tipoServicio} | Plantilla: ${cfg.nombre_alias} (${cfg.template_id})`);
  console.log(`=================================================`);

  const contactPayload = {
    groupId: cfg.group_id,
    apiKey: cfg.api_key,
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
      groupId: cfg.group_id,
      apiKey: cfg.api_key,
      templateId: cfg.template_id,
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
    const { configs } = await getControlTables();
    
    // Obtener los servicios que están activos en CONFIG_PLANTILLAS_MANTRA
    const activeServices = [...new Set(configs.filter(c => c.activo === 1).map(c => c.tipo_servicio))];
    
    if (activeServices.length === 0) {
      console.log('[QUEUE] Todos los servicios están en activo = 0 en CONFIG_PLANTILLAS_MANTRA. Omitiendo.');
      return;
    }

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

    // 2.1 Limpieza automática de la cola: descartar IDs cuyas fechas no sean HOY, servicios inactivos o ya notificados HOY
    const placeholders = activeServices.map(() => '?').join(',');
    await pool.query(`
      DELETE c FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN ${MAIN_TABLE} t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
        OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE DATE(t.\`F.Soli\`) <> CURDATE() 
         OR ts.Tipo NOT IN (${placeholders})
         OR ts.Tipo IS NULL
         OR l.id IS NOT NULL
    `, activeServices);

    // 3. Extraer de la tabla principal SOLO los IDs que estén en la cola, sean de HOY, correspondan al tramo y pertenezcan a servicios activos
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
      WHERE ts.Tipo IN (${placeholders})
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(t.\`F.Soli\`) = CURDATE() 
        AND TIME(t.\`F.Soli\`) LIKE ? 
        AND l.id IS NULL
      GROUP BY t.OrdenId
      ORDER BY colaId ASC LIMIT 50
    `;
    const searchPattern = `${tramoFiltro}%`;

    const [rows] = await pool.query(queryStr, [...activeServices, searchPattern]);
    
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

    // 4. Procesamiento de Reprogramaciones activas
    const [reprogs] = await pool.query(`
      SELECT r.id as reprog_id, r.fecha_solicitada, r.turno, r.motivo as motivo_reprog, t.*, ts.Tipo as CategoriaServicioMantra
      FROM reprogramaciones r
      JOIN ${MAIN_TABLE} t ON r.token = t.token
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON l.OrdenId = r.id AND l.EstadoNotificado = 'Reprogramacion' AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo IN (${placeholders})
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(r.fecha_solicitada) >= CURDATE()
        AND l.id IS NULL
      LIMIT 20
    `, activeServices);

    if (reprogs.length > 0) {
      console.log(`[QUEUE] Procesando ${reprogs.length} reprogramacion(es) pendiente(s)...`);
      for (const reprog of reprogs) {
        const reprogContext = {
          id: reprog.reprog_id,
          fecha_solicitada: reprog.fecha_solicitada,
          turno: reprog.turno
        };

        const result = await sendReprogramacionNotification(reprogContext, reprog);
        
        if (!result.skipped) {
          await pool.query(
            'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
            [reprog.reprog_id, reprog.CodiSegui || null, 'Reprogramacion', result.success, result.errorDetail]
          );
        }

        if (result.success && !result.skipped) {
          console.log(`✔ Log de Reprogramación (ID: ${reprog.reprog_id}) guardado exitosamente.`);
        }
      }
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
  getControlTables,
  resolveServiceType,
  isSectorPiloto,
  ensureLogTableExists,
  sendMantraNotification,
  sendReprogramacionNotification,
  processOrderById,
  runQueueCron,
  buildDynamicCustomData,
  formatDateSpanish,
  formatTitleCase,
  formatRangoHorario
};
