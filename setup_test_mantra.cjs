const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('Actualizando tabla Testmantra para la prueba...');
    
    // 1. Cambiamos el estado a "Agendada" y ponemos tu número de teléfono (935434175)
    await conn.query(`
      UPDATE Testmantra 
      SET Estado = 'Agendada', TeleMovilNume = '935434175'
    `);

    // 2. Limpiamos cualquier log de pruebas anteriores
    await conn.query(`
      CREATE TABLE IF NOT EXISTS LOG_NOTIFICACIONES_WSP (
        id INT AUTO_INCREMENT PRIMARY KEY,
        OrdenId INT NOT NULL,
        EstadoNotificado VARCHAR(50) NOT NULL,
        fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await conn.query('TRUNCATE TABLE LOG_NOTIFICACIONES_WSP');

    console.log('¡Entorno listo! Orden pasada a "Agendada" con el teléfono 935434175.');
    await conn.end();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
