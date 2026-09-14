const { MANTRA_CONFIG, buildHomologatedCustomData } = require('./mantra_service.cjs');

console.log("=== PRUEBA DE EVALUACIÓN DE SECTORES OESTE ===");

const credentials = MANTRA_CONFIG.Averias;

const testSectores = [
  { sector: 'LIMA - OESTE 1', esperado: 'OESTE2_TEMPLATE + TRAKING' },
  { sector: 'LIMA - OESTE 2', esperado: 'OESTE2_TEMPLATE + TRAKING' },
  { sector: 'LIMA - OESTE-1', esperado: 'OESTE2_TEMPLATE + TRAKING' },
  { sector: 'LIMA - OESTE -2', esperado: 'OESTE2_TEMPLATE + TRAKING' },
  { sector: 'CHICLAYO - OESTE 1', esperado: 'DEFAULT (No es Lima)' },
  { sector: 'HUARAL - OESTE', esperado: 'DEFAULT (No es Lima)' },
  { sector: 'LIMA - OESTE 3', esperado: 'DEFAULT (Es Oeste 3)' },
  { sector: 'LIMA - SUR 1', esperado: 'DEFAULT' }
];

testSectores.forEach(t => {
  const sectorOperativo = (t.sector || '').toUpperCase();
  const isLimaOesteTracking = (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE 1')) ||
                              (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE 2')) ||
                              (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE -1')) ||
                              (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE -2')) ||
                              (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE-1')) ||
                              (sectorOperativo.includes('LIMA') && sectorOperativo.includes('OESTE-2'));
  const templateIdToUse = isLimaOesteTracking ? credentials.TEMPLATE_ID_OESTE2 : credentials.TEMPLATE_ID_DEFAULT;
  const tagIdToUse = isLimaOesteTracking ? credentials.TAG_TRAKING_ID : null;

  const resultado = isLimaOesteTracking ? 'OESTE2_TEMPLATE + TRAKING' : 'DEFAULT';
  console.log(`Sector: "${t.sector}" => Plantilla: ${templateIdToUse === credentials.TEMPLATE_ID_OESTE2 ? 'Oeste' : 'Default'} | Tag TRAKING: ${tagIdToUse ? 'SÍ' : 'NO'} | Resultado: ${resultado}`);
});
