'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { admin, db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * Callable: CRUD for units, doors, buildings, and members.
 * data: { action, payload }
 *
 * Actions (unit/door):
 *  - createUnit        { name, address }
 *  - updateUnit        { unitId, ...fields }
 *  - createDoor        { unitId, label }
 *  - updateDoor        { doorId, ...fields }
 *  - deleteDoor        { doorId }
 *  - addMember         { unitId, email }
 *  - removeMember      { unitId, uid }
 *  - registerToken     { unitId, fcmToken }
 *  - setAbsenceMode    { unitId, enabled }
 *  - addWhatsappPhone  { unitId, phone }
 *  - removeWhatsappPhone { unitId, phone }
 *
 * Actions (building):
 *  - createBuilding      { name, address }
 *  - createBuildingUnit  { buildingId, name }
 *  - createBuildingDoor  { buildingId, label }
 *  - claimUnit           { inviteCode }
 */
async function adminConfig({ data, auth }) {
  if (!auth) throw new HttpsError('unauthenticated', 'Debés estar autenticado.');

  const { action, payload } = data || {};
  if (!action || !payload) throw new HttpsError('invalid-argument', 'action y payload son requeridos.');

  const uid = auth.uid;

  switch (action) {

    // ── Standalone unit ─────────────────────────────────────────────────────

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
        whatsappPhones: [],
        absenceMode: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { unitId };
    }

    case 'updateUnit': {
      const { unitId, ...fields } = payload;
      await assertUnitOwner(uid, unitId);
      const allowed = ['name', 'address', 'absenceMode', 'visible'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      if (!Object.keys(update).length) throw new HttpsError('invalid-argument', 'Sin campos válidos.');
      await db.doc(`units/${unitId}`).update(update);
      return { ok: true };
    }

    case 'addWhatsappPhone': {
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
      const { unitId, label } = payload;
      if (!unitId || !label) throw new HttpsError('invalid-argument', 'unitId y label son requeridos.');
      await assertUnitMember(uid, unitId);
      const doorId = uuidv4();
      const qrUrl = `${process.env.APP_DOMAIN || 'https://timbreqr.app'}/v/${doorId}`;
      await db.doc(`doors/${doorId}`).set({
        doorId,
        type: 'unit',
        unitId,
        label,
        status: 'active',
        qrUrl,
        webhookUrl: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { doorId, qrUrl };
    }

    case 'updateDoor': {
      const { doorId, ...fields } = payload;
      const doorSnap = await db.doc(`doors/${doorId}`).get();
      if (!doorSnap.exists) throw new HttpsError('not-found', 'Puerta no encontrada.');
      const door = doorSnap.data();
      if (door.unitId) await assertUnitMember(uid, door.unitId);
      else if (door.buildingId) await assertBuildingAdmin(uid, door.buildingId);
      const allowed = ['label', 'status', 'webhookUrl'];
      const update = Object.fromEntries(Object.entries(fields).filter(([k]) => allowed.includes(k)));
      await db.doc(`doors/${doorId}`).update(update);
      return { ok: true };
    }

    case 'deleteDoor': {
      const { doorId } = payload;
      const doorSnap = await db.doc(`doors/${doorId}`).get();
      if (!doorSnap.exists) throw new HttpsError('not-found', 'Puerta no encontrada.');
      const door = doorSnap.data();
      if (door.unitId) await assertUnitOwner(uid, door.unitId);
      else if (door.buildingId) await assertBuildingAdmin(uid, door.buildingId);
      await db.doc(`doors/${doorId}`).update({ status: 'deleted' });
      return { ok: true };
    }

    case 'addMember': {
      const { unitId, email } = payload;
      await assertUnitOwner(uid, unitId);
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

    // ── Building ────────────────────────────────────────────────────────────

    case 'createBuilding': {
      const { name, address } = payload;
      if (!name) throw new HttpsError('invalid-argument', 'name es requerido.');
      const buildingId = uuidv4();
      await db.doc(`buildings/${buildingId}`).set({
        buildingId,
        name,
        address: address || '',
        adminUid: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { buildingId };
    }

    case 'createBuildingUnit': {
      const { buildingId, name } = payload;
      if (!buildingId || !name) throw new HttpsError('invalid-argument', 'buildingId y name son requeridos.');
      await assertBuildingAdmin(uid, buildingId);
      const unitId = uuidv4();
      const inviteCode = uuidv4().slice(0, 8).toUpperCase();
      await db.doc(`units/${unitId}`).set({
        unitId,
        name,
        buildingId,
        ownerUid: uid,
        memberUids: [],        // empty until resident claims with invite code
        fcmTokens: [],
        whatsappPhones: [],
        absenceMode: false,
        visible: true,
        inviteCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { unitId, inviteCode };
    }

    case 'createBuildingDoor': {
      const { buildingId, label } = payload;
      if (!buildingId) throw new HttpsError('invalid-argument', 'buildingId es requerido.');
      await assertBuildingAdmin(uid, buildingId);
      const doorId = uuidv4();
      const qrUrl = `${process.env.APP_DOMAIN || 'https://timbreqr.app'}/v/${doorId}`;
      await db.doc(`doors/${doorId}`).set({
        doorId,
        type: 'building',
        buildingId,
        label: label || 'Entrada Principal',
        status: 'active',
        qrUrl,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { doorId, qrUrl };
    }

    case 'claimUnit': {
      // Resident enters the invite code they received from the building admin
      const { inviteCode } = payload;
      if (!inviteCode) throw new HttpsError('invalid-argument', 'inviteCode es requerido.');
      const snap = await db.collection('units')
        .where('inviteCode', '==', inviteCode.toUpperCase().trim())
        .limit(1)
        .get();
      if (snap.empty) throw new HttpsError('not-found', 'Código de invitación inválido o ya usado.');
      const unitDoc = snap.docs[0];
      const unit = unitDoc.data();
      if (unit.memberUids?.includes(uid)) {
        return { unitId: unitDoc.id, unitName: unit.name, alreadyMember: true };
      }
      await unitDoc.ref.update({
        memberUids: admin.firestore.FieldValue.arrayUnion(uid),
      });
      return { unitId: unitDoc.id, unitName: unit.name };
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

async function assertBuildingAdmin(uid, buildingId) {
  const snap = await db.doc(`buildings/${buildingId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Edificio no encontrado.');
  if (snap.data().adminUid !== uid) throw new HttpsError('permission-denied', 'Solo el administrador del edificio puede hacer esto.');
}

module.exports = { adminConfig };
