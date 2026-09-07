const { pool, MAIN_TABLE, ensureLogTableExists, sendMantraNotification, sendReprogramacionNotification } = require('./mantra_service.cjs');

let isCronRunning = false;

async function runCron() {
  if (isCronRunning) {
    console.log('[CRON] Ejecución de escaneo general anterior en curso. Omitiendo ciclo...');
    return;
  }
  isCronRunning = true;
  console.log(`Iniciando CRON Job de notificaciones [Tabla: ${MAIN_TABLE}]...`);

  try {
    await ensureLogTableExists(pool);

    // 1. Procesamiento de Nuevas Órdenes Agendadas / Pendientes
    console.log("--- Procesando Órdenes Agendadas / Pendientes ---");
    const [rows] = await pool.query(`
      SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM ${MAIN_TABLE} t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON t.OrdenId = l.OrdenId AND l.EstadoNotificado = t.Estado
      WHERE t.Estado IN ('Agendada', 'Pendiente') AND l.id IS NULL
      LIMIT 50
    `);

    if (rows.length === 0) {
      console.log("✔ No hay órdenes nuevas en estado 'Agendada' o 'Pendiente' pendientes de notificar.");
    } else {
      console.log(`Encontradas ${rows.length} órden(es) pendientes de notificación.`);
      
      for (const row of rows) {
        const result = await sendMantraNotification(row);
        
        await pool.query(
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
    const [reprogs] = await pool.query(`
      SELECT r.*, t.OrdenId, t.TeleMovilNume, t.ClienteFinal, t.IdenServi, t.TipoOrden, t.Producto, t.\`Sector Operativo\`, t.CodiSegui, t.Direccion, ts.Tipo as CategoriaServicioMantra
      FROM reprogramaciones r
      JOIN ${MAIN_TABLE} t ON r.token = t.token
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON l.OrdenId = r.id AND l.EstadoNotificado = 'Reprogramacion'
      WHERE t.Estado IN ('Agendada', 'Pendiente') AND l.id IS NULL
      LIMIT 50
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
          Producto: reprog.Producto,
          'Sector Operativo': reprog['Sector Operativo'],
          CodiSegui: reprog.CodiSegui,
          Direccion: reprog.Direccion,
          CategoriaServicioMantra: reprog.CategoriaServicioMantra
        };

        const result = await sendReprogramacionNotification(reprog, ordenContext);
        
        // Guardamos en el log usando el ID de la reprogramación como OrdenId para no chocar con los logs normales
        await pool.query(
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

  } catch (err) {
    console.error("❌ Error en runCron:", err.message);
  } finally {
    isCronRunning = false;
    console.log("\nProceso finalizado.");
  }
}

module.exports = { runCron };

// Permitir ejecutarlo directamente desde la terminal
if (require.main === module) {
  runCron().then(() => {
    pool.end();
  });
}
