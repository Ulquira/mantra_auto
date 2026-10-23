const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    const query = `
      SELECT 
        DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d') as dia_lima,
        COUNT(*) as total_casos,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') THEN 1 ELSE 0 END) as nombre_vacio,
        SUM(CASE WHEN (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') THEN 1 ELSE 0 END) as codigo_pedido_vacio,
        SUM(CASE WHEN (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') 
                  AND (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') 
                  AND (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as los_3_vacios,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') 
                   OR (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') 
                   OR (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as al_menos_uno_vacio
      FROM reporte_plantillas_mantra
      WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) >= CURDATE() - INTERVAL 3 DAY
      GROUP BY DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d')
      ORDER BY dia_lima DESC;
    `;
    const [rows] = await pool.query(query);
    console.log("=== DESGLOSE GENERAL ===");
    console.table(rows);

    // Let's also check by plantilla to see if certain templates explain the empty fields
    const queryTemplate = `
      SELECT 
        DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%Y-%m-%d') as dia_lima,
        nombre_plantilla_alias,
        COUNT(*) as total_casos,
        SUM(CASE WHEN (nombre IS NULL OR TRIM(nombre) = '') 
                  AND (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') 
                  AND (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as los_3_vacios,
        SUM(CASE WHEN (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') THEN 1 ELSE 0 END) as codigo_pedido_vacio,
        SUM(CASE WHEN (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as orden_id_vacio
      FROM reporte_plantillas_mantra
      WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) >= CURDATE() - INTERVAL 3 DAY
      GROUP BY dia_lima, nombre_plantilla_alias
      ORDER BY dia_lima DESC, total_casos DESC;
    `;
    const [rowsTemplate] = await pool.query(queryTemplate);
    console.log("\n=== DESGLOSE POR PLANTILLA ===");
    console.table(rowsTemplate);

    const queryEnriched = `
      SELECT 
        DATE_FORMAT(fecha_envio_wsp_dia, '%Y-%m-%d') as dia_lima,
        COUNT(*) as total_casos,
        SUM(CASE WHEN (nombre_mantra IS NULL OR TRIM(nombre_mantra) = '') THEN 1 ELSE 0 END) as nombre_vacio,
        SUM(CASE WHEN (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') THEN 1 ELSE 0 END) as codigo_pedido_vacio,
        SUM(CASE WHEN (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as orden_id_vacio,
        SUM(CASE WHEN (nombre_mantra IS NULL OR TRIM(nombre_mantra) = '') 
                  AND (codigo_pedido IS NULL OR TRIM(codigo_pedido) = '') 
                  AND (orden_id IS NULL OR orden_id = 0) THEN 1 ELSE 0 END) as los_3_vacios
      FROM vw_reporte_mantra_enriquecido
      WHERE fecha_envio_wsp_dia >= CURDATE() - INTERVAL 3 DAY
      GROUP BY DATE_FORMAT(fecha_envio_wsp_dia, '%Y-%m-%d')
      ORDER BY dia_lima DESC;
    `;
    const [rowsEnriched] = await pool.query(queryEnriched);
    console.log("\n=== DESGLOSE VW_REPORTE_MANTRA_ENRIQUECIDO ===");
    console.table(rowsEnriched);

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
