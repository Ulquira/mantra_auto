const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [q] = await pool.query(`
      SELECT c.id, c.ordenId, t.Estado, t.ClienteFinal, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time 
      FROM COLA_NOTIFICACIONES_MANTRA c 
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
    `);
    console.log(`=== COLA ACTUAL (${q.length} registros) ===`);
    console.log(q);

    const [logs] = await pool.query(`
      SELECT l.id, l.OrdenId, l.EstadoNotificado, l.fecha_envio, DATE(t.\`F.Soli\`) as f_soli_date, TIME(t.\`F.Soli\`) as f_soli_time, t.ClienteFinal
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      ORDER BY l.id DESC
      LIMIT 25
    `);
    console.log(`\n=== ÚLTIMOS 25 LOGS ENVIADOS ===`);
    console.log(logs);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
