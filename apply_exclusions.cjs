const fs = require('fs');

// Lista de teléfonos a excluir de Instalaciones proporcionados por el usuario
const EXCLUDED_INSTALACIONES_PHONES = new Set([
  '900074697',
  '900111032',
  '912162460',
  '915039082',
  '916455664',
  '922988227',
  '933319223',
  '941704458',
  '942918161',
  '957239541',
  '957308925',
  '963315180',
  '969585527',
  '980941432',
  '981016816',
  '992335486',
  '994765988',
  '999900863'
]);

const rawData = JSON.parse(fs.readFileSync('clientes_no_debieron_enviarse.json', 'utf8'));

console.log(`Total original en archivo: ${rawData.length} registros`);

const dataFiltrada = rawData.filter(item => {
  const esInsta = item.Tipo_Categoria === 'INSTALACION' || item.Tipo_Categoria === 'PROVINCIA';
  const telefono = item.Telefono;

  // Si es instalación y está en la lista de exclusión, lo removemos
  if (esInsta && EXCLUDED_INSTALACIONES_PHONES.has(telefono)) {
    return false;
  }
  return true;
});

const excluidosCount = rawData.length - dataFiltrada.length;
console.log(`Total excluidos de Instalaciones: ${excluidosCount} registros`);
console.log(`Total resultante para Fe de Erratas: ${dataFiltrada.length} registros`);

// Guardar los nuevos JSON y CSV limpios
fs.writeFileSync('clientes_no_debieron_enviarse.json', JSON.stringify(dataFiltrada, null, 2));

const csvHeader = 'OrdenId,Cliente,Telefono,Servicio_Producto,Tipo_Categoria,Fecha_Cita_FSoli,Hora_Cita_FSoli,Estado_Actual,Motivo_No_Debio_Enviarse\n';
const csvRows = dataFiltrada.map(m => 
  `"${m.OrdenId}","${m.Cliente ? m.Cliente.replace(/"/g, '""') : ''}","${m.Telefono}","${m.Servicio_Producto ? m.Servicio_Producto.replace(/"/g, '""') : ''}","${m.Tipo_Categoria}","${m.Fecha_Cita_FSoli}","${m.Hora_Cita_FSoli}","${m.Estado_Actual}","${m.Motivo_No_Debio_Enviarse}"`
).join('\n');
fs.writeFileSync('clientes_no_debieron_enviarse.csv', csvHeader + csvRows);

// Desglose por categoría final
const resumen = {};
dataFiltrada.forEach(d => {
  resumen[d.Tipo_Categoria] = (resumen[d.Tipo_Categoria] || 0) + 1;
});
console.log('\n=== DESGLOSE FINAL PARA FE DE ERRATAS ===');
console.table(resumen);

const telefonosUnicos = new Set(dataFiltrada.map(d => d.Telefono).filter(t => t && t.length === 9));
console.log(`Total de Teléfonos Únicos finales: ${telefonosUnicos.size}`);
