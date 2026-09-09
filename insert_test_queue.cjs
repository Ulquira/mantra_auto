const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    const TEST_PHONE = '935434175';
    const TEST_ORDEN_ID = 9999901;

    console.log(`=== PREPARANDO CASO DE PRUEBA EN COLA PARA EL NÚMERO ${TEST_PHONE} ===`);

    // 1. Limpiar cualquier registro previo de prueba en LOG para permitir envío regular
    await pool.query('DELETE FROM LOG_NOTIFICACIONES_WSP WHERE OrdenId = ? OR CodiSegui = ?', [TEST_ORDEN_ID, 'TEST-REGULAR-01']);

    // 2. Insertar o actualizar la orden de prueba en la tabla principal (vw_winordetraba)
    // Con F.Soli en horario actual para que el tramo activo lo tome o la cola lo procese
    const hoyStr = new Date().toISOString().slice(0, 10);
    
    // Determinar la hora actual en Perú
    const options = { timeZone: 'America/Lima', hour12: false, hour: 'numeric' };
    const formatter = new Intl.DateTimeFormat([], options);
    const horaActual = parseInt(formatter.format(new Date()), 10);
    
    let tramoHora = '08:00:00';
    if (horaActual >= 11 && horaActual <= 13) tramoHora = '12:00:00';
    else if (horaActual >= 15 && horaActual <= 17) tramoHora = '16:00:00';
    else if (horaActual >= 7 && horaActual <= 9) tramoHora = '08:00:00';
    else tramoHora = `${String(horaActual).padStart(2, '0')}:00:00`;

    const fSoliCompleta = `${hoyStr} ${tramoHora}`;

    console.log(`📅 Fecha/Hora asignada a la cita: ${fSoliCompleta} (Hora actual Perú: ${horaActual}h)`);

    // Insertar en vw_winordetraba
    await pool.query(`
      INSERT INTO ${MAIN_TABLE} (
        OrdenId, CodiSegui, ClienteFinal, TeleMovilNume, Producto, Estado, \`F.Soli\`, Direccion, \`Sector Operativo\`, IdenServi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        ClienteFinal = VALUES(ClienteFinal),
        TeleMovilNume = VALUES(TeleMovilNume),
        Producto = VALUES(Producto),
        Estado = VALUES(Estado),
        \`F.Soli\` = VALUES(\`F.Soli\`),
        Direccion = VALUES(Direccion),
        \`Sector Operativo\` = VALUES(\`Sector Operativo\`),
        IdenServi = VALUES(IdenServi)
    `, [
      TEST_ORDEN_ID,
      'TEST-REGULAR-01',
      'TONNY BOTENVIO TEST',
      TEST_PHONE,
      'AVERIAS',
      'Agendada',
      fSoliCompleta,
      'Av. República de Panamá 1234, San Isidro',
      'LIMA - OESTE 2',
      'Paquete: Plan Win Fibra 500 Mbps'
    ]);

    console.log('✅ Orden insertada/actualizada en la tabla principal.');

    // 3. Insertar explícitamente en la cola (por si el trigger fue bypass o para prueba directa)
    await pool.query('INSERT INTO COLA_NOTIFICACIONES_MANTRA (ordenId) VALUES (?)', [TEST_ORDEN_ID]);
    console.log('✅ Caso insertado en COLA_NOTIFICACIONES_MANTRA.');

    // 4. Verificar cola actual
    const [cola] = await pool.query('SELECT * FROM COLA_NOTIFICACIONES_MANTRA WHERE ordenId = ?', [TEST_ORDEN_ID]);
    console.log('\n📌 Registro en cola:', cola);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
