const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { handleCoreMessageProcess } = require('../tasks/processMessageTask');

/**
 * Función HTTPS Callable para procesar mensajes de texto de prueba en la demo interactiva.
 * Simula el bot de WhatsApp extrayendo datos con la IA y guardando propiedades en la inmobiliaria 'demo'.
 */
exports.processDemoMessage = onCall(async (request) => {
  const { messageText, sessionId } = request.data;

  // 1. Validar parámetros de entrada
  if (!messageText || !sessionId) {
    throw new HttpsError(
      'invalid-argument',
      'Debes proporcionar "messageText" y "sessionId" para el procesamiento.'
    );
  }

  // 2. Validar formato de sesión de demo
  if (!sessionId.startsWith('demo_session_')) {
    throw new HttpsError(
      'invalid-argument',
      'El sessionId proporcionado no es válido para el entorno de demostración.'
    );
  }

  try {
    console.log(`[Demo WA] Procesando mensaje web para la sesión: ${sessionId}`);

    // 3. Invocar el flujo conversacional de IA utilizando el tenant 'demo'
    await handleCoreMessageProcess({
      messageText: messageText.trim(),
      mediaId: null,
      mimeType: null,
      senderPhone: sessionId,
      tenantId: 'demo'
    });

    return {
      success: true,
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
