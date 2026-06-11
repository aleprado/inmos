const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { handleCoreMessageProcess } = require('../tasks/processMessageTask');
const { demoEventEmitter } = require('../services/whatsappSender');

/**
 * Función HTTPS Callable para procesar mensajes de texto de prueba en la demo interactiva.
 * Simula el bot de WhatsApp extrayendo datos con la IA y guardando propiedades en la inmobiliaria 'demo'.
 */
exports.processDemoMessage = onCall(async (request) => {
  const { messageText, sessionId, imageUrl } = request.data;

  // 1. Validar parámetros de entrada
  if (!sessionId || (messageText === undefined && !imageUrl)) {
    throw new HttpsError(
      'invalid-argument',
      'Debes proporcionar "messageText" (o "imageUrl") y "sessionId" para el procesamiento.'
    );
  }

  // Validar formato de sesión de demo
  if (!sessionId.startsWith('demo_session_')) {
    throw new HttpsError(
      'invalid-argument',
      'El sessionId proporcionado no es válido para el entorno de demostración.'
    );
  }

  // 3. Limitación de ratio por IP para evitar gastos en IA (Max 20 interacciones por IP por día)
  const clientIp = request.rawRequest.ip || request.rawRequest.headers['x-forwarded-for'] || 'unknown';
  if (clientIp !== 'unknown') {
    const { db } = require('../config/firebase');
    const { FieldValue } = require('firebase-admin/firestore');
    
    // Formatear IP para que sea un ID de documento válido
    const safeIp = clientIp.replace(/[\/\.\:]/g, '_');
    const today = new Date().toISOString().split('T')[0];
    const limitRef = db.collection('demo_rate_limits').doc(safeIp);
    
    const docSnap = await limitRef.get();
    const data = docSnap.data();

    if (!docSnap.exists || data.date !== today) {
      await limitRef.set({ count: 1, date: today });
    } else {
      if (data.count >= 20) {
        console.warn(`[Demo WA] Bloqueo por Rate Limit a la IP: ${clientIp}`);
        throw new HttpsError(
          'resource-exhausted',
          'Has alcanzado el límite diario de pruebas en la demo (20 mensajes). Vuelve a intentarlo mañana.'
        );
      }
      await limitRef.update({ count: FieldValue.increment(1) });
    }
  }

  try {
    console.log(`[Demo WA] Procesando mensaje web para la sesión: ${sessionId}`);

    const replies = [];
    const listener = (msg) => {
      if (msg.to === sessionId) {
        replies.push(msg.text);
      }
    };
    
    demoEventEmitter.on('message', listener);

    // 3. Si es una imagen de ejemplo, insertarla directamente sin pasar por la IA
    if (request.data.imageUrl) {
      const { getSession } = require('../services/sessionService');
      const { appendImageToProperty } = require('../services/propertyService');
      const session = await getSession(sessionId);
      
      if (session && (session.status === 'active' || session.status === 'waiting_images')) {
        await appendImageToProperty(session.lastPropertyId, request.data.imageUrl);
        replies.push("📸 *¡Foto agregada con éxito!* ¿Algo más para agregar o ya estamos listos?");
      } else {
        replies.push("⚠️ Primero debes iniciar el registro escribiendo una descripción antes de mandar fotos.");
      }
    } else {
      // 4. Invocar el flujo conversacional de IA utilizando el tenant 'demo'
      await handleCoreMessageProcess({
        messageText: messageText.trim(),
        mediaId: null,
        mimeType: null,
        senderPhone: sessionId,
        tenantId: 'demo'
      });
    }

    demoEventEmitter.off('message', listener);

    return {
      success: true,
      replies: replies,
      message: "Mensaje procesado correctamente."
    };

  } catch (error) {
    console.error("[Demo WA] Error al procesar mensaje de demo:", error);
    throw new HttpsError(
      'internal',
      `Error al procesar el mensaje en el chatbot de demostración: ${error.message}`
    );
  }
});
