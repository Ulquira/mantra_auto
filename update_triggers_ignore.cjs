const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== ACTUALIZANDO TRIGGERS CON INSERT IGNORE ===");
    
    await pool.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_update`);
    await pool.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_insert`);

    await pool.query(`
      CREATE TRIGGER trg_winordetraba_pendiente_update 
      AFTER UPDATE ON vw_winordetraba
      FOR EACH ROW
      BEGIN
        IF NEW.Estado IN ('Pendiente', 'Agendada', 'En camino') 
           AND (OLD.Estado IS NULL OR OLD.Estado NOT IN ('Pendiente', 'Agendada', 'En camino') OR OLD.Estado <> NEW.Estado) THEN
          INSERT IGNORE INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    await pool.query(`
      CREATE TRIGGER trg_winordetraba_pendiente_insert 
      AFTER INSERT ON vw_winordetraba
      FOR EACH ROW
      BEGIN
        IF NEW.Estado IN ('Pendiente', 'Agendada', 'En camino') THEN
          INSERT IGNORE INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    console.log("✅ Triggers actualizados con INSERT IGNORE.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
