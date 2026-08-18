process.env.TZ = 'America/Lima';

const express = require('express');
const cron = require('node-cron');
const { processOrderById, runCron } = require('./mantra_service.cjs');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TIMEZONE = 'America/Lima';

// 1. Cron de las 8:00 PM (20:00 hora Perú) -> Envía órdenes agendadas para el DÍA SIGUIENTE
cron.schedule('0 20 * * *', async () => {
  console.log("⏰ [CRON 8:00 PM] Disparando envío de WhatsApps para las órdenes del DÍA SIGUIENTE...");
  await runCron('NEXT_DAY');
}, { timezone: TIMEZONE });

// 2. Cron cada 15 minutos de 7:00 AM a 6:00 PM (18:00 hora Perú) -> Envía órdenes agendadas para el MISMO DÍA
cron.schedule('*/15 7-18 * * *', async () => {
  console.log("⏰ [CRON 15 MIN] Escaneo diurno de órdenes del MISMO DÍA...");
  await runCron('SAME_DAY');
}, { timezone: TIMEZONE });

console.log(`⏰ Programador Cron configurado (Zona Horaria: ${TIMEZONE}):`);
console.log(`   - Diariamente a las 20:00: Órdenes del DÍA SIGUIENTE`);
console.log(`   - Cada 15 min (07:00 - 18:00): Órdenes del MISMO DÍA`);

// Endpoint Webhook para recibir notificaciones por evento/cambio de estado
app.post('/webhook/estado-cambiado', async (req, res) => {
  const { ordenId, estado } = req.body;

  if (!ordenId) {
    return res.status(400).json({
      error: 'Parámetro "ordenId" es requerido.'
    });
  }

  // Si se envía el estado y no es 'Agendada', omitir
  if (estado && estado !== 'Agendada') {
    return res.status(200).json({
      message: `La orden ${ordenId} cambió al estado '${estado}'. No requiere notificación por WhatsApp.`
    });
  }

  console.log(`\n[WEBHOOK] Evento recibido para la orden ${ordenId} (Estado: ${estado || 'Agendada'})`);

  try {
    const result = await processOrderById(ordenId);

    if (result.success) {
      return res.status(200).json({
        ok: true,
        message: `Notificación enviada exitosamente para la orden ${ordenId}.`,
        data: result
      });
    } else {
      return res.status(400).json({
        ok: false,
        message: result.message || `No se pudo enviar la notificación para la orden ${ordenId}.`,
        details: result.errorDetail
      });
    }
  } catch (err) {
    console.error(`[ERROR WEBHOOK] Error procesando la orden ${ordenId}:`, err.message);
    return res.status(500).json({
      error: 'Error interno del servidor.',
      details: err.message
    });
  }
});

// Root route para probes de inicio de Azure App Service
app.get('/', (req, res) => {
  res.status(200).send('API Mantra WhatsApp Webhook is Running');
});

// Healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Webhook corriendo en el puerto ${PORT}`);
  console.log(`📌 Endpoint para cambio de estado: POST /webhook/estado-cambiado`);
});
