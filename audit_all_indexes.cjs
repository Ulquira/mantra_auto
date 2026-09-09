const { pool, MAIN_TABLE } = require('./mantra_service.cjs');

(async () => {
  try {
    console.log("=== AUDITORÍA DE ÍNDICES EN TABLAS DEL SISTEMA ===");

    const tables = [
      'REPORTE_PLANTILLAS_MANTRA',
      'COLA_NOTIFICACIONES_MANTRA',
      'LOG_NOTIFICACIONES_WSP',
      'HISTORIAL_CHATS_MANTRA',
      MAIN_TABLE,
      'reprogramaciones',
      'TipoServicio'
    ];

    for (const tbl of tables) {
      console.log(`\n-------------------------------------------------------------`);
      console.log(`📌 TABLA: ${tbl}`);
      console.log(`-------------------------------------------------------------`);
      try {
        const [indexes] = await pool.query(`SHOW INDEX FROM ${tbl}`);
        const formatted = indexes.map(idx => ({
          Key_name: idx.Key_name,
          Column_name: idx.Column_name,
          Non_unique: idx.Non_unique === 0 ? 'UNIQUE' : 'INDEX',
          Seq_in_index: idx.Seq_in_index,
          Collation: idx.Collation,
          Cardinality: idx.Cardinality
        }));
        console.table(formatted);
      } catch (e) {
        console.log(`⚠️ No se pudo consultar índices para ${tbl}:`, e.message);
      }
    }

    // Probar EXPLAIN en las consultas clave para validar uso de índices
    console.log(`\n=============================================================`);
    console.log(`⚡ PRUEBA DE RENDIMIENTO Y EXPLAIN PLAN`);
    console.log(`=============================================================`);

    console.log(`\n1. EXPLAIN: Vista vw_reporte_mantra_enriquecido (JOIN por CodiSegui):`);
    const [explainVista] = await pool.query(`
      EXPLAIN SELECT * FROM vw_reporte_mantra_enriquecido WHERE codigo_pedido = 'AT-47331005'
    `);
    console.table(explainVista);

    console.log(`\n2. EXPLAIN: Consulta del cron de cola (runQueueCron):`);
    const [explainCola] = await pool.query(`
      EXPLAIN
      SELECT t.OrdenId, c.id as colaId
      FROM COLA_NOTIFICACIONES_MANTRA c
      INNER JOIN ${MAIN_TABLE} t ON c.ordenId = t.OrdenId
      INNER JOIN TipoServicio ts ON t.Producto = ts.Servicio
      LEFT JOIN LOG_NOTIFICACIONES_WSP l ON (
        t.OrdenId = l.OrdenId
      ) AND DATE(l.fecha_envio) = CURDATE() AND l.EnviadoExitosamente = 1
      WHERE ts.Tipo = 'AVERIAS'
        AND t.Estado IN ('Agendada', 'Pendiente', 'En camino')
        AND DATE(t.\`F.Soli\`) = CURDATE()
        AND TIME(t.\`F.Soli\`) LIKE '12%'
        AND l.id IS NULL
    `);
    console.table(explainCola);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
