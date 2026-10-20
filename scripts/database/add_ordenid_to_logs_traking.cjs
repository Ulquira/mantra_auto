const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log("=== INTEGRACIÓN DE OrdenId EN logs_traking ===");

    // 1. Verificar y agregar columna OrdenId e índice
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'BD_Phoenix' 
        AND TABLE_NAME = 'logs_traking' 
        AND COLUMN_NAME = 'OrdenId'
    `);

    if (cols.length === 0) {
      console.log("1. Agregando columna OrdenId e índice idx_logs_traking_ordenid...");
      await pool.query(`
        ALTER TABLE logs_traking 
        ADD COLUMN OrdenId INT NULL AFTER id,
        ADD INDEX idx_logs_traking_ordenid (OrdenId)
      `);
      console.log("✔ Columna e índice creados exitosamente.");
    } else {
      console.log("1. Columna OrdenId ya existe en logs_traking.");
    }

    // 2. Poblar OrdenId mediante token (1:1 indexado)
    console.log("\n2. Alimentando OrdenId vía token...");
    const [resToken] = await pool.query(`
      UPDATE logs_traking l
      JOIN vw_winordetraba w ON l.token = w.token
      SET l.OrdenId = w.OrdenId
      WHERE l.OrdenId IS NULL
    `);
    console.log(`✔ Registros actualizados por token: ${resToken.affectedRows}`);

    // 3. Poblar OrdenId restante mediante fallback de CodiSegui
    console.log("\n3. Alimentando OrdenId restante vía fallback de CodiSegui...");
    const [resCod] = await pool.query(`
      UPDATE logs_traking l
      JOIN (
        SELECT CodiSegui, MAX(OrdenId) as OrdenId
        FROM vw_winordetraba
        WHERE CodiSegui IS NOT NULL AND CodiSegui != ''
        GROUP BY CodiSegui
      ) w ON l.codisegui = w.CodiSegui
      SET l.OrdenId = w.OrdenId
      WHERE l.OrdenId IS NULL 
        AND l.codisegui IS NOT NULL 
        AND l.codisegui != ''
    `);
    console.log(`✔ Registros actualizados por CodiSegui: ${resCod.affectedRows}`);

    // 4. Configurar trigger BEFORE INSERT para auto-completar OrdenId en nuevos registros
    console.log("\n4. Configurando trigger automático para futuras inserciones...");
    await pool.query("DROP TRIGGER IF EXISTS trg_logs_traking_auto_ordenid");
    await pool.query(`
      CREATE TRIGGER trg_logs_traking_auto_ordenid
      BEFORE INSERT ON logs_traking
      FOR EACH ROW
      BEGIN
        IF NEW.OrdenId IS NULL THEN
          IF NEW.token IS NOT NULL AND NEW.token != '' THEN
            SET NEW.OrdenId = (SELECT OrdenId FROM vw_winordetraba WHERE token = NEW.token LIMIT 1);
          END IF;
          IF NEW.OrdenId IS NULL AND NEW.codisegui IS NOT NULL AND NEW.codisegui != '' THEN
            SET NEW.OrdenId = (SELECT OrdenId FROM vw_winordetraba WHERE CodiSegui = NEW.codisegui ORDER BY OrdenId DESC LIMIT 1);
          END IF;
        END IF;
      END
    `);
    console.log("✔ Trigger trg_logs_traking_auto_ordenid activo.");

    // 5. Estadísticas finales
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_filas,
        COUNT(OrdenId) as con_orden_id,
        COUNT(*) - COUNT(OrdenId) as sin_orden_id,
        ROUND(COUNT(OrdenId) * 100.0 / COUNT(*), 2) as porcentaje_completitud
      FROM logs_traking
    `);
    console.log("\n=== ESTADÍSTICAS FINALES EN logs_traking ===");
    console.table(stats);

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
