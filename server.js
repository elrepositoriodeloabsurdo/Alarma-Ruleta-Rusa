/**
 * 🎰 RULETA RUSA ALARM — Backend Node.js
 * 
 * El verdadero gatillo. Este servidor ES la amenaza.
 * 
 * SETUP:
 *   npm install express node-cron @sendgrid/mail twitter-api-v2 cors dotenv
 * 
 * ENV VARS (.env):
 *   SENDGRID_API_KEY=SG.xxx
 *   SENDGRID_FROM=tu@email.com
 *   TWITTER_API_KEY=xxx
 *   TWITTER_API_SECRET=xxx
 *   TWITTER_ACCESS_TOKEN=xxx
 *   TWITTER_ACCESS_SECRET=xxx
 *   PORT=3000
 */

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const { TwitterApi } = require('twitter-api-v2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ── SendGrid Setup ──────────────────────────────────────────────────────────
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ── Twitter Setup ───────────────────────────────────────────────────────────
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
const rwClient = twitterClient.readWrite;

// ── In-memory store de alarmas activas ──────────────────────────────────────
// Estructura: { [alarmId]: { task, userId, config, status } }
const activeAlarms = new Map();

// ── Utilidades ───────────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * La Ruleta Rusa: 1 en 6 probabilidades de catástrofe.
 * Devuelve 'email' | 'twitter' | 'survived'
 */
function spinTheChamber() {
  const roll = Math.floor(Math.random() * 6); // 0-5
  if (roll === 0) return 'email';   // Bala 1: correo al jefe
  if (roll === 1) return 'twitter'; // Bala 2: Twitter público (extra modo hardcore)
  return 'survived';                // 4/6 vive para contarlo
}

/**
 * Dispara el correo de renuncia al jefe.
 */
async function fireResignationEmail(config) {
  const { bossEmail, bossName, userName, companyName, searchHistory } = config;

  const msg = {
    to: bossEmail,
    from: process.env.SENDGRID_FROM,
    subject: `Renuncia — ${userName}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 600px; margin: 40px auto; padding: 40px; border: 1px solid #ccc;">
        <p>${new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <br/>
        <p>Estimado/a ${bossName},</p>
        <br/>
        <p>Por medio de la presente, comunico mi renuncia irrevocable al cargo que he desempeñado en <strong>${companyName}</strong>, con efecto inmediato.</p>
        <br/>
        <p>Ha sido un período de aprendizaje. Sin embargo, he reflexionado y concluido que es momento de buscar nuevos horizontes.</p>
        <br/>
        <p>Atentamente,</p>
        <p><strong>${userName}</strong></p>
        <br/>
        <hr style="border: none; border-top: 1px solid #eee;"/>
        <p style="font-size: 11px; color: #999;">
          Este correo fue enviado automáticamente por Ruleta Rusa Alarm porque ${userName} 
          no desactivó su alarma a tiempo. No es un error. Es exactamente lo que debería pasar.
        </p>
      </div>
    `,
  };

  await sgMail.send(msg);
  log(`💀 EMAIL DE RENUNCIA ENVIADO a ${bossEmail} — Usuario: ${userName}`);
}

/**
 * Publica el historial de búsqueda en Twitter.
 */
async function fireTwitterNuke(config) {
  const { userName, searchHistory } = config;

  const searches = searchHistory && searchHistory.length > 0
    ? searchHistory.slice(0, 5).join(' | ')
    : '"cómo fingir estar enfermo" | "memes en horario laboral" | "trabajo desde casa sin trabajar"';

  const tweet = `🚨 RULETA RUSA ALARM — ${userName} no se despertó a tiempo.

Historial de búsquedas revelado automáticamente:
${searches}

Esto es lo que pasa cuando snoozeás demasiado. #RuletaRusaAlarm`;

  await rwClient.v2.tweet(tweet);
  log(`💀 TWEET CATASTRÓFICO publicado — Usuario: ${userName}`);
}

// ── ENDPOINTS ────────────────────────────────────────────────────────────────

/**
 * POST /alarm/set
 * Body: {
 *   alarmId: string,
 *   userId: string,
 *   alarmTime: "HH:MM",         // hora local del usuario
 *   triggerMinutes: number,      // minutos de gracia (default: 1)
 *   config: {
 *     bossEmail, bossName, userName, companyName, searchHistory
 *   }
 * }
 */
app.post('/alarm/set', (req, res) => {
  const { alarmId, userId, alarmTime, triggerMinutes = 1, config } = req.body;

  if (!alarmId || !alarmTime || !config) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  // Cancelar alarma anterior del mismo ID si existe
  if (activeAlarms.has(alarmId)) {
    activeAlarms.get(alarmId).task.stop();
    activeAlarms.delete(alarmId);
    log(`⚠️  Alarma ${alarmId} reemplazada`);
  }

  // Parsear hora de alarma y calcular tiempo de ejecución del cron
  const [alarmHour, alarmMin] = alarmTime.split(':').map(Number);
  let triggerDate = new Date();
  triggerDate.setHours(alarmHour, alarmMin + triggerMinutes, 0, 0);

  // Si ya pasó, mover a mañana
  if (triggerDate <= new Date()) {
    triggerDate.setDate(triggerDate.getDate() + 1);
  }

  const cronMin = triggerDate.getMinutes();
  const cronHour = triggerDate.getHours();

  // Cron expresión: una sola vez (se auto-destruye después)
  const cronExpr = `${cronMin} ${cronHour} * * *`;

  log(`🎯 Alarma ${alarmId} programada: ${alarmTime} → gatillo a las ${String(cronHour).padStart(2,'0')}:${String(cronMin).padStart(2,'0')}`);

  const task = cron.schedule(cronExpr, async () => {
    const alarm = activeAlarms.get(alarmId);
    if (!alarm || alarm.status === 'cancelled') {
      log(`✅ Alarma ${alarmId} ya fue cancelada. El usuario sobrevivió.`);
      task.stop();
      activeAlarms.delete(alarmId);
      return;
    }

    // ¡El usuario no desactivó! Girar la ruleta.
    log(`🎰 GIRANDO LA RULETA para alarma ${alarmId}...`);
    const outcome = spinTheChamber();

    task.stop();
    alarm.status = 'fired';
    alarm.outcome = outcome;

    log(`🎲 Resultado: ${outcome.toUpperCase()}`);

    try {
      if (outcome === 'email') {
        await fireResignationEmail(alarm.config);
      } else if (outcome === 'twitter') {
        await fireTwitterNuke(alarm.config);
      } else {
        log(`🍀 Usuario ${userId} sobrevivió la ruleta (esta vez).`);
      }
    } catch (err) {
      log(`❌ Error ejecutando consecuencia: ${err.message}`);
    }

    activeAlarms.delete(alarmId);
  });

  activeAlarms.set(alarmId, {
    task,
    userId,
    config,
    status: 'active',
    alarmTime,
    triggerTime: `${String(cronHour).padStart(2,'0')}:${String(cronMin).padStart(2,'0')}`,
    createdAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    alarmId,
    alarmTime,
    triggerTime: `${String(cronHour).padStart(2,'0')}:${String(cronMin).padStart(2,'0')}`,
    message: `Alarma activa. Tienes hasta las ${String(cronHour).padStart(2,'0')}:${String(cronMin).padStart(2,'0')} para desactivarla.`,
  });
});

/**
 * POST /alarm/cancel
 * Body: { alarmId: string }
 * 
 * El endpoint de supervivencia. La app llama aquí cuando el usuario
 * resuelve el puzzle y apaga la alarma.
 */
app.post('/alarm/cancel', (req, res) => {
  const { alarmId } = req.body;

  if (!activeAlarms.has(alarmId)) {
    return res.status(404).json({
      error: 'Alarma no encontrada. Puede que ya se haya ejecutado.',
      survived: false,
    });
  }

  const alarm = activeAlarms.get(alarmId);
  alarm.status = 'cancelled';
  alarm.task.stop();
  activeAlarms.delete(alarmId);

  log(`✅ Alarma ${alarmId} CANCELADA. Usuario sobrevivió.`);

  res.json({
    success: true,
    survived: true,
    message: '¡Sobreviviste! Por hoy.',
  });
});

/**
 * GET /alarm/status/:alarmId
 */
app.get('/alarm/status/:alarmId', (req, res) => {
  const { alarmId } = req.params;
  const alarm = activeAlarms.get(alarmId);

  if (!alarm) {
    return res.json({ exists: false, message: 'No hay alarma activa con ese ID.' });
  }

  res.json({
    exists: true,
    alarmId,
    status: alarm.status,
    alarmTime: alarm.alarmTime,
    triggerTime: alarm.triggerTime,
    createdAt: alarm.createdAt,
  });
});

/**
 * GET /alarms
 * Lista todas las alarmas activas (debug/admin)
 */
app.get('/alarms', (req, res) => {
  const list = [];
  activeAlarms.forEach((v, k) => {
    list.push({
      alarmId: k,
      userId: v.userId,
      status: v.status,
      alarmTime: v.alarmTime,
      triggerTime: v.triggerTime,
    });
  });
  res.json({ count: list.length, alarms: list });
});

// ── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🔴 Ruleta Rusa Alarm Backend — Escuchando en puerto ${PORT}`);
  log(`   Endpoints:`);
  log(`   POST /alarm/set     — Programar alarma catastrófica`);
  log(`   POST /alarm/cancel  — Sobrevivir`);
  log(`   GET  /alarm/status  — Estado de alarma`);
  log(`   GET  /alarms        — Todas las alarmas activas`);
});

module.exports = app;
