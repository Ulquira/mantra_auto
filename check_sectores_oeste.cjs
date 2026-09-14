const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT \`Sector Operativo\` as sector 
      FROM ${MAIN_TABLE} 
      WHERE \`Sector Operativo\` LIKE '%OESTE%'
    `);
    console.log("Sectores con OESTE en la base de datos:");
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
