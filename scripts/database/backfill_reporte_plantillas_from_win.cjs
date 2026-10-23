const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== EJECUTANDO BACKFILL DE CAMPOS FALTANTES ===");

    // 1. Cruce por token
    console.log("1. Cruce por token...");
    const [resToken] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN vw_winordetraba w ON r.token IS NOT NULL AND r.token != '' AND r.token = w.token
      SET 
        r.orden_id = COALESCE(r.orden_id, w.OrdenId),
        r.nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), w.ClienteFinal)
      WHERE (r.orden_id IS NULL OR r.nombre IS NULL OR TRIM(r.nombre) = '')
    `);
    console.log(`   ✔ Filas actualizadas por token: ${resToken.affectedRows}`);

    // 2. Cruce por CodiSegui numérico
    console.log("2. Cruce por CodiSegui...");
    const [resCod] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN (
        SELECT CodiSegui, MAX(OrdenId) as OrdenId, MAX(ClienteFinal) as ClienteFinal
        FROM vw_winordetraba
        WHERE CodiSegui IS NOT NULL AND CodiSegui != ''
        GROUP BY CodiSegui
      ) w ON r.codigo_pedido = w.CodiSegui
      SET 
        r.orden_id = COALESCE(r.orden_id, w.OrdenId),
        r.nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), w.ClienteFinal)
      WHERE (r.orden_id IS NULL OR r.nombre IS NULL OR TRIM(r.nombre) = '')
        AND r.codigo_pedido REGEXP '^[0-9]+$'
    `);
    console.log(`   ✔ Filas actualizadas por CodiSegui: ${resCod.affectedRows}`);

    // 3. Auditoría post-proceso
    console.log("\n=== ESTADO POST-PROCESAMIENTO (ÚLTIMOS 3 DÍAS) ===");
    const [postAudit] = await pool.query(`
      SELECT 
        DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d') as dia_lima,
        COUNT(*) as total_casos,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') THEN 1 ELSE 0 END) as nombre_vacio,
        SUM(CASE WHEN (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') THEN 1 ELSE 0 END) as codigo_pedido_vacio,
        SUM(CASE WHEN (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') 
                  AND (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') 
                  AND (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as los_3_vacios
      FROM reporte_plantillas_mantra
      WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) >= CURDATE() - INTERVAL 3 DAY
      GROUP BY DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d')
      ORDER BY dia_lima DESC;
    `);
    console.table(postAudit);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error durante el backfill:", err.message);
    process.exit(1);
  }
})();
