const fs = require('fs');
const path = require('path');
const { pool } = require('./mantra_service.cjs');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

(async () => {
  try {
    const logFiles = getAllFiles('./azure_logs_extracted').filter(f => f.endsWith('.log') || f.endsWith('.txt'));
    console.log(`Analizando ${logFiles.length} archivos de log de Azure...\n`);

    const orderIdSet = new Set();
    const phoneMap = new Map(); // ordenId -> { phone, name }

    const orderRegex = /Procesando Orden:\s*(\d+)\s*-\s*([^(]+)\s*\((\d+)\)/g;

    for (const file of logFiles) {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = orderRegex.exec(content)) !== null) {
        const ordenId = parseInt(match[1], 10);
        const name = match[2].trim();
        const phone = match[3].trim();
        orderIdSet.add(ordenId);
        phoneMap.set(ordenId, { name, phone });
      }
    }

    const orderIds = Array.from(orderIdSet);
    console.log(`Total de OrdenIds únicos encontrados en los logs de Azure: ${orderIds.length}`);

    if (orderIds.length === 0) {
      console.log('No se encontraron logs de órdenes.');
      process.exit(0);
    }

    // Consultamos en la BD los datos de estas órdenes
    const [rows] = await pool.query(`
      SELECT 
        t.OrdenId,
        t.ClienteFinal,
        t.TeleMovilNume,
        t.Producto,
        ts.Tipo as CategoriaServicio,
        DATE(t.\`F.Soli\`) as Fecha_FSoli,
        TIME(t.\`F.Soli\`) as Hora_FSoli,
        t.Estado as EstadoActual
      FROM vw_winordetraba t
      LEFT JOIN TipoServicio ts ON t.Producto = ts.Servicio
      WHERE t.OrdenId IN (?)
    `, [orderIds]);

    console.log(`Registros encontrados en vw_winordetraba: ${rows.length}\n`);

    // Clasificamos los que NO se debieron enviar:
    // FILTRO ESTRICTO: Únicamente órdenes de Instalación y Averías cuya fecha (F.Soli) sea ANTERIOR a hoy (o sin fecha)
    const noDebieronEnviarse = rows.filter(r => {
      const esAveria = r.CategoriaServicio === 'AVERIAS';
      const esInsta = r.CategoriaServicio === 'INSTALACION' || r.CategoriaServicio === 'PROVINCIA';
      
      // Solo nos interesan Instalaciones y Averías
      if (!esAveria && !esInsta) return false;

      // Condición estricta: Fecha de cita F.Soli es estrictamente anterior a hoy (o NULL)
      // Hoy es 2026-09-07
      const fechaFSoliStr = r.Fecha_FSoli ? r.Fecha_FSoli.toISOString().slice(0, 10) : null;
      const esFechaAnterior = !fechaFSoliStr || fechaFSoliStr < '2026-09-07';

      return esFechaAnterior;
    });

    // Guardamos la lista completa en un archivo CSV/JSON para que el usuario la tenga
    const mapeoFinal = noDebieronEnviarse.map(r => ({
      OrdenId: r.OrdenId,
      Cliente: r.ClienteFinal,
      Telefono: r.TeleMovilNume ? r.TeleMovilNume.replace(/\D/g, '').slice(-9) : (phoneMap.get(r.OrdenId)?.phone || 'N/A'),
      Servicio_Producto: r.Producto,
      Tipo_Categoria: r.CategoriaServicio || 'Sin Mapear',
      Fecha_Cita_FSoli: r.Fecha_FSoli ? r.Fecha_FSoli.toISOString().slice(0, 10) : 'Sin Fecha',
      Hora_Cita_FSoli: r.Hora_FSoli || 'N/A',
      Estado_Actual: r.EstadoActual,
      Motivo_No_Debio_Enviarse: r.CategoriaServicio === 'AVERIAS' ? 'Avería con Fecha Pasada/No Hoy' : 'Instalación (Fuera de MVP)'
    }));

    fs.writeFileSync('clientes_no_debieron_enviarse.json', JSON.stringify(mapeoFinal, null, 2));

    // Generar CSV
    const csvHeader = 'OrdenId,Cliente,Telefono,Servicio_Producto,Tipo_Categoria,Fecha_Cita_FSoli,Hora_Cita_FSoli,Estado_Actual,Motivo_No_Debio_Enviarse\n';
    const csvRows = mapeoFinal.map(m => 
      `"${m.OrdenId}","${m.Cliente ? m.Cliente.replace(/"/g, '""') : ''}","${m.Telefono}","${m.Servicio_Producto ? m.Servicio_Producto.replace(/"/g, '""') : ''}","${m.Tipo_Categoria}","${m.Fecha_Cita_FSoli}","${m.Hora_Cita_FSoli}","${m.Estado_Actual}","${m.Motivo_No_Debio_Enviarse}"`
    ).join('\n');
    fs.writeFileSync('clientes_no_debieron_enviarse.csv', csvHeader + csvRows);

    console.log('=== RESUMEN DE CLIENTES MAPEOS (SOLO INSTALACIONES Y AVERÍAS) ===');
    console.log(`Total casos mapeados indebidos: ${mapeoFinal.length}`);

    const conteoPorMotivo = {};
    mapeoFinal.forEach(m => {
      const key = `${m.Tipo_Categoria} | ${m.Motivo_No_Debio_Enviarse}`;
      conteoPorMotivo[key] = (conteoPorMotivo[key] || 0) + 1;
    });
    console.table(conteoPorMotivo);

    // Teléfonos únicos
    const telefonosUnicos = new Set(mapeoFinal.map(m => m.Telefono).filter(t => t && t.length === 9));
    console.log(`\nTotal de Números de Teléfono Únicos a los que aplicaría Fe de Erratas: ${telefonosUnicos.size}`);
    console.log('\nArchivos generados con el detalle completo de clientes:');
    console.log('📁 clientes_no_debieron_enviarse.json');
    console.log('📁 clientes_no_debieron_enviarse.csv');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
