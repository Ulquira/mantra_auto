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
        Region,
        Provincia,
        Localidad,
        Zona,
        Empresa,
        'LIMA - OESTE 2' as \`Sector Operativo\`
      FROM Testmantra
      LIMIT 1
    `);

    if (sample.length === 0) {
      console.log('No hay registros en Testmantra');
      process.exit(0);
    }

    const row = sample[0];
    console.log('Simulando payload homologado para OESTE 2:\n', row);

    // Requerir mantra_service
    const service = require('./mantra_service.cjs');
    console.log('\nVerificación de sintaxis de mantra_service.cjs exitosa.');

    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
