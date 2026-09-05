const mysql = require('mysql2/promise');
require('dotenv').config();

// Mapeo dinámico de Credenciales y Plantillas según el Tipo de Servicio
const MANTRA_CONFIG = {
  Instalacion: {
    GROUP_ID: "685dc70e53dd0ac2492c69ca",
    API_KEY: "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d",
    TEMPLATE_ID_DEFAULT: "6875723e1cb8562af849400e",
    TEMPLATE_ID_OESTE2: "6a7a457736ef53a657fc03ed",
    TEMPLATE_REPROG_ID: "6a9847e14f6db1b188cd5ce3"
  },
  Averias: {
    GROUP_ID: "68508b455ba42fd0a6660300",
    API_KEY: "618684ea-0e61-478f-9b22-bc0fd8b8a934",
    TEMPLATE_ID_DEFAULT: "68fac2ea40478663c8b51c36",
    TEMPLATE_ID_OESTE2: "6a90c047e91ab8e19836a561",
    TEMPLATE_REPROG_ID: "6a984a1d5781ebbf9f145a6b"
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

async function getDbConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });
}

async function ensureLogTableExists(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS LOG_NOTIFICACIONES_WSP (
      id INT AUTO_INCREMENT PRIMARY KEY,
      OrdenId INT NOT NULL,
      EstadoNotificado VARCHAR(50) NOT NULL,
      fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      EnviadoExitosamente BOOLEAN DEFAULT TRUE,
      DetallesError TEXT
    )
  `);
}

async function sendMantraNotification(orden) {
  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const name = orden.ClienteFinal;

  let fechaFormateada = "fecha por confirmar";
  if (orden.f_date) {
    const dateObj = new Date(orden.f_date);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    fechaFormateada = `${dateObj.getUTCDate()} de ${meses[dateObj.getUTCMonth()]}`;
  }

  let rangoHorario = "horario por confirmar";
  const t = orden.f_time;
  if (t) {
    if (t.startsWith('08')) rangoHorario = "8AM - 12PM";
    else if (t.startsWith('12')) rangoHorario = "12PM - 4PM";
    else if (t.startsWith('16')) rangoHorario = "4PM - 8PM";
    else rangoHorario = t;
  }

  console.log(`\n=================================================`);
  console.log(`Procesando Orden: ${orden.OrdenId} - ${name} (${phone})`);
  console.log(`=================================================`);

  // Cruce de datos real utilizando el resultado del LEFT JOIN con tiposervicio
  let tipoServicio = 'Instalacion';
  const tipoServicioBD = (orden.TipoServicioBD || '').toUpperCase();

  if (tipoServicioBD === 'NO') {
    console.log(`[SKIP] El producto no requiere notificación (Tipo = NO).`);
    return { success: true, skipped: true, errorDetail: 'El producto no requiere notificación (Tipo = NO).' };
  } else if (tipoServicioBD === 'AVERIAS' || tipoServicioBD === 'POSTVENTA') {
    tipoServicio = 'Averias';
  } else if (tipoServicioBD === 'INSTALACION' || tipoServicioBD === 'PROVINCIA') {
    tipoServicio = 'Instalacion';
  } else {
    // Fallback de seguridad estricto por si la tabla tiposervicio no tiene mapeado el producto
    const tipoOrden = (orden.TipoOrden || '').toLowerCase();
    const producto = (orden.Producto || '').toLowerCase();
    if (tipoOrden.includes('averia') || tipoOrden.includes('visita') || producto.includes('averia')) {
      tipoServicio = 'Averias';
    }
  }

  // --- MVP OVERRIDE: Apagar temporalmente el envío para INSTALACIONES ---
  if (tipoServicio === 'Instalacion') {
    console.log(`[MVP SKIP] Orden ${orden.OrdenId} corresponde a 'Instalacion'. El envío está apagado temporalmente para el MVP.`);
    return { success: true, skipped: true, errorDetail: 'Skipped: Instalaciones desactivadas para el MVP.' };
  }
  // ------------------------------------------------------------------------

  const credentials = MANTRA_CONFIG[tipoServicio];
  const sectorOperativo = (orden['Sector Operativo'] || '').toUpperCase();
  const templateIdToUse = sectorOperativo.includes('OESTE 2') ? credentials.TEMPLATE_ID_OESTE2 : credentials.TEMPLATE_ID_DEFAULT;
  console.log(`[Lógica Servicio] Tipo Resuelto: ${tipoServicio} | Sector: ${sectorOperativo || 'N/A'} | Template Asignado: ${templateIdToUse}`);

  const trackingLink = orden.token ? `https://go.win.pe/seguimiento/${orden.token}` : (orden.link || '');

  let customData = {};
  if (tipoServicio === 'Averias') {
    const ticket = orden.CodiSegui ? String(orden.CodiSegui).trim() : String(orden.OrdenId);
    const direccion = orden.Direccion ? orden.Direccion.split('||')[0].trim() : "";
    customData = {
      name: name,
      phone: phone,
      countryCode: "51",
      custom_1: ticket,
      custom_2: fechaFormateada,
      custom_3: rangoHorario,
      custom_4: direccion,
      custom_5: trackingLink,
      custom_6: trackingLink,
      custom_7: name,
      custom_10: trackingLink
    };
  } else {
    customData = {
      name: name,
      phone: phone,
      countryCode: "51",
      custom_1: fechaFormateada,
      custom_2: rangoHorario,
      custom_3: extractPlanName(orden.IdenServi),
      custom_5: trackingLink,
      custom_6: trackingLink,
      custom_7: name,
      custom_10: trackingLink
    };
  }

  const contactPayload = {
    groupId: credentials.GROUP_ID,
    apiKey: credentials.API_KEY,
    data: customData
  };

  try {
    console.log("1. Enviando petición para crear/actualizar contacto...");
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
  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const name = orden.ClienteFinal;

  // Formateo de fecha según reprogramaciones.fecha_solicitada
  let fechaFormateada = "fecha por confirmar";
  if (reprog.fecha_solicitada) {
    const dateObj = new Date(reprog.fecha_solicitada);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    fechaFormateada = `${dateObj.getUTCDate()} de ${meses[dateObj.getUTCMonth()]}`;
  }

  const rangoHorario = reprog.turno || "horario por confirmar";

  console.log(`\n=================================================`);
  console.log(`Procesando Reprogramación ID: ${reprog.id} | Orden: ${orden.OrdenId} - ${name} (${phone})`);
  console.log(`=================================================`);

  // Cruce de datos real utilizando el resultado del LEFT JOIN con tiposervicio (para Reprogramaciones)
  let tipoServicio = 'Desconocido';
  const tipoServicioBD = (orden.CategoriaServicioMantra || '').toUpperCase();

  if (tipoServicioBD === 'AVERIAS') {
    tipoServicio = 'Averias';
  } else {
    // Fallback de seguridad
    const tipoOrden = (orden.TipoOrden || '').toLowerCase();
    const producto = (orden.Producto || '').toLowerCase();
    if (tipoOrden.includes('averia') || tipoOrden.includes('visita') || producto.includes('averia')) {
      tipoServicio = 'Averias';
    } else {
      tipoServicio = 'Instalacion_u_Otros';
    }
  }

  // --- MVP OVERRIDE REPROG: Apagar envíos EXCEPTO para AVERIAS ---
  if (tipoServicio !== 'Averias') {
    console.log(`[MVP SKIP] Reprogramación de Orden ${orden.OrdenId} corresponde a '${tipoServicioBD}'. El envío está apagado temporalmente para el MVP.`);
    return { success: true, skipped: true, errorDetail: 'Skipped: Solo Averías activas para el MVP.' };
  }
  // ------------------------------------------------------------------------

  const credentials = MANTRA_CONFIG[tipoServicio];
  
  if (!credentials.TEMPLATE_REPROG_ID) {
    console.log(`[SKIP] No hay plantilla de reprogramación configurada para el tipo ${tipoServicio}.`);
    return { success: true, skipped: true, errorDetail: 'Plantilla de reprogramación no configurada.' };
  }

  console.log(`[Lógica Servicio] Tipo Resuelto: ${tipoServicio} | Template Asignado: ${credentials.TEMPLATE_REPROG_ID}`);

  const trackingLink = orden.token ? `https://go.win.pe/seguimiento/${orden.token}` : (orden.link || '');

  let customData = {};
  if (tipoServicio === 'Averias') {
    const ticket = orden.CodiSegui ? String(orden.CodiSegui).trim() : String(orden.OrdenId);
    const direccion = orden.Direccion ? orden.Direccion.split('||')[0].trim() : "";
    customData = {
      name: name,
      phone: phone,
      countryCode: "51",
      custom_1: ticket,
      custom_2: fechaFormateada,
      custom_3: rangoHorario,
      custom_4: direccion,
      custom_5: trackingLink,
      custom_6: trackingLink,
      custom_7: name,
      custom_10: trackingLink
    };
  } else {
    customData = {
      name: name,
      phone: phone,
      countryCode: "51",
      custom_1: fechaFormateada,
      custom_2: rangoHorario,
      custom_3: extractPlanName(orden.IdenServi),
      custom_5: trackingLink,
      custom_6: trackingLink,
      custom_7: name,
      custom_10: trackingLink
    };
  }

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
  const conn = await getDbConnection();
  try {
    await ensureLogTableExists(conn);

    const [rows] = await conn.query(`
      SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM Testmantra t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE t.OrdenId = ?
    `, [ordenId]);

    if (rows.length === 0) {
      return {
        success: false,
        message: `La orden ${ordenId} no existe en Testmantra.`
      };
    }

    const row = rows[0];
    const result = await sendMantraNotification(row);

    await conn.query(
      'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?)',
      [row.OrdenId, row.Estado, result.success, result.errorDetail]
    );

    return {
      success: result.success,
      ordenId: row.OrdenId,
      estado: row.Estado,
      errorDetail: result.errorDetail
    };
  } finally {
    await conn.end();
  }
}

async function runCron(filterMode = 'ALL') {
  const modeLabel = filterMode === 'NEXT_DAY' ? 'DÍA SIGUIENTE' : filterMode === 'SAME_DAY' ? 'MISMO DÍA' : 'TODOS';
  console.log(`\n[CRON ${new Date().toISOString()}] Ejecutando escaneo periódico (${modeLabel})...`);
  
  const conn = await getDbConnection();

  try {
    await ensureLogTableExists(conn);

    let dateCondition = "";
    if (filterMode === 'NEXT_DAY') {
      dateCondition = " AND DATE(t.`F.Soli`) = DATE_ADD(CURDATE(), INTERVAL 1 DAY)";
    } else if (filterMode === 'SAME_DAY') {
      dateCondition = " AND DATE(t.`F.Soli`) = CURDATE()";
    }

    const queryStr = `
      SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM Testmantra t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON t.OrdenId = l.OrdenId AND l.EstadoNotificado = t.Estado
      WHERE t.Estado = 'Agendada' AND l.id IS NULL ${dateCondition}
    `;

    const [rows] = await conn.query(queryStr);

    if (rows.length === 0) {
      console.log(`✔ No hay órdenes pendientes en estado 'Agendada' para la condición [${modeLabel}].`);
    } else {
      console.log(`Encontradas ${rows.length} órden(es) pendientes de notificación [${modeLabel}].`);
      
      for (const row of rows) {
        const result = await sendMantraNotification(row);
        
        await conn.query(
          'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?)',
          [row.OrdenId, row.Estado, result.success, result.errorDetail]
        );

        if (result.success) {
          console.log(`✔ Log guardado exitosamente. No se volverá a notificar la orden ${row.OrdenId} por este estado.`);
        } else {
          console.log(`❌ Orden ${row.OrdenId} falló. El error se ha guardado en el log de la BD para revisión.`);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error durante la ejecución del cron:", err.message);
  } finally {
    await conn.end();
  }
}

async function runQueueCron() {
  const conn = await getDbConnection();
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
      // Fuera de las ventanas permitidas, no procesamos la cola, cerramos la conexión
      await conn.end();
      return;
    }

    // 3. Extraer de la tabla principal SOLO los IDs que estén en la cola y cuyo F.Soli corresponda al tramo objetivo
    const queryStr = `
      SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time, c.id as colaId, ts.Tipo as CategoriaServicioMantra
      FROM COLA_NOTIFICACIONES_MANTRA c
      INNER JOIN Testmantra t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE TIME(\`F.Soli\`) LIKE ? 
      ORDER BY c.id ASC LIMIT 50
    `;
    const searchPattern = `${tramoFiltro}%`;

    const [rows] = await conn.query(queryStr, [searchPattern]);
    
    if (rows.length === 0) {
      await conn.end();
      return;
    }

    console.log(`[QUEUE] Evaluando Tramo Horario [${tramoFiltro}:00]. Procesando ${rows.length} órdenes en cola.`);

    for (const row of rows) {
      const result = await sendMantraNotification(row);
      
      await conn.query(
        'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?)',
        [row.OrdenId, row.Estado, result.success, result.errorDetail]
      );

      // Eliminamos siempre de la cola, ya sea éxito o error reportado para no atorarnos
      await conn.query('DELETE FROM COLA_NOTIFICACIONES_MANTRA WHERE id = ?', [row.colaId]);
      console.log(`[QUEUE] Orden ${row.OrdenId} eliminada de la cola.`);
    }
  } catch (err) {
    console.error("❌ Error en QueueCron:", err.message);
  } finally {
    if (conn && conn.connection && conn.connection._closing === false) {
      await conn.end();
    }
  }
}

module.exports = {
  getDbConnection,
  ensureLogTableExists,
  sendMantraNotification,
  sendReprogramacionNotification,
  processOrderById,
  runCron,
  runQueueCron
};
