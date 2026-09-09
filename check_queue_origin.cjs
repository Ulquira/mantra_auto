const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [cola] = await pool.query('SELECT * FROM COLA_NOTIFICACIONES_MANTRA ORDER BY id DESC LIMIT 50');
    console.log(`=== TOTAL REGISTROS EN COLA: ${cola.length} ===`);
    console.log(cola);

    if (cola.length > 0) {
      const ordenIds = cola.map(c => c.ordenId);
      const [ordenes] = await pool.query(`
        SELECT 
          t.OrdenId, 
          t.Estado, 
          t.ClienteFinal, 
          t.Producto, 
          ts.tipo as TipoServicioBD,
          t.\`F.Soli\` as f_soli, 
          t.FechaUltiEsta, 
          t.\`Sector Operativo\` as SectorOperativo
        FROM vw_winordetraba t
        LEFT JOIN tiposervicio ts ON t.Producto = ts.Servicio
        WHERE t.OrdenId IN (?)
      `, [ordenIds]);
      console.log('\n=== DETALLE DE LAS ÓRDENES EN COLA (DESDE vw_winordetraba) ===');
      console.table(ordenes);
    }

    // Revisar triggers activos
    const [triggers] = await pool.query('SHOW TRIGGERS');
    console.log('\n=== TRIGGERS ACTIVOS EN LA BD ===');
    console.log(triggers.map(t => ({ Trigger: t.Trigger, Event: t.Event, Table: t.Table, Statement: t.Statement })));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
