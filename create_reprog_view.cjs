const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('1. Verificando e indexando tabla reprogramaciones...');
    try {
      await conn.query('CREATE INDEX idx_reprog_token ON reprogramaciones(token)');
      console.log('   ✅ Índice idx_reprog_token creado en reprogramaciones(token).');
    } catch (e) {
      console.log('   ℹ️ Índice idx_reprog_token ya existía.');
    }

    try {
      await conn.query('CREATE INDEX idx_reprog_fecha_sol ON reprogramaciones(fecha_solicitada)');
      console.log('   ✅ Índice idx_reprog_fecha_sol creado en reprogramaciones(fecha_solicitada).');
    } catch (e) {
      console.log('   ℹ️ Índice idx_reprog_fecha_sol ya existía.');
    }

    try {
      await conn.query('CREATE INDEX idx_reprog_fecha_reg ON reprogramaciones(fecha_registro)');
      console.log('   ✅ Índice idx_reprog_fecha_reg creado en reprogramaciones(fecha_registro).');
    } catch (e) {
      console.log('   ℹ️ Índice idx_reprog_fecha_reg ya existía.');
    }

    console.log('\n2. Verificando índice en vw_winordetraba(token)...');
    try {
      await conn.query('CREATE INDEX idx_vw_token ON vw_winordetraba(token)');
      console.log('   ✅ Índice idx_vw_token creado en vw_winordetraba(token).');
    } catch (e) {
      console.log('   ℹ️ Índice en vw_winordetraba(token) ya existía.');
    }

    console.log('\n3. Creando vista optimizada: vw_reprogramaciones_detalle...');
    await conn.query(`
      CREATE OR REPLACE VIEW vw_reprogramaciones_detalle AS
      SELECT 
        r.id AS id_reprogramacion,
        r.fecha_registro,
        r.fecha_solicitada AS nueva_fecha_cita,
        r.turno AS nuevo_turno,
        r.motivo AS motivo_reprogramacion,
        t.OrdenId AS orden_id,
        t.CodiSegui AS ticket_seguimiento,
        t.ClienteFinal AS cliente,
        t.TeleMovilNume AS telefono,
        t.Producto AS producto_servicio,
        SUBSTRING_INDEX(t.Direccion, '||', 1) AS direccion,
        t.Zona AS distrito_zona,
        t.\`Sector Operativo\` AS sector_operativo,
        t.Cuadrilla_nombre AS tecnico_asignado,
        t.Estado AS estado_actual_orden,
        DATE(t.\`F.Soli\`) AS fecha_cita_original,
        TIME(t.\`F.Soli\`) AS turno_cita_original,
        CONCAT('https://go.win.pe/seguimiento/', r.token) AS link_seguimiento,
        r.token
      FROM reprogramaciones r
      LEFT JOIN vw_winordetraba t ON r.token = t.token;
    `);
    console.log('   ✅ Vista vw_reprogramaciones_detalle creada exitosamente.');

    console.log('\n4. Validando consulta a la vista...');
    const [rows] = await conn.query('SELECT * FROM vw_reprogramaciones_detalle ORDER BY id_reprogramacion DESC LIMIT 5');
    console.table(rows);

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
