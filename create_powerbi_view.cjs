const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const viewSql = `
      CREATE OR REPLACE VIEW vw_powerbi_ordenes_activas AS
      SELECT 
        OrdenId,
        CodiSegui,
        CodiSeguiClien,
        ClienteFinal,
        TeleMovilNume,
        Producto,
        TipoOrden,
        TipoTraba,
        Estado,
        \`F.Soli\` AS FechaSolicitud,
        DATE(\`F.Soli\`) AS FechaSolicitud_Dia,
        TIME(\`F.Soli\`) AS FechaSolicitud_Hora,
        \`F.Visita\` AS FechaVisita,
        \`Sector Operativo\` AS SectorOperativo,
        Region,
        Zona,
        Provincia,
        Localidad,
        Cuadrilla_nombre AS Cuadrilla,
        token
      FROM vw_winordetraba
      WHERE \`F.Soli\` >= DATE_SUB(CURDATE(), INTERVAL 90 DAY);
    `;

    await pool.query(viewSql);
    console.log("✔ Vista vw_powerbi_ordenes_activas creada exitosamente.");

    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM vw_powerbi_ordenes_activas");
    console.log(`Total registros en vista ligera: ${rows[0].total}`);

    process.exit(0);
  } catch (err) {
    console.error("Error al crear la vista:", err.message);
    process.exit(1);
  }
})();
