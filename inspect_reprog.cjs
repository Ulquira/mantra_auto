const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM reprogramaciones');
    console.log('Columnas reprogramaciones:', cols.map(c => c.Field));
    const [sample] = await pool.query(`
      SELECT 
        r.id AS id_reprogramacion,
        r.fecha_registro,
        r.fecha_solicitada,
        r.turno,
        r.motivo,
        t.OrdenId,
        t.ClienteFinal,
        t.TeleMovilNume,
        t.Producto,
        t.CodiSegui,
        t.Direccion,
        t.Zona,
        t.\`Sector Operativo\` AS sector_operativo,
        t.Estado AS estado_orden,
        r.token
      FROM reprogramaciones r
      LEFT JOIN vw_winordetraba t ON r.token = t.token
      ORDER BY r.id DESC 
      LIMIT 3
    `);
    console.log('Muestra enriquecida:', sample);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
