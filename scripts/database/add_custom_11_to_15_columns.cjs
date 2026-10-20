const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== AMPLIANDO TABLA CONFIG_PLANTILLAS_MANTRA A 15 CAMPOS CUSTOM ===");

    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'BD_Phoenix' AND TABLE_NAME = 'config_plantillas_mantra'
    `);
    const existingCols = columns.map(c => c.COLUMN_NAME.toLowerCase());

    for (let i = 11; i <= 15; i++) {
      const colName = `custom_${i}_campo`;
      if (!existingCols.includes(colName.toLowerCase())) {
        const prevCol = `custom_${i - 1}_campo`;
        console.log(`Agregando columna ${colName} después de ${prevCol}...`);
        await pool.query(`
          ALTER TABLE config_plantillas_mantra
          ADD COLUMN ${colName} VARCHAR(50) DEFAULT NULL AFTER ${prevCol}
        `);
        console.log(`✔ ${colName} agregada exitosamente.`);
      } else {
        console.log(`ℹ ${colName} ya existe en config_plantillas_mantra.`);
      }
    }

    const [updatedCols] = await pool.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'BD_Phoenix' AND TABLE_NAME = 'config_plantillas_mantra' AND COLUMN_NAME LIKE 'custom_%'
      ORDER BY ORDINAL_POSITION
    `);
    console.log("\nEstructura actual de columnas custom en config_plantillas_mantra:");
    console.table(updatedCols);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error ampliando columnas:", err.message);
    process.exit(1);
  }
})();
