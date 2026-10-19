const fs = require('fs');

try {
  const p = JSON.parse(fs.readFileSync('fe_erratas_progreso.json', 'utf8'));
  const total = Object.keys(p).length;
  const exitosos = Object.values(p).filter(x => x.success).length;
  const fallidos = Object.values(p).filter(x => !x.success).length;
  console.log(`Progreso Fe de Erratas: ${exitosos}/${total} exitosos, ${fallidos} fallidos.`);
} catch (e) {
  console.log('No se pudo leer progreso:', e.message);
}
