# Contexto del proyecto

Ficha de referencia para futuras consultas. Revisada el 2026-10-23. Describe el código del repositorio; la configuración y el estado de producción pueden cambiar.

## Propósito y tecnología

API Node.js para automatizar notificaciones de WhatsApp mediante Mantra Chat, conectada a MySQL/Phoenix. CommonJS (`.cjs`), Express 5, `mysql2/promise`, `node-cron` y `dotenv`. No hay una suite unitaria estándar configurada en `package.json`; `scripts/tests/` contiene pruebas y herramientas operativas que pueden depender de la base de datos o servicios externos.

## Flujo principal

1. [mantra_webhook.cjs](./mantra_webhook.cjs) inicia Express, registra `/webhook/estado-cambiado`, `/health` y programa tareas.
2. [mantra_service.cjs](./mantra_service.cjs) contiene la lógica central: pool MySQL, lectura con caché de reglas (`CONFIG_PLANTILLAS_MANTRA` y `SECTORES_PILOTO_TRACKING`), composición de variables, deduplicación y llamadas a Mantra.
3. [mantra_cron.cjs](./mantra_cron.cjs) es un escáner batch invocable manualmente; procesa averías por ventanas horarias y reprogramaciones.
4. `runQueueCron()` consume `COLA_NOTIFICACIONES_MANTRA`, aplica ventanas/horarios y despacha órdenes elegibles.
5. [sync_all_template_reports.cjs](./sync_all_template_reports.cjs) pagina reportes de Mantra y hace upsert en `REPORTE_PLANTILLAS_MANTRA`.
6. `scripts/database/` contiene scripts de instalación/evolución de tablas, vistas, triggers e índices; `scripts/audit/`, `scripts/contingency/` y `scripts/tests/` contienen utilidades operativas.

## Reglas operativas documentadas

- Zona horaria de negocio: `America/Lima`; servicios continuos operan de 07:00 a 19:00. AVERIAS se agrupa en tramos 08, 12 y 16, con ventanas de despacho asociadas.
- Las plantillas y sus campos se configuran dinámicamente en MySQL; el modo TRACKING depende de sectores piloto.
- La cola tiene un índice único configurado por `scripts/database/setup_db_dedup_constraint.cjs`. La deduplicación de envíos consulta `LOG_NOTIFICACIONES_WSP`.
- La documentación funcional está en [README.md](./README.md); los manuales de API están en `docs/`.

## Configuración y datos

- Variables de MySQL y puerto se esperan desde el entorno; `.env` está excluido por `.gitignore`. Usar `.env.example` solo como plantilla.
- No copiar credenciales, tokens, valores de `.env`, números, nombres, contenido de mensajes ni logs con datos reales a documentación, issues o prompts.
- El servicio también contiene credenciales Mantra heredadas incrustadas en el código. Antes de cualquier cambio relacionado, migrarlas a secretos de entorno/gestor de secretos y rotarlas si siguen vigentes; no incluir sus valores en este archivo.
- Los scripts de base de datos y pruebas pueden modificar datos reales. Revisar el script y confirmar su objetivo/base de datos antes de ejecutarlos.

## Riesgos y puntos de atención observados

- El endpoint webhook no muestra autenticación en la implementación actual; protegerlo en el borde o añadir verificación de firma/credencial antes de exponerlo públicamente.
- El handler devuelve `err.message` en el cuerpo de respuestas de error. Evitar revelar detalles internos en producción.
- El despacho hace comprobación de deduplicación, llamada externa y registro en pasos separados; los bloqueos locales no coordinan múltiples instancias ni ejecuciones concurrentes del webhook.
- En `runQueueCron()`, una orden se elimina de la cola incluso si el envío devuelve fallo. Esto impide el reintento automático desde esa cola; definir una política explícita de reintentos/estado antes de cambiarlo.
- Revisar respuestas HTTP de Mantra en ambas etapas (crear contacto y enviar plantilla), la retención de logs y la idempotencia ante timeouts ambiguos.
- Hay scripts de prueba/auditoría que dependen de tablas y datos operativos, y un archivo de servicio con sufijo de máquina que parece copia local; confirmar cuál es la fuente activa antes de editar.

## Comandos

- `npm start`: servidor, webhooks y tareas programadas.
- `npm run cron`: escaneo batch manual.
- `npm run audit:today` / `npm run audit:deep`: auditorías operativas.
- No ejecutar scripts de envío o base de datos contra producción sin validar su alcance y dependencias.
