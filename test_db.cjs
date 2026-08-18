const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => { 
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: process.env.DB_PORT
  });
  const [rows] = await conn.query('SELECT OrdenId, Estado, `F.Soli` FROM Testmantra WHERE Estado = "Agendada"');
  console.log('Órdenes Agendadas:', rows);
  
  const [logs] = await conn.query('SELECT * FROM LOG_NOTIFICACIONES_WSP');
  console.log('Logs actuales:', logs);
  
  await conn.end(); 
})();