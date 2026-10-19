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

    console.log('=== 1. CONEXIÓN DIRECTA EXITOSA ===');

    const [threads] = await conn.query("SHOW STATUS LIKE 'Threads_connected'");
    console.log('Hilos / Conexiones actuales conectadas:', threads);

    const [maxConn] = await conn.query("SHOW VARIABLES LIKE 'max_connections'");
    console.log('Max connections permitidas:', maxConn);

    const [processlist] = await conn.query("SHOW PROCESSLIST");
    console.log(`\n=== 2. PROCESSLIST TOTAL (${processlist.length} conexiones activas) ===`);
    console.log(processlist.map(p => ({
      Id: p.Id,
      User: p.User,
      Host: p.Host,
      db: p.db,
      Command: p.Command,
      Time: p.Time,
      State: p.State,
      Info: p.Info ? p.Info.slice(0, 50) : null
    })));

    const [colaCols] = await conn.query("DESCRIBE COLA_NOTIFICACIONES_MANTRA");
    console.log('\n=== 3. ESTRUCTURA TABLA COLA_NOTIFICACIONES_MANTRA ===', colaCols);

    const [colaRows] = await conn.query("SELECT * FROM COLA_NOTIFICACIONES_MANTRA");
    console.log('\n=== 4. REGISTROS EN COLA_NOTIFICACIONES_MANTRA ===', colaRows);

    const [colaDetails] = await conn.query(`
      SELECT c.id as colaId, c.ordenId, t.Estado, t.ClienteFinal, t.Producto, t.\`F.Soli\`, TIME(t.\`F.Soli\`) as f_time, DATE(t.\`F.Soli\`) as f_date
      FROM COLA_NOTIFICACIONES_MANTRA c
      INNER JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
    `);
    console.log('\n=== 4.1 DETALLES DE ÓRDENES EN COLA (JOIN VW_WINORDETRABA) ===', colaDetails);

    const [testmantraRows] = await conn.query("SELECT OrdenId, Estado, ClienteFinal, TeleMovilNume, Producto, `F.Soli` FROM Testmantra");
    console.log('\n=== 5. REGISTROS EN TESTMANTRA ===', testmantraRows);

    const [vwRows] = await conn.query("SELECT OrdenId, Estado, ClienteFinal, TeleMovilNume, Producto, `F.Soli`, token, `Sector Operativo`, CodiSegui FROM vw_winordetraba WHERE OrdenId = 3419617");
    console.log('\n=== 6. REGISTRO 3419617 EN VW_WINORDETRABA ===', vwRows);

    await conn.end();
  } catch (err) {
    console.error('ERROR DIAGNÓSTICO:', err.message);
  }
})();
