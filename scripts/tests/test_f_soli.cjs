const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });
  const [rows] = await conn.query('SELECT DATE(`F.Soli`) as d, TIME(`F.Soli`) as t FROM Testmantra LIMIT 1');
  console.log(rows[0]);
  await conn.end();
}
run();
