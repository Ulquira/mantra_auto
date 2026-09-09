const { runQueueCron, pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== EJECUTANDO PROCESAMIENTO DE COLA (runQueueCron) ===");
    await runQueueCron();

    const [logs] = await pool.query(`
      SELECT * FROM LOG_NOTIFICACIONES_WSP WHERE OrdenId = 9999901
    `);
    console.log("\n📊 Log de la orden de prueba:", logs);

    const [cola] = await pool.query(`
      SELECT * FROM COLA_NOTIFICACIONES_MANTRA WHERE ordenId = 9999901
    `);
    console.log("📌 Cola tras ejecución (debe estar vacía):", cola);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
