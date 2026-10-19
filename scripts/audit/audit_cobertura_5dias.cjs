const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    const query = `
      SELECT 
          ts.Tipo as TipoServicio,
          COUNT(t.OrdenId) as TotalCasos,
          SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) as CasosEnviados,
          ROUND((SUM(CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END) / COUNT(t.OrdenId)) * 100, 2) as PorcentajeEnviado
      FROM vw_winordetraba t
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON l.OrdenId = t.OrdenId 
          AND DATE(l.fecha_envio) = CURDATE() 
          AND l.EnviadoExitosamente = 1 
          AND l.DetallesError IS NULL
      WHERE DATE(t.\`F.Soli\`) = CURDATE()
          AND ts.Tipo IN ('AVERIAS', 'INSTALACION', 'PROVINCIA', 'AVERIAS PRV')
      GROUP BY ts.Tipo;
    `;
    
    const [rows] = await pool.query(query);
    console.log("=== % DE COBERTURA (TOTAL CASOS HOY vs ENVIADOS) ===");
    console.table(rows);
    
    process.exit(0);
  } catch(e) {
    console.error("Error:", e.message);
    process.exit(1);
  }
})();
