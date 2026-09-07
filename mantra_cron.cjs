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

    // Determinar tramo activo según la hora de Perú (America/Lima)
    const options = { timeZone: 'America/Lima', hour12: false, hour: 'numeric' };
    const formatter = new Intl.DateTimeFormat([], options);
    const horaActual = parseInt(formatter.format(new Date()), 10);

    let tramoFiltro = null;
    if (horaActual >= 7 && horaActual <= 9) tramoFiltro = '08';
    else if (horaActual >= 11 && horaActual <= 13) tramoFiltro = '12';
    else if (horaActual >= 15 && horaActual <= 17) tramoFiltro = '16';

    // 1. Procesamiento de Nuevas Órdenes Agendadas / Pendientes del Tramo Activo (ESTRICTAMENTE AVERIAS)
    if (!tramoFiltro) {
      console.log(`[CRON] Fuera de las ventanas de envío (07-09h, 11-13h, 15-17h). Hora actual: ${horaActual}h. No se procesan nuevos agendamientos.`);
    } else {
      console.log(`--- Procesando Órdenes de HOY del Tramo [${tramoFiltro}:00] (SOLO AVERIAS) ---`);
      const [rows] = await pool.query(`
        SELECT t.*, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
        FROM ${MAIN_TABLE} t
        INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
        LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
          t.OrdenId = l.OrdenId
          OR (t.CodiSegui IS NOT NULL AND t.CodiSegui <> '' AND l.CodiSegui = t.CodiSegui)
        ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
        WHERE ts.Tipo = 'AVERIAS'
          AND t.Estado IN ('Agendada', 'Pendiente')
          AND DATE(t.\`F.Soli\`) = CURDATE()
          AND TIME(t.\`F.Soli\`) LIKE ?
          AND l.id IS NULL
        LIMIT 50
      `, [`${tramoFiltro}%`]);

      if (rows.length === 0) {
        console.log(`✔ No hay órdenes pendientes de HOY para el tramo [${tramoFiltro}:00] de tipo AVERIAS.`);
      } else {
        console.log(`Encontradas ${rows.length} órden(es) pendientes de notificación para HOY [${tramoFiltro}:00] (SOLO AVERIAS).`);
        
        for (const row of rows) {
          const result = await sendMantraNotification(row);
          
          await pool.query(
            'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
            [row.OrdenId, row.CodiSegui || null, row.Estado, result.success, result.errorDetail]
          );

          if (result.success && !result.skipped) {
            console.log(`✔ Log guardado exitosamente. No se volverá a notificar la orden ${row.OrdenId} (Ticket: ${row.CodiSegui}) hoy.`);
          } else if (result.skipped) {
            console.log(`- Orden ${row.OrdenId} omitida (${result.errorDetail}).`);
          } else {
            console.log(`❌ Orden ${row.OrdenId} falló. El error se ha guardado en el log de la BD para revisión.`);
          }
        }
      }
    }

    // 2. Procesamiento de Reprogramaciones (SOLO AVERIAS)
    console.log("\n--- Procesando Reprogramaciones (SOLO AVERIAS) ---");
    const [reprogs] = await pool.query(`
      SELECT r.*, t.OrdenId, t.TeleMovilNume, t.ClienteFinal, t.IdenServi, t.TipoOrden, t.Producto, t.\`Sector Operativo\`, t.CodiSegui, t.Direccion, ts.Tipo as CategoriaServicioMantra
      FROM reprogramaciones r
      JOIN ${MAIN_TABLE} t ON r.token = t.token
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l
        ON l.OrdenId = r.id AND l.EstadoNotificado = 'Reprogramacion' AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND t.Estado IN ('Agendada', 'Pendiente')
        AND DATE(r.fecha_solicitada) >= CURDATE()
        AND l.id IS NULL
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
          'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
          [reprog.id, reprog.CodiSegui || null, 'Reprogramacion', result.success, result.errorDetail]
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
