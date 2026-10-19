const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });

    const query = `
      CREATE TABLE IF NOT EXISTS TipoServicio (
        IDservicio INT AUTO_INCREMENT PRIMARY KEY,
        Servicio VARCHAR(255) NOT NULL,
        Tipo VARCHAR(255) NOT NULL
      )
    `;
    
    await conn.query(query);
    console.log('Tabla TipoServicio creada con éxito.');
    
    await conn.end();
  } catch (error) {
    console.error('Error al crear la tabla:', error.message);
  }
})();
