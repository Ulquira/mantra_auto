const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [triggers] = await pool.query("SHOW TRIGGERS");
    console.log("=== TRIGGERS ACTIVOS EN MYSQL ===");
    console.table(triggers.map(t => ({
      Trigger: t.Trigger,
      Event: t.Event,
      Table: t.Table,
      Statement: t.Statement.replace(/\n/g, ' ')
    })));

    const [colaStats] = await pool.query(`
      SELECT 
        t.Estado,
        ts.Tipo as Categoria,
        DATE(t.\`F.Soli\`) as f_soli_date,
        TIME(t.\`F.Soli\`) as f_soli_time,
        COUNT(*) as cantidad
      FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      GROUP BY t.Estado, ts.Tipo, DATE(t.\`F.Soli\`), TIME(t.\`F.Soli\`)
      ORDER BY f_soli_date DESC, cantidad DESC
    `);
    console.log("\n=== REGISTROS ACTUALMENTE EN COLA_NOTIFICACIONES_MANTRA ===");
    console.table(colaStats);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
