const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== INTEGRACIÓN DE orden_id EN REPORTE_PLANTILLAS_MANTRA ===");

    // 1. Verificar y agregar columna orden_id e índice
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'BD_Phoenix' 
        AND TABLE_NAME = 'reporte_plantillas_mantra' 
        AND COLUMN_NAME = 'orden_id'
    `);

    if (cols.length === 0) {
      console.log("1. Agregando columna orden_id e índice idx_rep_orden_id...");
      await pool.query(`
        ALTER TABLE reporte_plantillas_mantra 
        ADD COLUMN orden_id INT NULL AFTER codigo_pedido,
        ADD INDEX idx_rep_orden_id (orden_id)
      `);
      console.log("✔ Columna e índice creados exitosamente.");
    } else {
      console.log("1. Columna orden_id ya existe en reporte_plantillas_mantra.");
    }

    // 2. Poblar orden_id mediante token (1:1 indexado)
    console.log("\n2. Alimentando orden_id vía token...");
    const [resToken] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN vw_winordetraba w ON r.token IS NOT NULL AND r.token != '' AND r.token = w.token
      SET r.orden_id = w.OrdenId
      WHERE r.orden_id IS NULL
    `);
    console.log(`✔ Registros actualizados por token: ${resToken.affectedRows}`);

    // 3. Poblar orden_id restante vía CodiSegui
    console.log("\n3. Alimentando orden_id restante vía CodiSegui...");
    const [resCod] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN (
        SELECT CodiSegui, MAX(OrdenId) as OrdenId
        FROM vw_winordetraba
        WHERE CodiSegui IS NOT NULL AND CodiSegui != ''
        GROUP BY CodiSegui
      ) w ON r.codigo_pedido = w.CodiSegui
      SET r.orden_id = w.OrdenId
      WHERE r.orden_id IS NULL 
        AND r.codigo_pedido IS NOT NULL 
        AND r.codigo_pedido != ''
    `);
    console.log(`✔ Registros actualizados por CodiSegui: ${resCod.affectedRows}`);

    // 4. Poblar orden_id restante vía Número Documento
    console.log("\n4. Alimentando orden_id restante vía Número Documento...");
    const [resDoc] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN (
        SELECT \`Número Documento\` as doc, MAX(OrdenId) as OrdenId
        FROM vw_winordetraba
        WHERE \`Número Documento\` IS NOT NULL AND \`Número Documento\` != ''
        GROUP BY \`Número Documento\`
      ) w ON r.codigo_pedido = w.doc
      SET r.orden_id = w.OrdenId
      WHERE r.orden_id IS NULL 
        AND r.codigo_pedido IS NOT NULL 
        AND r.codigo_pedido != ''
    `);
    console.log(`✔ Registros actualizados por Número Documento: ${resDoc.affectedRows}`);

    // 5. Estadísticas finales
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_filas,
        COUNT(orden_id) as con_orden_id,
        COUNT(*) - COUNT(orden_id) as sin_orden_id,
        ROUND(COUNT(orden_id) * 100.0 / COUNT(*), 2) as porcentaje_completitud
      FROM reporte_plantillas_mantra
    `);
    console.log("\n=== ESTADÍSTICAS FINALES EN REPORTE_PLANTILLAS_MANTRA ===");
    console.table(stats);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
