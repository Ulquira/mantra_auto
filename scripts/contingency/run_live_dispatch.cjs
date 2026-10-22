const {
  pool,
  MAIN_TABLE,
  getControlTables,
  sendMantraNotification,
  sendReprogramacionNotification,
  ensureLogTableExists
} = require('../../mantra_service.cjs');

async function runLiveDispatch() {
  console.log("===============================================================================");
  console.log("🚀 INICIANDO MOTOR DE DESPACHO EN VIVO DE NOTIFICACIONES (CONTINGENCIA)");
  console.log("===============================================================================\n");

  await ensureLogTableExists(pool);

  const { configs } = await getControlTables(true);
  const activeServices = [...new Set((configs || []).filter(c => c.activo === 1).map(c => c.tipo_servicio))];

  if (activeServices.length === 0) {
    console.log("❌ No hay servicios activos en CONFIG_PLANTILLAS_MANTRA.");
    return;
  }

  const options = { timeZone: 'America/Lima', hour12: false, hour: 'numeric' };
  const formatter = new Intl.DateTimeFormat([], options);
  const horaActual = parseInt(formatter.format(new Date()), 10);

  let tramoFiltro = null;
  if (horaActual >= 7 && horaActual < 10) tramoFiltro = '08';
  else if (horaActual >= 10 && horaActual < 14) tramoFiltro = '12';
  else if (horaActual >= 14 && horaActual < 19) tramoFiltro = '16';

  const isHorarioContinuo = horaActual >= 7 && horaActual < 19;
  console.log(`⏰ Hora actual (Perú): ${horaActual}:00 | Tramo activo AVERIAS: [${tramoFiltro || 'FUERA DE TRAMO'}] | Continuo: ${isHorarioContinuo ? 'SI' : 'NO'}`);

  if (!isHorarioContinuo) {
    console.log("⛔ Fuera del horario de operación (07:00 a 19:00). Abortando.");
    return;
  }

  // 1. Extraer órdenes pendientes directamente de la vista maestra
  const placeholders = activeServices.map(() => '?').join(',');
  const queryStr = `
    SELECT 
      t.OrdenId,
      t.Producto,
      t.Estado,
      t.CodiSegui,
      t.ClienteFinal,
      t.TeleMovilNume,
      t.\`Número Documento\`,
      t.IdenServi,
      t.Direccion,
      t.Region,
      t.Zona,
      t.Provincia,
      t.Localidad,
      t.Empresa,
      t.\`Sector Operativo\`,
      t.\`F.Soli\`,
      t.\`F.Visita\`,
      t.FechaUltiEsta,
      t.token,
      t.Pin_token,
      DATE(t.\`F.Soli\`) as f_date,
      TIME(t.\`F.Soli\`) as f_time,
      MAX(ts.Tipo) as CategoriaServicioMantra
    FROM ${MAIN_TABLE} t
    INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
    WHERE ts.Tipo IN (${placeholders})
      AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
      AND DATE(t.\`F.Soli\`) = CURDATE() 
      AND (
        (ts.Tipo <> 'AVERIAS' AND ? = 1)
        OR
        (ts.Tipo = 'AVERIAS' AND ? IS NOT NULL AND TIME(t.\`F.Soli\`) LIKE ?)
      )
      AND NOT EXISTS (
        SELECT 1 FROM LOG_NOTIFICACIONES_WSP l
        WHERE l.OrdenId = t.OrdenId
          AND DATE(l.fecha_envio) = CURDATE()
          AND l.EnviadoExitosamente = 1
      )
    GROUP BY 
      t.OrdenId,
      t.Producto,
      t.Estado,
      t.CodiSegui,
      t.ClienteFinal,
      t.TeleMovilNume,
      t.\`Número Documento\`,
      t.IdenServi,
      t.Direccion,
      t.Region,
      t.Zona,
      t.Provincia,
      t.Localidad,
      t.Empresa,
      t.\`Sector Operativo\`,
      t.\`F.Soli\`,
      t.\`F.Visita\`,
      t.FechaUltiEsta,
      t.token,
      t.Pin_token
    ORDER BY t.OrdenId ASC
  `;

  const searchPattern = tramoFiltro ? `${tramoFiltro}%` : null;
  const queryParams = [
    ...activeServices,
    isHorarioContinuo ? 1 : 0,
    tramoFiltro ? 1 : null,
    searchPattern
  ];

  console.log(`\n🔍 Consultando órdenes pendientes en ${MAIN_TABLE}...`);
  const [rows] = await pool.query(queryStr, queryParams);
  console.log(`📋 Encontradas ${rows.length} órdenes listas para despacho inmediato.\n`);

  let exitosos = 0;
  let fallidos = 0;
  let omitidos = 0;
  const resumenPorTipo = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const tipo = row.CategoriaServicioMantra || 'OTRO';
    if (!resumenPorTipo[tipo]) resumenPorTipo[tipo] = { total: 0, ok: 0, err: 0 };
    resumenPorTipo[tipo].total++;

    process.stdout.write(`[${i + 1}/${rows.length}] Orden ${row.OrdenId} (${tipo} - ${row.Producto})... `);

    try {
      const result = await sendMantraNotification(row);

      if (!result.skipped) {
        await pool.query(
          'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
          [row.OrdenId, row.CodiSegui || null, row.Estado, result.success ? 1 : 0, result.errorDetail]
        );
      }

      // Eliminar de cola si estaba presente
      await pool.query('DELETE FROM COLA_NOTIFICACIONES_MANTRA WHERE ordenId = ?', [row.OrdenId]);

      if (result.success && !result.skipped) {
        exitosos++;
        resumenPorTipo[tipo].ok++;
        console.log(`✔ ENVIADO`);
      } else if (result.skipped) {
        omitidos++;
        console.log(`⏭ OMITIDO (${result.errorDetail})`);
      } else {
        fallidos++;
        resumenPorTipo[tipo].err++;
        console.log(`❌ FALLÓ (${result.errorDetail})`);
      }
    } catch (err) {
      fallidos++;
      resumenPorTipo[tipo].err++;
      console.log(`❌ ERROR: ${err.message}`);
    }

    // Pequeño throttle de 100ms para evitar rate limiting en API de Mantra
    await new Promise(r => setTimeout(r, 100));
  }

  // 2. Procesamiento de Reprogramaciones activas
  console.log("\n--- PROCESANDO REPROGRAMACIONES ACTIVAS ---");
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
  `, activeServices);

  console.log(`📋 Encontradas ${reprogs.length} reprogramaciones pendientes.`);
  let reprogOk = 0;
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
        [reprog.reprog_id, reprog.CodiSegui || null, 'Reprogramacion', result.success ? 1 : 0, result.errorDetail]
      );
    }
    if (result.success && !result.skipped) reprogOk++;
    await new Promise(r => setTimeout(r, 100));
  }

  console.log("\n===============================================================================");
  console.log("📊 RESUMEN DE EJECUCIÓN DEL DESPACHO:");
  console.log(`Total procesadas: ${rows.length}`);
  console.log(`✅ Exitosas: ${exitosos}`);
  console.log(`❌ Fallidas: ${fallidos}`);
  console.log(`⏭ Omitidas: ${omitidos}`);
  console.log(`🔄 Reprogramaciones enviadas: ${reprogOk}`);
  console.log("\nDesglose por tipo de servicio:");
  console.table(resumenPorTipo);
  console.log("===============================================================================");

  process.exit(0);
}

runLiveDispatch().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
