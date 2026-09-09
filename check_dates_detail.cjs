const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        OrdenId, 
        Estado, 
        ClienteFinal, 
        DATE_FORMAT(\`F.Soli\`, '%Y-%m-%d %H:%i:%s') as f_soli_str, 
        DATE_FORMAT(FechaUltiEsta, '%Y-%m-%d %H:%i:%s') as fecha_ultimo_estado,
        DATE_FORMAT(FechaIniVisi, '%Y-%m-%d %H:%i:%s') as fecha_ini_visita
      FROM vw_winordetraba 
      WHERE OrdenId IN (3420993, 3421129, 3423735, 3423730, 3421160)
    `);
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
