'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { admin, db } = require('../config/firebase');

/**
 * Callable: resident sends a quick reply to the visitor.
 * data: { sessionId: string, message: string }
 */
async function quickAction({ data, auth }) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Debés estar autenticado para enviar una respuesta.');
  }

  const { sessionId, message } = data || {};
  if (!sessionId || !message) {
    throw new HttpsError('invalid-argument', 'sessionId y message son requeridos.');
  }

  const sessionRef = db.doc(`sessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    throw new HttpsError('not-found', 'Sesión no encontrada.');
  }

  const session = sessionSnap.data();

  // Verify this user belongs to the unit
  const unitSnap = await db.doc(`units/${session.unitId}`).get();
  if (!unitSnap.exists) {
    throw new HttpsError('not-found', 'Unidad no encontrada.');
  }
  const unit = unitSnap.data();
  const authorizedUids = unit.memberUids || [];
  if (!authorizedUids.includes(auth.uid)) {
    throw new HttpsError('permission-denied', 'No tenés permiso sobre esta unidad.');
  }

  // Write quick reply — visitor PWA listens via onSnapshot
  await sessionRef.update({
    quickReply: message,
    quickReplyAt: admin.firestore.FieldValue.serverTimestamp(),
    quickReplySentBy: auth.uid,
    status: 'replied',
  });

  return { ok: true };
}

module.exports = { quickAction };
