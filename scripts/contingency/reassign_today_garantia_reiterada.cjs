require('dotenv').config();
const { pool, MANTRA_CONFIG } = require('../../mantra_service.cjs');

const URL_CREATE_CONTACT_BY_USER = "https://wbpback2pro2.mantra.chat/contacts/newbyuser";
const POSTVENTA_EMAIL = process.env.AGENT_EMAIL_POSTVENTA_LIMA || "Backofficepostventa@win.pe";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  try {
    console.log(`[START] Reasignando los 39 casos de GARANTIA / REITERADA de hoy a ${POSTVENTA_EMAIL}...`);

    const [rows] = await pool.query(`
      SELECT DISTINCT
        t.TeleMovilNume as phone,
        t.ClienteFinal as name,
        t.Producto,
        t.CodiSegui as ticket,
        l.OrdenId
      FROM LOG_NOTIFICACIONES_WSP l
      INNER JOIN vw_winordetraba t ON l.OrdenId = t.OrdenId
      WHERE (t.Producto IN ('GARANTIA', 'REITERADA', 'REITERADO'))
        AND DATE(l.fecha_envio) = CURDATE()
        AND l.EnviadoExitosamente = 1
        AND t.TeleMovilNume IS NOT NULL
    `);

    console.log(`Total teléfonos únicos a reasignar: ${rows.length}`);
    const cfg = MANTRA_CONFIG['Averias'];

    let count = 0;
    for (const r of rows) {
      const cleanPhone = String(r.phone).replace(/\D/g, '').slice(-9);
      if (cleanPhone.length !== 9) continue;

      const payload = {
        groupId: cfg.GROUP_ID,
        apiKey: cfg.API_KEY,
        userEmail: POSTVENTA_EMAIL,
        data: {
          name: r.name,
          phone: cleanPhone,
          countryCode: "51"
        }
      };

      try {
        const res = await fetch(URL_CREATE_CONTACT_BY_USER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000)
        });
        const resJson = await res.json().catch(() => ({}));
        count++;
        console.log(`✔ [${count}/${rows.length}] ${cleanPhone} (${r.ticket}) -> Asignado a ${POSTVENTA_EMAIL}`);
      } catch (err) {
        console.error(`❌ [ERROR] ${cleanPhone}: ${err.message}`);
      }

      await delay(150);
    }

    console.log(`\n✅ Proceso completado. ${count} contactos actualizados en Mantra.`);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
