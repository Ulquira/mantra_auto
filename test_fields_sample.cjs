const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [sample] = await pool.query(`
      SELECT 
        OrdenId,
        ClienteFinal,
        CodiSegui,
        DATE(\`F.Soli\`) as f_date,
        TIME(\`F.Soli\`) as f_time,
        Direccion,
        token,
        IdenServi,
        Producto,
        FechaUltiEsta,
        \`F.Visita\` as f_visita,
        Region,
        Provincia,
        Localidad,
        Zona,
        Empresa,
        \`Sector Operativo\` as sector_operativo,
        Tipo
      FROM vw_winordetraba
      WHERE Estado IN ('Pendiente', 'Agendada')
      LIMIT 3
    `);
    console.log('Muestra de órdenes actuales:');
    console.log(JSON.stringify(sample, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
