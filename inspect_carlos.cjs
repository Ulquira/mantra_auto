const { pool, MANTRA_CONFIG } = require('./mantra_service.cjs');

(async () => {
  try {
    const [ordenes] = await pool.query(`
      SELECT OrdenId, CodiSegui, ClienteFinal, TeleMovilNume, Estado, \`F.Soli\`, \`Sector Operativo\`, FechaUltiEsta
      FROM vw_winordetraba 
      WHERE TeleMovilNume LIKE '%960343243%' OR CodiSegui LIKE '%47331005%'
    `);
    console.log('=== DATOS EN vw_winordetraba ===');
    console.table(ordenes);

    if (ordenes.length > 0) {
      const ordenId = ordenes[0].OrdenId;
      const [logs] = await pool.query(`
        SELECT * FROM LOG_NOTIFICACIONES_WSP WHERE OrdenId = ?
      `, [ordenId]);
      console.log('\n=== LOGS EN BD (LOG_NOTIFICACIONES_WSP) ===');
      console.table(logs);
    }

    // Consultar contacto en Mantra
    const res = await fetch('https://wbpback2pro2.mantra.chat/contacts/byphone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: MANTRA_CONFIG.Averias.GROUP_ID,
        apiKey: MANTRA_CONFIG.Averias.API_KEY,
        phone: '960343243',
        countryCode: '51'
      })
    });
    const mantraContact = await res.json();
    console.log('\n=== DATOS DEL CONTACTO EN MANTRA ===');
    console.log({
      name: mantraContact.name,
      phone: mantraContact.phone,
      contactTags: mantraContact.contactTags,
      updatedAt: mantraContact.updatedAt
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
