const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [sample] = await pool.query('SELECT token, codisegui, evento, timestamp FROM logs_traking LIMIT 10');
    console.table(sample);

    const [nulls] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN token IS NULL OR token = '' THEN 1 ELSE 0 END) as sin_token,
        SUM(CASE WHEN codisegui IS NULL OR codisegui = '' THEN 1 ELSE 0 END) as sin_codisegui
      FROM logs_traking
    `);
    console.table(nulls);

    const [matchToken] = await pool.query(`
      SELECT 
        COUNT(DISTINCT r.id) as total_reportes,
        COUNT(DISTINCT trk.token) as matches_tracking
      FROM REPORTE_PLANTILLAS_MANTRA r
      LEFT JOIN vw_winordetraba t ON r.codigo_pedido = t.CodiSegui
      LEFT JOIN logs_traking trk ON t.token = trk.token
    `);
    console.table(matchToken);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
