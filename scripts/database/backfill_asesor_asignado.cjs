const { pool } = require('../../mantra_service.cjs');

(async () => {
  try {
    console.log('=== ACTUALIZACIÓN Y BACKFILL DE ASESOR_ASIGNADO EN HISTORIAL_CHATS_MANTRA ===\n');

    const [conteoAntes] = await pool.query(`
      SELECT 
        SUM(CASE WHEN asesor_asignado IS NULL OR asesor_asignado = '' THEN 1 ELSE 0 END) as sin_asignar,
        SUM(CASE WHEN asesor_asignado IS NOT NULL AND asesor_asignado <> '' THEN 1 ELSE 0 END) as asignados
      FROM HISTORIAL_CHATS_MANTRA;
    `);
    console.log('1. Estado antes del backfill:');
    console.table(conteoAntes);

    // Actualizar con jerarquía: r.agente_asignado -> ot.Usuario Asignó -> ot.Usuario Responsable -> buzón según grupo/provincia
    const [upd] = await pool.query(`
      UPDATE HISTORIAL_CHATS_MANTRA h
      LEFT JOIN vw_winordetraba ot ON h.orden_id = ot.OrdenId
      LEFT JOIN (
        SELECT orden_id, MAX(agente_asignado) as agente_asignado, MAX(enviado_por) as enviado_por
        FROM REPORTE_PLANTILLAS_MANTRA
        WHERE orden_id IS NOT NULL
        GROUP BY orden_id
      ) r ON h.orden_id = r.orden_id
      SET h.asesor_asignado = COALESCE(
        NULLIF(TRIM(r.agente_asignado), ''),
        NULLIF(TRIM(r.enviado_por), ''),
        NULLIF(TRIM(ot.\`Usuario Asignó\`), ''),
        NULLIF(TRIM(ot.\`Usuario Responsable\`), ''),
        CASE 
          WHEN h.grupo_servicio LIKE '%Aver%' THEN 'vibanez@win.pe'
          WHEN h.provincia NOT IN ('LIMA', 'CALLAO') AND h.provincia IS NOT NULL AND h.provincia <> '' THEN 'oolivares@win.pe'
          WHEN h.grupo_servicio LIKE '%Post%' THEN 'Backofficepostventa@win.pe'
          ELSE 'jvieras@win.pe'
        END
      )
      WHERE h.asesor_asignado IS NULL OR h.asesor_asignado = '' OR h.asesor_asignado = 'Sin asignar';
    `);
    console.log(`✔ Filas actualizadas: ${upd.affectedRows}`);

    const [conteoDespues] = await pool.query(`
      SELECT 
        asesor_asignado,
        COUNT(*) as total
      FROM HISTORIAL_CHATS_MANTRA
      GROUP BY asesor_asignado
      ORDER BY total DESC
      LIMIT 15;
    `);
    console.log('\n2. Top usuarios asignados post-backfill:');
    console.table(conteoDespues);

    // Muestra de las 5 órdenes principales
    const [muestra] = await pool.query(`
      SELECT id, orden_id, ticket_pedido, telefono, cliente, asesor_asignado, grupo_servicio
      FROM vw_monitoreo_atencion_chats
      WHERE orden_id IN (3554660, 3554963, 3554914, 3554806, 3555179);
    `);
    console.log('\n3. Verificación en vw_monitoreo_atencion_chats:');
    console.table(muestra);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error en backfill de asesor:', err.message);
    process.exit(1);
  }
})();
