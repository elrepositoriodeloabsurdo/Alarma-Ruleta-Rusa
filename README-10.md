# 💣 RULETA RUSA ALARM — WakeUp OR ELSE

Sistema de alarma de consecuencias reales. Backend Node.js + Frontend React Native (simulado en HTML).

---

## ARQUITECTURA

```
[React Native App / HTML Demo]
        │
        │ POST /alarm/set  (armar)
        │ POST /alarm/cancel  (sobrevivir)
        ▼
[Node.js Backend — EL GATILLO]
        │
        ├── node-cron: cron a las HH:MM+1
        │
        ├── Si cancela a tiempo → cron se destruye. Sobreviviste.
        │
        └── Si no cancela → Math.random() → 1/6 chances
               ├── 🎯 BALA → SendGrid (renuncia) o Twitter (historial)
               └── ⚪ VACÍA → "Por hoy sobreviviste"
```

---

## SETUP BACKEND

```bash
cd alarm-backend
npm install
cp .env.example .env
# Editar .env con tus API keys
npm start
```

### .env requerido:
```
SENDGRID_API_KEY=SG.tu_key_aqui
SENDGRID_FROM=tu@correo.com
TWITTER_API_KEY=xxx
TWITTER_API_SECRET=xxx
TWITTER_ACCESS_TOKEN=xxx
TWITTER_ACCESS_SECRET=xxx
PORT=3000
```

---

## ENDPOINTS

### POST /alarm/set
Registra la alarma en el servidor. El cron se crea aquí.

```json
{
  "alarmId": "alarm_1234567890",
  "userId": "user_123",
  "alarmTime": "07:00",
  "triggerMinutes": 1,
  "config": {
    "bossEmail": "jefe@empresa.cl",
    "bossName": "Sr. García",
    "userName": "Juan Pérez",
    "companyName": "Empresa S.A.",
    "searchHistory": ["búsqueda 1", "búsqueda 2"]
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "alarmId": "alarm_1234567890",
  "alarmTime": "07:00",
  "triggerTime": "07:01",
  "message": "Alarma activa. Tienes hasta las 07:01 para desactivarla."
}
```

### POST /alarm/cancel
La app llama aquí cuando el usuario resuelve el puzzle.

```json
{ "alarmId": "alarm_1234567890" }
```

**Respuesta:**
```json
{ "success": true, "survived": true, "message": "¡Sobreviviste! Por hoy." }
```

### GET /alarm/status/:alarmId
Estado de una alarma específica.

### GET /alarms
Todas las alarmas activas (admin/debug).

---

## FLUJO DE SUPERVIVENCIA

```
Noche anterior:
  Usuario configura 7:00 AM
  App → POST /alarm/set → Servidor crea cron a las 7:01

7:00 AM:
  Frontend suena con diseño de bomba de tiempo
  Usuario tiene 30 segundos para resolver el puzzle matemático

Si resuelve el puzzle:
  App → POST /alarm/cancel → Cron destruido → 🍀 SOBREVIVIÓ

7:01 AM (si no resolvió):
  Cron se ejecuta → Math.floor(Math.random() * 6)
  Si roll === 0 (1/6 probabilidad):
    → Dispara SendGrid / Twitter API
    → 💀 GAME OVER
  Si roll !== 0:
    → 🍀 Sobrevivió (por suerte, no por mérito)
```

---

## DEMO HTML

Abrir `alarm-frontend-demo.html` directamente en el navegador.

- La alarma de demo se activa en **15 segundos** para poder probar la experiencia completa
- El puzzle matemático requiere resolver la operación para desactivar
- Si fallas o se acaba el tiempo → Ruleta Rusa → 1/6 consecuencia

---

## DEPLOY

### Railway (recomendado):
```bash
railway login
railway init
railway up
```

### Variables de entorno en Railway:
Agregar las mismas del .env en el dashboard de Railway.

### URL final:
```
https://ruleta-rusa-alarm-production.up.railway.app
```

Actualizar `BACKEND_URL` en el frontend con esta URL.

---

## CONSIDERACIONES LEGALES (en serio)

Este sistema es para uso personal y educativo. Si realmente lo usas para enviar correos a tu jefe, es tu responsabilidad. La app hace exactamente lo que dice que hace.

---

*Built with existential dread and node-cron.*
