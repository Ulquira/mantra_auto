const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== EJECUTANDO BACKFILL DE CAMPOS FALTANTES DESDE VISTA ENRIQUECIDA ===");

    // 1. Cruce multi-nivel aprovechando la vista enriquecida (token, CodiSegui, Documento, Teléfono+Fecha)
    console.log("1. Poblando orden_id y nombre desde vw_reporte_mantra_enriquecido...");
    await pool.query("SET SESSION group_concat_max_len = 1048576;");
    const [res] = await pool.query(`
      UPDATE reporte_plantillas_mantra r
      JOIN vw_reporte_mantra_enriquecido v ON r.id = v.reporte_id
      SET 
        r.orden_id = v.orden_id,
        r.nombre = COALESCE(NULLIF(TRIM(r.nombre), ''), v.cliente_bd)
      WHERE (r.orden_id IS NULL OR r.orden_id = 0 OR r.nombre IS NULL OR TRIM(r.nombre) = '')
        AND v.orden_id IS NOT NULL
    `);
    console.log(`   ✔ Filas físicas actualizadas: ${res.affectedRows}`);

    // 2. Auditoría post-proceso en tabla física
    console.log("\n=== ESTADO EN TABLA FÍSICA (REPORTE_PLANTILLAS_MANTRA) ===");
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
