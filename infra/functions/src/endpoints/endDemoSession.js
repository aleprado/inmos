const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { db } = require('../config/firebase');
const { deleteImageFromStorage } = require('../services/whatsappMedia');
const { clearSession } = require('../services/sessionService');

/**
 * Función HTTPS Callable para finalizar la sesión de demo.
 * Elimina todas las propiedades creadas durante la sesión y la sesión misma.
 */
exports.endDemoSession = onCall(async (request) => {
  const { sessionId } = request.data;

  if (!sessionId || !sessionId.startsWith('demo_session_')) {
    throw new HttpsError(
      'invalid-argument',
      'El sessionId proporcionado no es válido para el entorno de demostración.'
    );
  }

  try {
    console.log(`[Demo WA] Finalizando sesión de demo y limpiando datos para: ${sessionId}`);

    const propertiesRef = db.collection('properties');
    
    // Consultar propiedades de demo creadas por esta sesión
    const snapshot = await propertiesRef
      .where('tenant_id', '==', 'demo')
      .where('metadata.sender', '==', sessionId)
      .get();

    if (!snapshot.empty) {
      let batch = db.batch();
      let deletedCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // 1. Eliminar imágenes del Storage
        if (data.images && Array.isArray(data.images)) {
          for (const imageUrl of data.images) {
            await deleteImageFromStorage(imageUrl);
          }
        }

        // 2. Marcar documento para eliminar
        batch.delete(doc.ref);
        deletedCount++;

        if (deletedCount % 500 === 0) {
          await batch.commit();
          batch = db.batch();
        }
      }

      if (deletedCount % 500 !== 0) {
        await batch.commit();
      }
      
      console.log(`[Demo WA] Limpieza completada. Se eliminaron ${deletedCount} propiedades.`);
    }

    // 3. Eliminar la sesión de la colección sessions
    await clearSession(sessionId);

    return {
      success: true,
      message: "Sesión de demo finalizada y datos eliminados correctamente."
    };

  } catch (error) {
    console.error("[Demo WA] Error al limpiar datos de la sesión de demo:", error);
    throw new HttpsError(
      'internal',
      `Error al limpiar la sesión: ${error.message}`
    );
  }
});
