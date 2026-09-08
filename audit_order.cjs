const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [row] = await pool.query(`
      SELECT t.OrdenId, t.Estado, t.ClienteFinal, t.TeleMovilNume, t.Producto, ts.Tipo, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time
      FROM vw_winordetraba t 
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio 
      WHERE t.OrdenId IN (3418671, 3419719, 3419720, 3419656)
    `);
    console.log('Detalles de las últimas órdenes enviadas:');
    console.table(row);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
