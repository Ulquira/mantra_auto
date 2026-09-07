const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT OrdenId, Estado, ClienteFinal, TeleMovilNume, Producto, CodiSegui,
             \`F.Soli\`, \`F.Visita\`, FechaIniVisi, FechaUltiEsta 
      FROM vw_winordetraba 
      WHERE CodiSegui LIKE '%46647762%'
      LIMIT 5
    `);
    console.log('=== ORDEN VTEXT-46647762 ENCONTRADA ===', rows);

    const [logRow] = await pool.query(`
      SELECT * FROM LOG_NOTIFICACIONES_WSP 
      WHERE OrdenId IN (${rows.map(r => r.OrdenId).join(',') || 0})
    `);
    console.log('=== LOG DE ENVIO ===', logRow);

    const [tipo] = await pool.query(`
      SELECT * FROM TipoServicio
    `);
    console.log('=== TABLA TIPOSERVICIO COMPLETA ===', tipo);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
