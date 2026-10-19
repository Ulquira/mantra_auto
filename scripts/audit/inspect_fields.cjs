const { pool } = require('../../mantra_service.cjs');

(async () => {
  const [cols] = await pool.query(`DESCRIBE REPORTE_PLANTILLAS_MANTRA`);
  console.log("Columnas REPORTE_PLANTILLAS_MANTRA:", cols.map(c => c.Field));

  const [sampleReport] = await pool.query(`
    SELECT *
    FROM REPORTE_PLANTILLAS_MANTRA
    WHERE DATE(CONVERT_TZ(fecha_envio, '+00:00', '-05:00')) = CURDATE()
    LIMIT 5;
  `);
  console.log('SAMPLE REPORTE_PLANTILLAS_MANTRA:');
  console.table(sampleReport);

  const [sampleLogs] = await pool.query(`
    SELECT *
    FROM LOG_NOTIFICACIONES_WSP
    WHERE DATE(fecha_envio) = CURDATE() AND EnviadoExitosamente = 1 AND DetallesError IS NULL
    LIMIT 5;
  `);
  console.log('SAMPLE LOG_NOTIFICACIONES_WSP:');
  console.table(sampleLogs);

  pool.end();
})();
