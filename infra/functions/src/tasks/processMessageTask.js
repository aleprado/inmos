const { onDispatch } = require('firebase-functions/v2/tasks');
const { parsePropertyMessage } = require('../services/aiAgent');
const { saveProperty, getOperatorTenant } = require('../services/propertyService');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { getMediaBufferFromId, uploadImageToStorage } = require('../services/whatsappMedia');

/**
 * Tarea asíncrona que procesa el texto, consulta a la IA y guarda en DB.
 * Se encola desde el webhook principal para no bloquear la respuesta a Meta.
 */
exports.processMessage = onDispatch(async (request) => {
  const { messageText, mediaId, mimeType, senderPhone } = request.data;

  try {
    console.log(`Procesando tarea para el mensaje de: ${senderPhone}`);

    // 1. Obtener la inmobiliaria a la que pertenece este operador
    const tenantId = await getOperatorTenant(senderPhone);
    if (!tenantId) {
      console.warn(`Operador no registrado: ${senderPhone}`);
      await sendWhatsAppMessage(senderPhone, "⚠️ Hola, tu número no está registrado como operador autorizado para ninguna inmobiliaria en Inmos. Por favor contacta al administrador.");
      return;
    }

    // 2. Procesar Multimedia si existe
    let mediaBuffer = null;
    let imageUrl = null;

    if (mediaId) {
      console.log(`Descargando media ${mediaId}...`);
      mediaBuffer = await getMediaBufferFromId(mediaId);

      // Si es una imagen, además de mandarla a la IA, la guardamos en el Storage
      if (mimeType && mimeType.startsWith('image/')) {
        console.log("Subiendo imagen al Storage...");
        imageUrl = await uploadImageToStorage(mediaBuffer, tenantId, mimeType);
      }
    }

    // 3. Enviar a la IA para parsear
    console.log("Llamando al Agente IA Multimodal...");
    const parsedData = await parsePropertyMessage(messageText, mediaBuffer, mimeType);
    console.log("Datos extraídos por IA:", parsedData);

    // Adjuntar la imagen guardada al payload si existe
    if (imageUrl) {
      parsedData.images = [imageUrl];
    }

    // 4. Validar Regla de Ubicación
    if (parsedData.missingLocation) {
      console.log("Falta ubicación, solicitando al operador...");
      await sendWhatsAppMessage(senderPhone, "🤖 *¡Hola!* Pude procesar la mayoría de los datos, pero me falta algo importante: *¿en qué dirección, barrio o zona está ubicada esta propiedad?* Responde a este mensaje con la ubicación para completar la publicación.");
      return; // No guardamos hasta que nos mande un mensaje con la ubicación
      // NOTA: Para un flujo conversacional complejo, aquí deberíamos guardar un estado "esperando_ubicacion" en una tabla de sesiones temporales.
    }

    // 5. Guardar en Base de Datos
    const propertyId = await saveProperty(parsedData, senderPhone, tenantId);
    
    // 6. Confirmar éxito al operador
    const successMsg = `✅ *¡Propiedad registrada con éxito!*\n\nTítulo: ${parsedData.title}\nRef: ${propertyId}\n\nYa puedes verla en el panel de administrador para subir sus fotos o aprobar su publicación pública.`;
    await sendWhatsAppMessage(senderPhone, successMsg);

  } catch (error) {
    console.error("Error en processMessageTask:", error);
    await sendWhatsAppMessage(senderPhone, "❌ Ocurrió un error al procesar tu mensaje. Por favor, revisa el formato o inténtalo más tarde.");
    throw error; // Lanzar el error permite que Cloud Tasks lo reintente si está configurado
  }
});
