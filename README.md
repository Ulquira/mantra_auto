# 📲 API Mantra - Automatización de Notificaciones WhatsApp (Producción)

Módulo independiente para la automatización, sincronización de contactos y envío automático de plantillas de WhatsApp a través de la API de **Mantra**.

---

## 🚀 Descripción del Proyecto

Este proyecto monitorea en tiempo real las órdenes en estado `Pendiente` en la tabla productiva `vw_winordetraba` mediante Triggers de MySQL y una cola de eventos (`COLA_NOTIFICACIONES_MANTRA`). Valida el tramo horario, el tipo de servicio en `tiposervicio` (Averías), formatea los campos requeridos (ticket, fecha, rango horario, dirección y enlace único de seguimiento), actualiza el contacto en Mantra y dispara la plantilla de notificación por WhatsApp de manera automática.

---

## 📂 Estructura de Archivos

- **`mantra_webhook.cjs`**: Servidor principal en Express que corre en Azure App Service:
  1. Cron de Cola de eventos (cada 30s) que procesa órdenes `Pendiente` según los tramos de horario (07:00-09:00, 11:00-13:00, 15:00-17:00).
  2. Cron de Reprogramaciones (cada minuto) para la tabla `reprogramaciones`.
  3. Webhook HTTP `POST /webhook/estado-cambiado` para eventos inmediatos.
- **`mantra_service.cjs`**: Módulo core de servicios y conexión con la API de Mantra.
- **`mantra_cron.cjs`**: Script utilitario para ejecución por lotes manual.
- **`setup_production_db.cjs`**: Script de inicialización de triggers e índices en la base de datos de producción (`vw_winordetraba`).
- **`Documentacion_Mantra_API_unificada.pdf`**: Documentación oficial de la API de Mantra.
- **`mantra_docs.txt`**: Extracción en texto plano de la documentación oficial de Mantra.

---

## 🔑 Credenciales y Configuración de Mantra

- **`groupId`**: `685dc70e53dd0ac2492c69ca`
- **`apiKey`**: `3d0d59f1-f3ea-47be-b5b0-d7ffca33817d`
- **`templateId`**: `6a7a457736ef53a657fc03ed`

### Endpoints
- **Creación/Actualización de Contactos**: `https://wbpback2pro2.mantra.chat/contacts/new`
- **Envío de Plantilla**: `https://wbpback2pro2.mantra.chat/contacts/send`

---

## 📋 Mapeo de Variables Personalizadas

| Variable | Campo Origen | Descripción / Formato |
| :--- | :--- | :--- |
| **`custom_7`** | `ClienteFinal` | Nombre completo del cliente. |
| **`custom_3`** | `IdenServi` | Plan/Campaña contratado (se extrae la parte relevante). |
| **`custom_1`** | `F.Soli` (Fecha) | Día y mes en español (Ej: *11 de Agosto*). |
| **`custom_2`** | `F.Soli` (Hora) | Tramo horario traducido (Ej: `08:00` → *8AM - 12PM*, `12:00` → *12PM - 4PM*, `16:00` → *4PM - 8PM*). |
| **`custom_10`** | `token` | Enlace dinámico de seguimiento: `https://go.win.pe/seguimiento/[token]`. |

---

## 🗄️ Esquema de Base de Datos

### Tabla de Auditoría / Control: `LOG_NOTIFICACIONES_WSP`
```sql
CREATE TABLE IF NOT EXISTS LOG_NOTIFICACIONES_WSP (
  id INT AUTO_INCREMENT PRIMARY KEY,
  OrdenId INT NOT NULL,
  EstadoNotificado VARCHAR(50) NOT NULL,
  fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  EnviadoExitosamente BOOLEAN DEFAULT TRUE,
  DetallesError TEXT
);
```

---

## 🛠️ Requisitos e Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar el archivo `.env` basado en `.env.example`:
```env
DB_HOST=phx-win-mysql-9508.mysql.database.azure.com
DB_USER=phxadmin
DB_PASSWORD=TuPassword
DB_NAME=BD_Phoenix
DB_PORT=3306
```

3. Ejecutar el cron manualmente o configurarlo como tarea programada:
```bash
npm start
```
