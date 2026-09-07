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

    console.log("Creando tabla de cola...");
    await conn.query(`
      CREATE TABLE IF NOT EXISTS COLA_NOTIFICACIONES_MANTRA (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ordenId INT NOT NULL,
        fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Borrando trigger antiguo si existe...");
    await conn.query(`DROP TRIGGER IF EXISTS trg_testmantra_agendada`);

    console.log("Creando nuevo trigger...");
    await conn.query(`
      CREATE TRIGGER trg_testmantra_agendada 
      AFTER UPDATE ON Testmantra
      FOR EACH ROW
      BEGIN
        IF (NEW.Estado IN ('Agendada', 'Pendiente') AND (OLD.Estado IS NULL OR OLD.Estado NOT IN ('Agendada', 'Pendiente') OR OLD.Estado <> NEW.Estado)) THEN
          INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (NEW.OrdenId);
        END IF;
      END;
    `);

    console.log('✅ Cola y Trigger creados exitosamente en MySQL.');
    await conn.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
