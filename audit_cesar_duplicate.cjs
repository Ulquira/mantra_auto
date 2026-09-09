const { pool, MANTRA_CONFIG } = require('./mantra_service.cjs');

(async () => {
  try {
    const phone = '933881849';
    const ticket = 'VTEXT-47327277';

    console.log(`=== AUDITORÍA DEL CLIENTE CESAR (${phone} / ${ticket}) ===`);

    const [ordenes] = await pool.query(`
      SELECT OrdenId, CodiSegui, ClienteFinal, TeleMovilNume, Estado, \`F.Soli\`, FechaUltiEsta, \`Sector Operativo\`
      FROM vw_winordetraba
      WHERE TeleMovilNume LIKE ? OR CodiSegui LIKE ?
    `, [`%${phone}%`, `%${ticket}%`]);
    console.log('\n1. Datos en vw_winordetraba:');
    console.table(ordenes);

    if (ordenes.length > 0) {
      const ordenId = ordenes[0].OrdenId;
      const [logs] = await pool.query(`
        SELECT id, OrdenId, CodiSegui, EstadoNotificado, DATE_FORMAT(fecha_envio, '%Y-%m-%d %H:%i:%s') as f_envio, EnviadoExitosamente, DetallesError
        FROM LOG_NOTIFICACIONES_WSP
        WHERE OrdenId = ? OR CodiSegui = ?
        ORDER BY id ASC
      `, [ordenId, ordenes[0].CodiSegui]);
      console.log('\n2. Todos los logs registrados para esta orden:');
      console.table(logs);
    }

    // Historial de mensajes en Mantra
    const resHistory = await fetch('https://wbpback2pro2.mantra.chat/contacts/chats/historial', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + MANTRA_CONFIG.Averias.API_KEY,
        'GroupId': MANTRA_CONFIG.Averias.GROUP_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        countryCode: '51',
        phone: phone,
        page: 1,
        limit: 10
      })
    });
    const historyData = await resHistory.json();
    console.log('\n3. Mensajes en Mantra para este número:');
    if (historyData.data) {
      console.table(historyData.data.map(m => ({
        sender: m.sender,
        status: m.status,
        text: m.content?.text?.slice(0, 60) || m.content?.templateName || 'Template/Media',
        createdAt: m.createdAt
      })));
    } else {
      console.log(historyData);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
