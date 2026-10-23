const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    const [views] = await pool.query("SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = 'bd_phoenix'");
    console.log("=== COMPROBACIÓN DE TODAS LAS VISTAS ===");
    for (const v of views) {
      const vName = v.TABLE_NAME;
      try {
        await pool.query('SELECT 1 FROM `' + vName + '` LIMIT 1');
        console.log(`✔ ${vName}: OK`);
      } catch (err) {
        console.error(`❌ ${vName}: CAÍDA -> ${err.message}`);
      }
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
