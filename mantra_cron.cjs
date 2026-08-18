const mysql = require('mysql2/promise');
require('dotenv').config();

const MANTRA_GROUP_ID = "685dc70e53dd0ac2492c69ca";
const MANTRA_API_KEY = "3d0d59f1-f3ea-47be-b5b0-d7ffca33817d";
const MANTRA_TEMPLATE_ID = "6a7a457736ef53a657fc03ed";

// URLs
const URL_CREATE_CONTACT = "https://wbpback2pro2.mantra.chat/contacts/new";
const URL_SEND_TEMPLATE = "https://wbpback2pro2.mantra.chat/contacts/send"; 

async function sendMantraNotification(orden) {
  // Limpiar el teléfono a 9 dígitos por si tiene un "+51" extra en la BD
  const rawPhone = orden.TeleMovilNume || '';
  const phone = rawPhone.replace(/\D/g, '').slice(-9);
  const name = orden.ClienteFinal;

  // Lógica de formateo de fecha (custom_1)
  let fechaFormateada = "fecha por confirmar";
  if (orden.f_date) {
    const dateObj = new Date(orden.f_date);
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    fechaFormateada = `${dateObj.getUTCDate()} de ${meses[dateObj.getUTCMonth()]}`;
  }

  // Lógica de formateo de tramo horario (custom_2)
  let rangoHorario = "horario por confirmar";
  const t = orden.f_time; // Viene como "08:00:00"
  if (t) {
    if (t.startsWith('08')) rangoHorario = "8AM - 12PM";
    else if (t.startsWith('12')) rangoHorario = "12PM - 4PM";
    else if (t.startsWith('16')) rangoHorario = "4PM - 8PM";
    else rangoHorario = t;
  }

  console.log(`\n=================================================`);
  console.log(`Procesando Orden: ${orden.OrdenId} - ${name} (${phone})`);
  console.log(`=================================================`);

  // 1. Crear / Actualizar Contacto
  const contactPayload = {
    groupId: MANTRA_GROUP_ID,
    apiKey: MANTRA_API_KEY,
    data: {
      name: name,
      phone: phone,
      countryCode: "51",
      custom_7: name,
      custom_3: orden.IdenServi ? orden.IdenServi.split('|')[0].trim() : "tu plan Win",
      custom_1: fechaFormateada,
      custom_2: rangoHorario,
      custom_10: `https://go.win.pe/seguimiento/${orden.token}`
    }
  };

  try {
    console.log("1. Enviando petición para crear/actualizar contacto...");
    const resContact = await fetch(URL_CREATE_CONTACT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactPayload)
    });
    
    // Mostramos la respuesta tal cual
    const jsonContact = await resContact.json();
    console.log("   Respuesta Servidor (Contacto):", jsonContact.resultOp || jsonContact);

    // 2. Enviar Plantilla
    const templatePayload = {
      groupId: MANTRA_GROUP_ID,
      apiKey: MANTRA_API_KEY,
      templateId: MANTRA_TEMPLATE_ID,
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
      console.error("   [ERROR] La plantilla no se pudo enviar. Respuesta de Mantras:", jsonTemplate);
      return { success: false, errorDetail: JSON.stringify(jsonTemplate) };
    }

    return { success: true, errorDetail: null }; 
  } catch (err) {
    console.error("   [ERROR CRÍTICO] Fallo en la red o API de Mantras:", err.message);
    return { success: false, errorDetail: err.message };
  }
}

async function runCron() {
  console.log("Iniciando CRON Job de notificaciones...");
  
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  // Asegurarnos de que la tabla de logs exista, esta vez agregando la columna DetallesError
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

  // Buscamos órdenes en Testmantra que estén en 'Agendada' y NO tengan un registro en LOG_NOTIFICACIONES_WSP para ese estado
  const [rows] = await conn.query(`
    SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time
    FROM Testmantra t
    LEFT JOIN LOG_NOTIFICACIONES_WSP l
      ON t.OrdenId = l.OrdenId AND l.EstadoNotificado = t.Estado
    WHERE t.Estado = 'Agendada' AND l.id IS NULL
  `);

  if (rows.length === 0) {
    console.log("✔ No hay órdenes nuevas en estado 'Agendada' pendientes de notificar.");
  } else {
    console.log(`Encontradas ${rows.length} órden(es) pendientes de notificación.`);
    
    for (const row of rows) {
      const result = await sendMantraNotification(row);
      
      // Registramos en el log TANTO los éxitos como los errores.
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

  await conn.end();
  console.log("\nProceso finalizado.");
}

runCron();
