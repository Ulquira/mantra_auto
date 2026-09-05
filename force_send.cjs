const { getDbConnection, sendMantraNotification } = require('./mantra_service.cjs');

(async () => {
  const conn = await getDbConnection();
  try {
    const ordenId = 3325135;
    console.log(`Buscando orden ${ordenId} en Testmantra...`);

    const [rows] = await conn.query(`
      SELECT t.*, DATE(\`F.Soli\`) as f_date, TIME(\`F.Soli\`) as f_time, ts.Tipo as CategoriaServicioMantra
      FROM Testmantra t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE t.OrdenId = ?
    `, [ordenId]);

    if (rows.length === 0) {
      console.log(`❌ No se encontró la orden ${ordenId} en Testmantra.`);
      return;
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
      Ticket: row.CodiSegui
    });

    const result = await sendMantraNotification(row);
    console.log('Resultado del envío forzado:', result);

    if (result.success) {
      await conn.query(`
        INSERT INTO LOG_NOTIFICACIONES_WSP (OrdenId, EstadoNotificado, EnviadoExitosamente, DetallesError)
        VALUES (?, ?, ?, ?)
      `, [row.OrdenId, row.Estado || 'Agendada', 1, null]);
      console.log('✔ Envío registrado en LOG_NOTIFICACIONES_WSP.');
    } else {
      console.error('❌ Error al enviar:', result.errorDetail);
    }
  } catch (err) {
    console.error('Error general:', err.message);
  } finally {
    await conn.end();
  }
})();
