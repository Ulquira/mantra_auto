const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [stats] = await pool.query(`
      SELECT 
        count(*) as total_chats_registrados,
        sum(case when ultimo_mensaje_cliente_texto is not null then 1 else 0 end) as clientes_que_respondieron,
        sum(case when tuvo_respuesta = 0 and ultimo_mensaje_cliente_texto is not null then 1 else 0 end) as actualmente_en_espera,
        sum(case when tuvo_respuesta = 1 and ultimo_mensaje_cliente_texto is not null then 1 else 0 end) as atendidos_con_respuesta,
        sum(case when ultimo_mensaje_cliente_texto is null then 1 else 0 end) as solo_plantilla_sin_mensaje_cliente
      FROM HISTORIAL_CHATS_MANTRA
    `);
    console.log('=============================================================');
    console.log('📊 MÉTRICAS GLOBALES DE ATENCIÓN Y CHATS (POBLADO EN MYSQL)');
    console.log('=============================================================');
    console.table(stats);

    const [waiting] = await pool.query(`
      SELECT 
        telefono,
        cliente,
        IFNULL(asesor_asignado, 'SIN ASIGNAR') as asesor_asignado,
        CONCAT(tiempo_espera_minutos, ' min') as tiempo_en_espera,
        LEFT(ultimo_mensaje_cliente_texto, 40) as mensaje_del_cliente,
        fecha_ultimo_msg_cliente as fecha_hora_cliente
      FROM vw_monitoreo_atencion_chats
      WHERE tuvo_respuesta = 0 AND ultimo_mensaje_cliente_texto IS NOT NULL
      ORDER BY fecha_ultimo_msg_cliente DESC
      LIMIT 10
    `);
    console.log('\n=============================================================');
    console.log('⚠️ CASOS MÁS RECIENTES ESPERANDO RESPUESTA DE ASESOR:');
    console.log('=============================================================');
    console.table(waiting);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
