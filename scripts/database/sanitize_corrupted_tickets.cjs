const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== SANEAMIENTO DE TICKETS CORRUPTOS EN HISTORIAL_CHATS_MANTRA ===\n');

    // 1. Detección antes de saneamiento
    const [corruptosAntes] = await pool.query(`
      SELECT ticket, COUNT(*) as total
      FROM HISTORIAL_CHATS_MANTRA
      WHERE ticket IN ('Lima', 'Callao', 'N/A') 
         OR ticket REGEXP '^[A-Za-z ]+$'
      GROUP BY ticket;
    `);
    console.log('1. Registros corruptos detectados:');
    console.table(corruptosAntes);

    // 2. Actualizar HISTORIAL_CHATS_MANTRA cruzando con vw_winordetraba por orden_id
    console.log('\n2. Corrigiendo HISTORIAL_CHATS_MANTRA por orden_id...');
    const [updHist] = await pool.query(`
      UPDATE HISTORIAL_CHATS_MANTRA h
      INNER JOIN vw_winordetraba ot ON h.orden_id = ot.OrdenId
      SET h.ticket = ot.CodiSegui
      WHERE (h.ticket IN ('Lima', 'Callao', 'N/A') OR h.ticket REGEXP '^[A-Za-z ]+$')
        AND ot.CodiSegui IS NOT NULL AND ot.CodiSegui <> '';
    `);
    console.log(`✔ Filas corregidas en HISTORIAL_CHATS_MANTRA por orden_id: ${updHist.affectedRows}`);

    // 2.1 Fallback: Corregir por telefono + fecha_gestion_dia si orden_id era nulo o no cruzó
    console.log('\n2.1 Corrigiendo por teléfono y fecha en HISTORIAL_CHATS_MANTRA...');
    const [updHistPhone] = await pool.query(`
      UPDATE HISTORIAL_CHATS_MANTRA h
      INNER JOIN vw_winordetraba ot ON (
        h.phone = ot.TeleMovilNume 
        AND h.fecha_gestion_dia = CAST(ot.\`F.Soli\` AS DATE)
      )
      SET h.ticket = ot.CodiSegui,
          h.orden_id = ot.OrdenId
      WHERE (h.ticket IN ('Lima', 'Callao', 'N/A') OR h.ticket REGEXP '^[A-Za-z ]+$' OR h.ticket IS NULL)
        AND ot.CodiSegui IS NOT NULL AND ot.CodiSegui <> '';
    `);
    console.log(`✔ Filas corregidas en HISTORIAL_CHATS_MANTRA por teléfono: ${updHistPhone.affectedRows}`);

    // 3. Corregir también REPORTE_PLANTILLAS_MANTRA
    console.log('\n3. Corrigiendo REPORTE_PLANTILLAS_MANTRA...');
    const [updReporte] = await pool.query(`
      UPDATE REPORTE_PLANTILLAS_MANTRA r
      INNER JOIN vw_winordetraba ot ON r.orden_id = ot.OrdenId
      SET r.codigo_pedido = ot.CodiSegui
      WHERE (r.codigo_pedido IN ('Lima', 'Callao', 'N/A') OR r.codigo_pedido REGEXP '^[A-Za-z ]+$')
        AND ot.CodiSegui IS NOT NULL AND ot.CodiSegui <> '';
    `);
    console.log(`✔ Filas corregidas en REPORTE_PLANTILLAS_MANTRA: ${updReporte.affectedRows}`);

    // 4. Verificación post-saneamiento
    const [corruptosDespues] = await pool.query(`
      SELECT ticket, COUNT(*) as total
      FROM HISTORIAL_CHATS_MANTRA
      WHERE ticket IN ('Lima', 'Callao', 'N/A') 
         OR ticket REGEXP '^[A-Za-z ]+$'
      GROUP BY ticket;
    `);
    console.log('\n4. Registros corruptos restantes en HISTORIAL_CHATS_MANTRA:');
    console.table(corruptosDespues);

    // 5. Verificar muestra de las 3 órdenes de la imagen (3554660, 3554963, 3554914)
    const [muestra] = await pool.query(`
      SELECT id, orden_id, ticket, phone, cliente_nombre, distrito, provincia, grupo_servicio
      FROM HISTORIAL_CHATS_MANTRA
      WHERE orden_id IN (3554660, 3554963, 3554914);
    `);
    console.log('\n5. Estado actual de las órdenes del reporte (deben tener CodiSegui numérico):');
    console.table(muestra);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error en saneamiento:', err.message);
    process.exit(1);
  }
})();
