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

    const data = [
      ['INTERNET FIBRA OPTICA SGI', 'INSTALACION'],
      ['INTERNET FIBRA OPTICA SGI PROV', 'PROVINCIA'],
      ['AVERIAS', 'AVERIAS'],
      ['POSTVENTA', 'POSTVENTA'],
      ['INSTALACIONES CONDOMINIO', 'INSTALACION'],
      ['MOTOWIN', 'AVERIAS'],
      ['MOTOWIN POSTVENTA', 'POSTVENTA'],
      ['AVERIAS PREFERENTE', 'AVERIAS'],
      ['INSTALACION WINBOX SGI', 'INSTALACION'],
      ['AVERIAS PROVINCIA', 'AVERIAS'],
      ['AVERIAS ALTO VALOR', 'AVERIAS'],
      ['REITERADA', 'AVERIAS'],
      ['GARANTIA', 'AVERIAS'],
      ['INTERNET FIBRA OPTICA ULTRA', 'NO'],
      ['PLANTA EXTERNA', 'NO'],
      ['EQUIPOS EN COMODATO', 'INSTALACION'],
      ['INTERNET NORTE CHICO', 'INSTALACION'],
      ['INSTALACIONES XGSPON SGI', 'INSTALACION'],
      ['PAGO ADELANTADO', 'INSTALACION'],
      ['POSTVENTA ULTRA', 'NO'],
      ['ULTRA', 'NO'],
      ['IMPLEMETACION DE PREDIO', 'NO']
    ];

    const query = 'INSERT INTO TipoServicio (Servicio, Tipo) VALUES ?';
    const [result] = await conn.query(query, [data]);
    
    console.log(`Datos insertados con éxito. Filas afectadas: ${result.affectedRows}`);
    
    await conn.end();
  } catch (error) {
    console.error('Error al insertar los datos:', error.message);
  }
})();
