const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { handleCoreMessageProcess } = require('../tasks/processMessageTask');
const { appendImageToProperty } = require('../services/propertyService');
const { getSession } = require('../services/sessionService');
const { db } = require('../config/firebase');

/**
 * Función HTTPS Callable para procesar mensajes de texto o imágenes de operadores autenticados.
 * Valida la sesión de Firebase Auth e inyecta el tenant_id correcto.
 */
exports.processOperatorMessage = onCall(async (request) => {
  // 1. Validar Autenticación
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'Debes iniciar sesión para usar el asistente de IA.'
    );
  }

  const { messageText, imageUrl } = request.data;
  if (messageText === undefined && !imageUrl) {
    throw new HttpsError(
      'invalid-argument',
      'Debes proporcionar "messageText" o "imageUrl".'
    );
  }

  try {
    const uid = request.auth.uid;
    const claims = request.auth.token;
    
    // 2. Obtener el tenantId de las claims o forzar error
    const tenantId = claims.tenant_id;
    if (!tenantId) {
      throw new HttpsError(
        'permission-denied',
        'Tu cuenta no tiene una inmobiliaria asignada.'
      );
    }

    // 3. Obtener el número de teléfono del operador (document ID) a partir de su UID
    const operatorQuery = await db.collection('operadores').where('uid', '==', uid).limit(1).get();
    let operatorPhone = `web_${uid}`; // Fallback por defecto si no se encuentra
    
    if (!operatorQuery.empty) {
      operatorPhone = operatorQuery.docs[0].id;
    }

    console.log(`[Web Chat] Procesando mensaje web para operador: ${operatorPhone} (Tenant: ${tenantId})`);

    const replies = [];
    
    // Simulador de respuestas (emisor de eventos o retorno directo si handleCoreMessageProcess lo permitiera)
    // Para simplificar y no depender de events en un entorno serverless web puro:
    // Podríamos retornar respuestas simuladas, pero Inmos usa WhatsApp. 
    // Como el handleCoreMessageProcess no devuelve texto (envía por WA), en web
    // retornaremos un mensaje genérico de éxito, o tendríamos que interceptar sendTextMessage.
    // Para no romper la arquitectura, usaremos el mismo truco que processDemoMessage si es necesario.
    // Pero como es un usuario real, si modificamos el whatsappSender.js podríamos capturarlo.
    // Para mantenerlo robusto:
    
    if (imageUrl) {
      const session = await getSession(operatorPhone);
      if (session && (session.status === 'active' || session.status === 'waiting_images')) {
        await appendImageToProperty(session.lastPropertyId, imageUrl);
        replies.push("📸 *¡Foto guardada con éxito!* (Vía Web). ¿Algo más para agregar o ya estamos listos?");
      } else {
        replies.push("⚠️ Primero debes iniciar el registro con una descripción antes de mandar fotos.");
      }
    } else {
      // Usamos el EventEmitter temporalmente si está disponible en whatsappSender, 
      // si no, procesamos y retornamos un mensaje de éxito.
      const { demoEventEmitter } = require('../services/whatsappSender');
      const listener = (msg) => {
        if (msg.to === operatorPhone) {
          replies.push(msg.text);
        }
      };
      
      demoEventEmitter.on('message', listener);
      
      await handleCoreMessageProcess({
        messageText: messageText.trim(),
        mediaId: null,
        mimeType: null,
        senderPhone: operatorPhone,
        tenantId: tenantId
      });
      
      demoEventEmitter.off('message', listener);
      
      if (replies.length === 0) {
        replies.push("Mensaje procesado. Revisa tu catálogo.");
      }
    }

    return {
      success: true,
      replies: replies
    };

  } catch (error) {
    console.error("[Web Chat] Error al procesar mensaje de operador:", error);
    throw new HttpsError(
      'internal',
      `Error al procesar el mensaje: ${error.message}`
    );
  }
});
