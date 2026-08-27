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

    console.log('Copiando casos de vw_winordetraba a Testmantra...');

    // Casos para Visita Técnica (Averías / Postventa)
    const [averias] = await conn.query(`
      SELECT * FROM vw_winordetraba 
      WHERE Producto IN ('AVERIAS', 'POSTVENTA', 'MOTOWIN')
      LIMIT 2
    `);

    // Casos para Instalaciones
    const [instalaciones] = await conn.query(`
      SELECT * FROM vw_winordetraba 
      WHERE Producto IN ('INTERNET FIBRA OPTICA SGI', 'INSTALACIONES CONDOMINIO', 'EQUIPOS EN COMODATO')
      LIMIT 2
    `);

    const registros = [...averias, ...instalaciones];

    if (registros.length === 0) {
      console.log('No se encontraron registros para copiar.');
      await conn.end();
      return;
    }

    // Obtener las columnas de vw_winordetraba para asegurar que el INSERT ignore las que no existan si es necesario, 
    // pero idealmente ambas tienen la misma estructura. 
    // Usaremos un INSERT dinámico con las keys del primer registro.
    const columns = Object.keys(registros[0]).map(col => `\`${col}\``).join(', ');

    let insertedCount = 0;
    for (const record of registros) {
      const values = Object.values(record);
      const placeholders = values.map(() => '?').join(', ');
      
      const insertQuery = `REPLACE INTO Testmantra (${columns}) VALUES (${placeholders})`;
      
      try {
        await conn.query(insertQuery, values);
        console.log(`Orden ${record.OrdenId} (${record.Producto}) insertada con éxito.`);
        insertedCount++;
      } catch (err) {
        console.error(`Error insertando la orden ${record.OrdenId}:`, err.message);
      }
    }

    console.log(`\nProceso completado. Se copiaron ${insertedCount} registros a Testmantra.`);

    await conn.end();
  } catch (error) {
    console.error('Error general:', error.message);
  }
})();