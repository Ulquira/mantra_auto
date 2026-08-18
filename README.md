# 📲 API Mantra - Automatización de Notificaciones WhatsApp

Módulo independiente para la automatización, sincronización de contactos y envío automático de plantillas de WhatsApp a través de la API de **Mantra**.

---

## 🚀 Descripción del Proyecto

Este proyecto consulta las órdenes de instalación programadas/agendadas en la base de datos MySQL, extrae la información del cliente, formatea los campos requeridos (fecha, rango horario, plan y enlace único de seguimiento), actualiza el contacto en Mantra y dispara la plantilla de notificación por WhatsApp de manera automática.

---

## 📂 Estructura de Archivos

- **`mantra_cron.cjs`**: Script principal (CRON). Ejecuta el flujo completo:
  1. Conexión a la BD y verificación de la tabla `LOG_NOTIFICACIONES_WSP`.
  2. Selección de órdenes en estado `Agendada` sin notificar.
  3. Formateo dinámico de fecha, horario, plan y token.
  4. Creación/actualización del contacto en Mantra (`/contacts/new`).
  5. Disparo de la plantilla de WhatsApp (`/contacts/send`).
  6. Registro del estado de envío (Éxito/Fallo y detalle de error) en la tabla `LOG_NOTIFICACIONES_WSP`.
- **`setup_test_mantra.cjs`**: Script utilitario para preparar el entorno de pruebas (`Testmantra`), actualizando el número de teléfono y reiniciando el log de envíos.
- **`test_f_soli.cjs`**: Script auxiliar de verificación de campos de fecha/hora en la base de datos.
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
