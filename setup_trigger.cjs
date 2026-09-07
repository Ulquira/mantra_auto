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

    console.log("2. Limpiando COLA_NOTIFICACIONES_MANTRA para pausar producción...");
    await conn.query(`TRUNCATE TABLE COLA_NOTIFICACIONES_MANTRA`);

    console.log("3. Eliminando triggers de vw_winordetraba (producción)...");
    await conn.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_insert`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_winordetraba_pendiente_update`);

    console.log("4. Eliminando triggers antiguos de testmantra...");
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_agendada`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_pendiente_insert`);
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_pendiente_update`);

    console.log("5. Creando triggers en Testmantra para entorno de pruebas...");
    await conn.query(`
      CREATE TRIGGER trg_testmantra_pendiente_update 
      AFTER UPDATE ON Testmantra
      FOR EACH ROW
      BEGIN
        IF NEW.Estado IN ('Pendiente', 'Agendada') AND (OLD.Estado IS NULL OR OLD.Estado NOT IN ('Pendiente', 'Agendada') OR OLD.Estado <> NEW.Estado) THEN
          INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    await conn.query(`
      CREATE TRIGGER trg_testmantra_pendiente_insert 
      AFTER INSERT ON Testmantra
      FOR EACH ROW
      BEGIN
        IF NEW.Estado IN ('Pendiente', 'Agendada') THEN
          INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    console.log("6. Verificando triggers activos en la base de datos:");
    const [trgs] = await conn.query("SHOW TRIGGERS");
    console.log(trgs.map(t => ({ Trigger: t.Trigger, Table: t.Table, Event: t.Event })));

    console.log('✅ Entorno de pruebas Testmantra activado. Triggers de producción eliminados.');
    await conn.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();

