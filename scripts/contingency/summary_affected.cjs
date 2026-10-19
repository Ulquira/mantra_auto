const fs = require('fs');

const data = JSON.parse(fs.readFileSync('clientes_no_debieron_enviarse.json', 'utf8'));

console.log('=== DISTRIBUCIÓN POR FECHAS DE CITA (F.SOLI) ===');
const porFecha = {};
const porEstado = {};

data.forEach(d => {
  porFecha[d.Fecha_Cita_FSoli] = (porFecha[d.Fecha_Cita_FSoli] || 0) + 1;
  porEstado[d.Estado_Actual] = (porEstado[d.Estado_Actual] || 0) + 1;
});

console.log('\nPor Fecha de Cita:');
console.table(porFecha);

console.log('\nPor Estado Actual en BD:');
console.table(porEstado);
