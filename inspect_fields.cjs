const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [sample] = await pool.query(`
      SELECT 
        OrdenId, 
        IdenServi, 
        Producto, 
        Direccion, 
        Localidad, 
        Provincia, 
        Region, 
        Zona, 
        Oportunidad, 
        FechaUltiEsta, 
        FechaIniVisi, 
        \`Sector Operativo\`, 
        \`Usuario Responsable\`, 
        \`Tipo Ubicación\`, 
        \`Ubicación\`, 
        Motivo, 
        Tipo, 
        Empresa 
      FROM vw_winordetraba 
      LIMIT 3
    `);
    console.log('Muestra datos vw_winordetraba:');
    console.table(sample);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
