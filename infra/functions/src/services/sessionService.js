const { db, admin } = require('../config/firebase');

const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES) || 30;
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000;

/**
 * Obtiene la sesión activa para un número de teléfono
 */
async function getSession(phone) {
  try {
    const doc = await db.collection('sessions').doc(phone).get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (error) {
    console.error(`Error al obtener sesión para ${phone}:`, error);
    return null;
  }
}

/**
 * Crea o actualiza una sesión de conversación
 */
async function createOrUpdateSession(phone, propertyId, status, missingFields = [], currentField = null) {
  try {
    const sessionData = {
      lastPropertyId: propertyId,
      status: status,
      missingFields: missingFields,
      currentField: currentField,
      lastActivity: admin.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('sessions').doc(phone).set(sessionData, { merge: true });
    console.log(`Sesión actualizada para ${phone}: status=${status}, currentField=${currentField}`);
  } catch (error) {
    console.error(`Error al actualizar sesión para ${phone}:`, error);
  }
}

/**
 * Elimina la sesión de conversación
 */
async function clearSession(phone) {
  try {
    await db.collection('sessions').doc(phone).delete();
    console.log(`Sesión eliminada para ${phone}`);
  } catch (error) {
    console.error(`Error al eliminar sesión para ${phone}:`, error);
  }
}

/**
 * Verifica si una sesión es válida (no ha expirado)
 */
function isSessionValid(session) {
  if (!session || !session.lastActivity) return false;
  
  // Convertir Timestamp de Firestore a Date de JS
  const lastActivityDate = session.lastActivity.toDate ? session.lastActivity.toDate() : new Date(session.lastActivity);
  const now = new Date();
  
  return (now - lastActivityDate) < SESSION_TIMEOUT_MS;
}

/**
 * Calcula los minutos transcurridos desde la última actividad
 */
function getMinutesSinceLastActivity(session) {
  if (!session || !session.lastActivity) return 0;
  const lastActivityDate = session.lastActivity.toDate ? session.lastActivity.toDate() : new Date(session.lastActivity);
  const now = new Date();
  return Math.floor((now - lastActivityDate) / 60000);
}

module.exports = {
  getSession,
  createOrUpdateSession,
  clearSession,
  isSessionValid,
  getMinutesSinceLastActivity
};
