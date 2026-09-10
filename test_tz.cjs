const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        OrdenId,
        \`F.Soli\` as f_soli_raw,
        DATE(\`F.Soli\`) as date_raw,
        TIME(\`F.Soli\`) as time_raw,
        DATE(CONVERT_TZ(\`F.Soli\`, '+00:00', '-05:00')) as date_lima,
        TIME(CONVERT_TZ(\`F.Soli\`, '+00:00', '-05:00')) as time_lima
      FROM vw_winordetraba 
      WHERE OrdenId IN (3427916, 3427919, 3427918)
    `);
    console.table(rows);

    const [tramos] = await pool.query(`
      SELECT 
        TIME(\`F.Soli\`) as time_raw,
        TIME(CONVERT_TZ(\`F.Soli\`, '+00:00', '-05:00')) as time_lima,
        COUNT(*) as total
      FROM vw_winordetraba
      WHERE DATE(CONVERT_TZ(\`F.Soli\`, '+00:00', '-05:00')) = '2026-09-10'
      GROUP BY TIME(\`F.Soli\`), TIME(CONVERT_TZ(\`F.Soli\`, '+00:00', '-05:00'))
    `);
    console.log('\n=== DISTRIBUCIÓN DE HORAS HOY EN VW_WINORDETRABA ===');
    console.table(tramos);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
