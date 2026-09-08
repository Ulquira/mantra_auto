const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log('=== AUDITORÍA DETALLADA DE ENVÍOS DE HOY ===\n');

    // 1. Conteo por DetallesError (Para saber si fueron llamadas reales a Mantra o Skips)
    const [byDetails] = await pool.query(`
      SELECT 
        CASE 
          WHEN DetallesError IS NULL THEN 'ENVIADO A MANTRA (ÉXITO REAL)'
          WHEN DetallesError LIKE '%Skipped%' OR DetallesError LIKE '%omitida%' OR DetallesError LIKE '%NO%' THEN 'OMITIDO/SKIPPED (NO SE ENVIÓ WSP)'
          ELSE CONCAT('ERROR: ', LEFT(DetallesError, 40))
        END as tipo_resultado,
        COUNT(*) as total
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
      GROUP BY tipo_resultado;
    `);
    console.log('1. ENVIADOS REALES VS OMITIDOS HOY:');
    console.table(byDetails);

    // 2. Desglose de los ENVIADOS REALES por categoría
    const [realSentByCategory] = await pool.query(`
      SELECT 
        CASE 
          WHEN ts.Tipo = 'AVERIAS' THEN 'Visita Tecnica (AVERIAS)'
          WHEN ts.Tipo IN ('INSTALACION', 'PROVINCIA') THEN 'Instalacion'
          WHEN ts.Tipo = 'POSTVENTA' THEN 'Postventa'
          WHEN ts.Tipo = 'NO' THEN 'Excluidos (NO)'
          ELSE 'Sin Mapear'
        END as Categoria,
        CASE 
          WHEN DATE(t.\`F.Soli\`) < CURDATE() OR t.\`F.Soli\` IS NULL THEN 'Fecha Anterior'
          WHEN DATE(t.\`F.Soli\`) = CURDATE() THEN 'Fecha de HOY'
          ELSE 'Fecha Futura'
        END as Periodo_F_Soli,
        COUNT(*) as total_real_enviado
      FROM LOG_NOTIFICACIONES_WSP l
      LEFT JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE DATE(l.fecha_envio) = CURDATE()
        AND l.DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
      GROUP BY Categoria, Periodo_F_Soli;
    `);
    console.log('\n2. MENSAJES REALMENTE ENVIADOS A MANTRA (DetallesError = NULL):');
    console.table(realSentByCategory);

    // 3. Primer y último mensaje real
    const [rangeReal] = await pool.query(`
      SELECT MIN(fecha_envio) as primer_envio, MAX(fecha_envio) as ultimo_envio, COUNT(*) as total_real
      FROM LOG_NOTIFICACIONES_WSP
      WHERE DATE(fecha_envio) = CURDATE()
        AND DetallesError IS NULL
        AND l.EnviadoExitosamente = 1
    `).catch(async () => {
      return await pool.query(`
        SELECT MIN(fecha_envio) as primer_envio, MAX(fecha_envio) as ultimo_envio, COUNT(*) as total_real
        FROM LOG_NOTIFICACIONES_WSP
        WHERE DATE(fecha_envio) = CURDATE()
          AND DetallesError IS NULL
          AND EnviadoExitosamente = 1
      `);
    });
    console.log('\n3. RANGO HORARIO DE ENVÍOS REALES:');
    console.table(rangeReal[0]);

    // 4. Estado de la cola actual
    const [queueSummary] = await pool.query(`
      SELECT 
        ts.Tipo as Categoria_TipoServicio,
        DATE(t.\`F.Soli\`) as Fecha_Soli,
        TIME(t.\`F.Soli\`) as Hora_Soli,
        COUNT(*) as cantidad_en_cola
      FROM COLA_NOTIFICACIONES_MANTRA c
      LEFT JOIN vw_winordetraba t ON c.ordenId = t.OrdenId
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      GROUP BY ts.Tipo, DATE(t.\`F.Soli\`), TIME(t.\`F.Soli\`);
    `);
    console.log('\n4. ESTADO DE LA COLA ACTUAL:');
    console.table(queueSummary);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
