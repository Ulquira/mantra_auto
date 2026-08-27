const { getDbConnection, ensureLogTableExists, sendMantraNotification, sendReprogramacionNotification } = require('./mantra_service.cjs');

async function runCron() {
  console.log("Iniciando CRON Job de notificaciones...");
  
  const conn = await getDbConnection();

  try {
    await ensureLogTableExists(conn);

    // 1. Procesamiento de Nuevas Órdenes Agendadas
    console.log("--- Procesando Órdenes Agendadas ---");
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

    // 2. Procesamiento de Reprogramaciones
    console.log("\n--- Procesando Reprogramaciones ---");
    const [reprogs] = await conn.query(`
      SELECT r.*, t.OrdenId, t.TeleMovilNume, t.ClienteFinal, t.IdenServi, t.TipoOrden, t.Producto
      FROM reprogramaciones r
      JOIN Testmantra t ON r.token = t.token
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON l.OrdenId = r.id AND l.EstadoNotificado = 'Reprogramacion'
      WHERE l.id IS NULL
    `);

    if (reprogs.length === 0) {
      console.log("✔ No hay nuevas reprogramaciones pendientes de notificar.");
    } else {
      console.log(`Encontradas ${reprogs.length} reprogramacion(es) pendiente(s).`);
      
      for (const reprog of reprogs) {
        // Adaptamos el objeto orden para pasarlo a los parámetros que espera la API
        const ordenContext = {
          OrdenId: reprog.OrdenId,
          TeleMovilNume: reprog.TeleMovilNume,
          ClienteFinal: reprog.ClienteFinal,
          IdenServi: reprog.IdenServi,
          token: reprog.token,
          TipoOrden: reprog.TipoOrden,
          Producto: reprog.Producto
        };

        const result = await sendReprogramacionNotification(reprog, ordenContext);
        
        // Guardamos en el log usando el ID de la reprogramación como OrdenId para no chocar con los logs normales
        await conn.query(
          'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?)',
          [reprog.id, 'Reprogramacion', result.success, result.errorDetail]
        );

        if (result.success && !result.skipped) {
          console.log(`✔ Log de Reprogramación (ID: ${reprog.id}) guardado exitosamente.`);
        } else if (result.skipped) {
          console.log(`- Reprogramación (ID: ${reprog.id}) omitida (${result.errorDetail}).`);
        } else {
          console.log(`❌ Reprogramación (ID: ${reprog.id}) falló. El error se ha guardado.`);
        }
      }
    }

  } finally {
    await conn.end();
    console.log("\nProceso finalizado.");
  }
}

module.exports = { runCron };

// Permitir ejecutarlo directamente desde la terminal
if (require.main === module) {
  runCron();
}
