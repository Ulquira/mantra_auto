const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log("1. Asegurando tabla de cola...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS COLA_NOTIFICACIONES_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ordenId INT NOT NULL,
        fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("2. Limpiando cola para inicio limpio en producción...");
    await conn.query(`TRUNCATE TABLE COLA_NOTIFICACIONES_MANTRA`);

    console.log("3. Eliminando triggers antiguos de testmantra...");
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_agendada`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_pendiente_update`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_pendiente_insert`);

    console.log("4. Eliminando triggers previos de vw_winordetraba si existiesen...");
    await conn.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_update`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_insert`);

    console.log("5. Creando triggers de producción en vw_winordetraba...");
    await conn.query(`
      CREATE TRIGGER trg_winordetraba_pendiente_update 
      AFTER UPDATE ON vw_winordetraba
      FOR EACH ROW
      BEGIN
        IF NEW.Estado = 'Pendiente' AND OLD.Estado <> 'Pendiente' THEN
          INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    await conn.query(`
      CREATE TRIGGER trg_winordetraba_pendiente_insert 
      AFTER INSERT ON vw_winordetraba
      FOR EACH ROW
      BEGIN
        IF NEW.Estado = 'Pendiente' THEN
          INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    console.log("6. Verificando triggers en la base de datos...");
    const [triggers] = await conn.query("SHOW TRIGGERS");
    console.log("Triggers activos en bd_phoenix:", triggers.map(t => ({ Trigger: t.Trigger, Event: t.Event, Table: t.Table })));

    console.log('✅ Configuración de producción en MySQL completada con éxito.');
    await conn.end();
  } catch (err) {
    console.error('❌ Error en configuración de BD:', err.message);
  }
})();
