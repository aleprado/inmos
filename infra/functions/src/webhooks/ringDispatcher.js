'use strict';

const { admin, db, messaging } = require('../config/firebase');
const { sendRingNotification }  = require('../services/whatsappService');
const { v4: uuidv4 }            = require('uuid');

const RATE_LIMIT_MAX = 5;           // max rings per IP per hour
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /ring
 * Body: { doorId, visitorPhoto? }
 * Called by the visitor PWA after scanning the QR.
 *
 * Flow:
 *  1. Rate-limit by IP
 *  2. Validate door + unit in Firestore
 *  3. Create ephemeral session (TTL 10 min)
 *  4. Send FCM push to registered devices (future native app)
 *  5. Send WhatsApp message to resident's phone with resident session link
 *  6. Return sessionId + metadata to visitor
 */
async function ringDispatcher(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { doorId, visitorPhoto } = req.body || {};
  if (!doorId) return res.status(400).json({ error: 'doorId is required' });

  const clientIp = (req.headers['x-forwarded-for'] || req.ip || 'unknown')
    .split(',')[0].trim().replace(/[.:]/g, '_');

  try {
    // ── 1. Rate limiting ──────────────────────────────────────────────────
    const rlRef = db.doc(`ring_rate_limits/${clientIp}`);
    const rlSnap = await rlRef.get();
    const now = Date.now();

    if (rlSnap.exists) {
      const { count, windowStart } = rlSnap.data();
      if (now - windowStart < 3_600_000) {
        if (count >= RATE_LIMIT_MAX)
          return res.status(429).json({ error: 'Demasiados timbrazos. Esperá un momento.' });
        await rlRef.update({ count: count + 1 });
      } else {
        await rlRef.set({ count: 1, windowStart: now });
      }
    } else {
      await rlRef.set({ count: 1, windowStart: now });
    }

    // ── 2. Validate door ──────────────────────────────────────────────────
    const doorSnap = await db.doc(`doors/${doorId}`).get();
    if (!doorSnap.exists || doorSnap.data().status !== 'active')
      return res.status(404).json({ error: 'Puerta no encontrada o inactiva.' });
    const door = doorSnap.data();

    // ── 3. Get unit ───────────────────────────────────────────────────────
    const unitSnap = await db.doc(`units/${door.unitId}`).get();
    if (!unitSnap.exists)
      return res.status(404).json({ error: 'Unidad no encontrada.' });
    const unit = unitSnap.data();
    const fcmTokens      = unit.fcmTokens || [];
    const whatsappPhones = unit.whatsappPhones || [];   // array to support multiple residents

    // ── 4. Create ephemeral session ───────────────────────────────────────
    const sessionId  = uuidv4();
    const expiresAt  = admin.firestore.Timestamp.fromMillis(now + SESSION_TTL_MS);

    await db.doc(`sessions/${sessionId}`).set({
      sessionId,
      doorId,
      unitId:       door.unitId,
      status:       'ringing',     // ringing | answered | ai_mode | missed | ended | replied
      clientIp,
      visitorPhoto: visitorPhoto || null,
      createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      offer:        null,           // SDP offer from visitor
      answer:       null,           // SDP answer from resident
      quickReply:   null,
      aiActive:     false,
    });

    const hasNotification = fcmTokens.length > 0 || whatsappPhones.length > 0;

    // ── 5. FCM push (parallel, non-blocking) ─────────────────────────────
    const fcmPromise = fcmTokens.length > 0
      ? sendFCM({ fcmTokens, door, unit, sessionId, visitorPhoto, unitId: door.unitId })
      : Promise.resolve();

    // ── 6. WhatsApp notifications (parallel, non-blocking) ────────────────
    const waPromises = whatsappPhones.map(phone =>
      sendRingNotification({
        toPhone:   phone,
        doorLabel: door.label || 'Puerta Principal',
        sessionId,
        unitName:  unit.name || '',
      }).catch(err => console.error(`[WA] failed for ${phone}:`, err.message))
    );

    // Fire and forget — don't block the response
    Promise.all([fcmPromise, ...waPromises]).catch(err =>
      console.error('[ring] notification error:', err)
    );

    // ── 7. Respond to visitor ─────────────────────────────────────────────
    return res.status(200).json({
      sessionId,
      expiresAt:    expiresAt.toMillis(),
      doorLabel:    door.label || 'Puerta Principal',
      unitName:     unit.name || '',
      hasResidents: hasNotification,
    });

  } catch (err) {
    console.error('[ringDispatcher]', err);
    return res.status(500).json({ error: 'Error interno. Intentá de nuevo.' });
  }
}

// ── FCM helper ───────────────────────────────────────────────────────────────
async function sendFCM({ fcmTokens, door, unit, sessionId, visitorPhoto, unitId }) {
  try {
    const batchRes = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title: `🔔 ${door.label || 'Puerta Principal'}`,
        body:  `Hay alguien en la puerta${unit.name ? ` de ${unit.name}` : ''}`,
      },
      data: {
        type:         'INCOMING_RING',
        sessionId,
        doorId:       door.doorId,
        doorLabel:    door.label || 'Puerta Principal',
        unitName:     unit.name || '',
        visitorPhoto: visitorPhoto || '',
      },
      android: { priority: 'high' },
      apns: {
        payload: { aps: { 'content-available': 1, sound: 'default', badge: 1 } },
        headers: { 'apns-priority': '10', 'apns-push-type': 'alert' },
      },
    });

    // Prune stale tokens
    const stale = fcmTokens.filter((_, i) => {
      const code = batchRes.responses[i]?.error?.code;
      return code === 'messaging/invalid-registration-token' ||
             code === 'messaging/registration-token-not-registered';
    });
    if (stale.length) {
      await db.doc(`units/${unitId}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...stale),
      });
    }
  } catch (err) {
    console.error('[FCM] non-fatal:', err.message);
  }
}

module.exports = { ringDispatcher };
