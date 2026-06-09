const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db, admin } = require('../config/firebase');
const { deleteImageFromStorage } = require('../services/whatsappMedia');

/**
 * Tarea programada que se ejecuta todos los días.
 * Limpia las propiedades generadas por el entorno de demostración (tenant_id == 'demo')
 * que tienen más de 24 horas de antigüedad.
 */
exports.cleanupDemoProperties = onSchedule('every 24 hours', async (event) => {
  try {
    console.log('[Cron] Iniciando limpieza de propiedades de demostración...');
    
    // Calcular el timestamp de hace 24 horas
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayTimestamp = admin.firestore.Timestamp.fromDate(yesterday);

    const propertiesRef = db.collection('properties');
    
    // Consultar propiedades de demo más antiguas que 24 horas
    const snapshot = await propertiesRef
      .where('tenant_id', '==', 'demo')
      .where('createdAt', '<', yesterdayTimestamp)
      .get();

    if (snapshot.empty) {
      console.log('[Cron] No hay propiedades de demostración antiguas para eliminar.');
      return;
    }

    let deletedCount = 0;
    
    // Usar un batch para eliminar los documentos de manera eficiente
    // Firestore batch supports up to 500 operations.
    let batch = db.batch();

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

      // Si alcanzamos 500, cometemos el batch y empezamos uno nuevo
      if (deletedCount % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }

    // Cometer cualquier resto
    if (deletedCount % 500 !== 0) {
      await batch.commit();
    }

    console.log(`[Cron] Limpieza completada. Se eliminaron ${deletedCount} propiedades de demostración.`);

  } catch (error) {
    console.error('[Cron] Error durante la limpieza de propiedades:', error);
  }
});
