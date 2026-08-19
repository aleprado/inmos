'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { admin, db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * Callable: CRUD for units, doors, and members.
 * data: { action, payload }
 *
 * Actions:
 *  - createUnit    { name, address }
 *  - updateUnit    { unitId, ...fields }
 *  - createDoor    { unitId, label, geofenceLatLng?, geofenceRadius? }
 *  - updateDoor    { doorId, ...fields }
 *  - deleteDoor    { doorId }
 *  - addMember     { unitId, email }
 *  - removeMember  { unitId, uid }
 *  - registerToken { unitId, fcmToken }
 *  - setAbsenceMode { unitId, enabled }
 */
async function adminConfig({ data, auth }) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Debés estar autenticado.');
  }

  const { action, payload } = data || {};
  if (!action || !payload) {
    throw new HttpsError('invalid-argument', 'action y payload son requeridos.');
  }

  const uid = auth.uid;

  switch (action) {

    case 'createUnit': {
      const { name, address } = payload;
      if (!name) throw new HttpsError('invalid-argument', 'name es requerido.');
      const unitId = uuidv4();
      await db.doc(`units/${unitId}`).set({
        unitId,
        name,
        address: address || '',
        ownerUid: uid,
        memberUids: [uid],
        fcmTokens: [],
        whatsappPhones: [],   // E.164 phones that receive ring WA notifications
        absenceMode: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { unitId };
    }

    case 'updateUnit': {
      const { unitId, ...fields } = payload;
      await assertUnitOwner(uid, unitId);
      const allowed = ['name', 'address', 'absenceMode'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      if (!Object.keys(update).length) throw new HttpsError('invalid-argument', 'Sin campos válidos.');
      await db.doc(`units/${unitId}`).update(update);
      return { ok: true };
    }

    case 'addWhatsappPhone': {
      // Adds a WhatsApp phone number to receive ring notifications
      const { unitId, phone } = payload;
      if (!unitId || !phone) throw new HttpsError('invalid-argument', 'unitId y phone son requeridos.');
      await assertUnitMember(uid, unitId);
      const { normalizePhone } = require('../services/whatsappService');
      const normalized = normalizePhone(phone);
      await db.doc(`units/${unitId}`).update({
        whatsappPhones: admin.firestore.FieldValue.arrayUnion(normalized),
      });
      return { ok: true, normalized };
    }

    case 'removeWhatsappPhone': {
      const { unitId, phone } = payload;
      if (!unitId || !phone) throw new HttpsError('invalid-argument', 'unitId y phone son requeridos.');
      await assertUnitMember(uid, unitId);
      const { normalizePhone } = require('../services/whatsappService');
      await db.doc(`units/${unitId}`).update({
        whatsappPhones: admin.firestore.FieldValue.arrayRemove(normalizePhone(phone)),
      });
      return { ok: true };
    }

    case 'createDoor': {
      const { unitId, label, geofenceLatLng, geofenceRadius } = payload;
      if (!unitId || !label) throw new HttpsError('invalid-argument', 'unitId y label son requeridos.');
      await assertUnitMember(uid, unitId);
      const doorId = uuidv4();
      const qrUrl = `${process.env.APP_DOMAIN || 'https://timbreqr.app'}/v/${doorId}`;
      await db.doc(`doors/${doorId}`).set({
        doorId,
        unitId,
        label,
        status: 'active',
        qrUrl,
        geofenceLatLng: geofenceLatLng || null,
        geofenceRadius: geofenceRadius || 60,  // meters
        webhookUrl: null,  // for Shelly/Sonoff relay
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { doorId, qrUrl };
    }

    case 'updateDoor': {
      const { doorId, ...fields } = payload;
      const doorSnap = await db.doc(`doors/${doorId}`).get();
      if (!doorSnap.exists) throw new HttpsError('not-found', 'Puerta no encontrada.');
      await assertUnitMember(uid, doorSnap.data().unitId);
      const allowed = ['label', 'status', 'geofenceLatLng', 'geofenceRadius', 'webhookUrl'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      await db.doc(`doors/${doorId}`).update(update);
      return { ok: true };
    }

    case 'deleteDoor': {
      const { doorId } = payload;
      const doorSnap = await db.doc(`doors/${doorId}`).get();
      if (!doorSnap.exists) throw new HttpsError('not-found', 'Puerta no encontrada.');
      await assertUnitOwner(uid, doorSnap.data().unitId);
      await db.doc(`doors/${doorId}`).update({ status: 'deleted' });
      return { ok: true };
    }

    case 'addMember': {
      const { unitId, email } = payload;
      await assertUnitOwner(uid, unitId);
      // Look up user by email
      let memberRecord;
      try {
        memberRecord = await admin.auth().getUserByEmail(email);
      } catch {
        throw new HttpsError('not-found', `No existe un usuario con email ${email}`);
      }
      await db.doc(`units/${unitId}`).update({
        memberUids: admin.firestore.FieldValue.arrayUnion(memberRecord.uid),
      });
      return { uid: memberRecord.uid };
    }

    case 'removeMember': {
      const { unitId, uid: memberUid } = payload;
      await assertUnitOwner(uid, unitId);
      if (memberUid === uid) throw new HttpsError('invalid-argument', 'No podés removerte a vos mismo como dueño.');
      await db.doc(`units/${unitId}`).update({
        memberUids: admin.firestore.FieldValue.arrayRemove(memberUid),
      });
      return { ok: true };
    }

    case 'registerToken': {
      const { unitId, fcmToken } = payload;
      if (!unitId || !fcmToken) throw new HttpsError('invalid-argument', 'unitId y fcmToken son requeridos.');
      await assertUnitMember(uid, unitId);
      await db.doc(`units/${unitId}`).update({
        fcmTokens: admin.firestore.FieldValue.arrayUnion(fcmToken),
      });
      return { ok: true };
    }

    case 'setAbsenceMode': {
      const { unitId, enabled } = payload;
      await assertUnitMember(uid, unitId);
      await db.doc(`units/${unitId}`).update({ absenceMode: !!enabled });
      return { ok: true };
    }

    default:
      throw new HttpsError('invalid-argument', `Acción desconocida: ${action}`);
  }
}

async function assertUnitOwner(uid, unitId) {
  const snap = await db.doc(`units/${unitId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Unidad no encontrada.');
  if (snap.data().ownerUid !== uid) throw new HttpsError('permission-denied', 'Solo el dueño puede hacer esto.');
}

async function assertUnitMember(uid, unitId) {
  const snap = await db.doc(`units/${unitId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Unidad no encontrada.');
  if (!snap.data().memberUids?.includes(uid)) throw new HttpsError('permission-denied', 'No sos miembro de esta unidad.');
}

module.exports = { adminConfig };
