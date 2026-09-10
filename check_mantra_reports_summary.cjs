const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [r] = await pool.query(`
      SELECT 
        DATE(fecha_envio) as fecha_envio_utc,
        DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as fecha_envio_lima,
        nombre_plantilla_alias,
        COUNT(*) as total
      FROM REPORTE_PLANTILLAS_MANTRA
      GROUP BY DATE(fecha_envio), DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')), nombre_plantilla_alias
      ORDER BY fecha_envio_lima DESC
    `);
    console.table(r);

    const [dupsAllMantra] = await pool.query(`
      SELECT 
        codigo_pedido,
        telefono,
        nombre_plantilla_alias,
        DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) as dia_envio_lima,
        COUNT(*) as envios_mantra,
        GROUP_CONCAT(DATE_FORMAT(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'), '%H:%i:%s') SEPARATOR ' , ') as horas_envio
      FROM REPORTE_PLANTILLAS_MANTRA
      GROUP BY codigo_pedido, telefono, nombre_plantilla_alias, DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00'))
      HAVING COUNT(*) > 1
      ORDER BY envios_mantra DESC
      LIMIT 25
    `);
    console.log(`\n=== DUPLICADOS TOTALES HISTORICOS EN MANTRA (${dupsAllMantra.length}) ===`);
    console.table(dupsAllMantra);

    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
})();
