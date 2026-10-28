const { pool, MAIN_TABLE, sendMantraNotification } = require('../../mantra_service.cjs');

(async () => {
  const ordenId = 3559166;
  console.log(`[FORZADO MANUAL] Buscando orden ${ordenId} en ${MAIN_TABLE}...`);

  try {
    const [rows] = await pool.query(`
      SELECT t.*, DATE(t.\`F.Soli\`) as f_date, TIME(t.\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM ${MAIN_TABLE} t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE t.OrdenId = ?
    `, [ordenId]);

    if (rows.length === 0) {
      console.error(`❌ No se encontró la orden ${ordenId} en ${MAIN_TABLE}.`);
      process.exit(1);
    }

    const row = rows[0];
    console.log('Datos de la orden:', {
      OrdenId: row.OrdenId,
      Cliente: row.ClienteFinal,
      Telefono: row.TeleMovilNume,
      Estado: row.Estado,
      Producto: row.Producto,
      Categoria: row.CategoriaServicioMantra,
      Sector: row['Sector Operativo'],
      Ticket: row.CodiSegui,
      F_Soli: row['F.Soli']
    });

    console.log('\nEjecutando sendMantraNotification...');
    const result = await sendMantraNotification(row);
    console.log('\nResultado del envío:', result);

    if (result.success && !result.skipped) {
      // 1. Guardar en LOG_NOTIFICACIONES_WSP
      const [insertLog] = await pool.query(
        'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
        [row.OrdenId, row.CodiSegui || null, row.Estado, 1, null]
      );
      console.log(`✔ Registrado en LOG_NOTIFICACIONES_WSP (InsertId: ${insertLog.insertId}).`);

      // 2. Eliminar de COLA_NOTIFICACIONES_MANTRA
      const [delCola] = await pool.query('DELETE FROM COLA_NOTIFICACIONES_MANTRA WHERE ordenId = ?', [row.OrdenId]);
      console.log(`✔ Removido de COLA_NOTIFICACIONES_MANTRA (${delCola.affectedRows} fila(s) eliminada(s)).`);
    } else if (result.skipped) {
      console.warn(`⚠ Envío omitido: ${result.errorDetail}`);
    } else {
      console.error(`❌ Falló el envío: ${result.errorDetail}`);
      await pool.query(
        'INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, CodiSegui, EstadoNotificado, EnviadoExitosamente, DetallesError) VALUES (?, ?, ?, ?, ?)',
        [row.OrdenId, row.CodiSegui || null, row.Estado, 0, result.errorDetail]
      );
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error general durante el forzado manual:', err);
    process.exit(1);
  }
})();
