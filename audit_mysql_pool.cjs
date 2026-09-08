const { pool } = require('./mantra_service.cjs');

(async () => {
  try {
    const [vars] = await pool.query('SHOW VARIABLES');
    const filtered = vars.filter(v => 
      v.Variable_name === 'max_connections' || 
      v.Variable_name === 'wait_timeout' || 
      v.Variable_name === 'interactive_timeout' || 
      v.Variable_name === 'connect_timeout'
    );
    console.log('Variables de Conexión MySQL:');
    console.table(filtered);

    const [status] = await pool.query('SHOW STATUS WHERE Variable_name IN ("Threads_connected", "Threads_running", "Max_used_connections")');
    console.log('\nEstado de Conexiones Actuales:');
    console.table(status);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
