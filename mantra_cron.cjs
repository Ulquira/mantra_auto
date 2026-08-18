const { getDbConnection, ensureLogTableExists, sendMantraNotification } = require('./mantra_service.cjs');

async function runCron() {
  console.log("Iniciando CRON Job de notificaciones...");
  
  const conn = await getDbConnection();

  try {
    await ensureLogTableExists(conn);

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
  } finally {
    await conn.end();
    console.log("\nProceso finalizado.");
  }
}

runCron();
