const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => { 
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: process.env.DB_PORT
  });
  const [rows] = await conn.query('SELECT OrdenId, CodiSegui, CodiSeguiClien, Estado, `F.Soli` FROM Testmantra LIMIT 10');
  console.log('Testmantra:', rows);
  
  const [vw] = await conn.query('SELECT OrdenId, CodiSegui, CodiSeguiClien, Estado, `F.Soli` FROM vw_winordetraba WHERE Estado = "Regestión" LIMIT 5');
  console.log('vw_winordetraba Regestion:', vw);

  await conn.end(); 
})();