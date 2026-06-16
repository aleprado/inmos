const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const { parsePropertyMessage, mergePropertyDetails, extractSingleField } = require('../services/aiAgent');
const { saveProperty, getOperatorTenant, getPropertyById, updateProperty, appendImageToProperty } = require('../services/propertyService');
const { getSession, createOrUpdateSession, clearSession, isSessionValid, getMinutesSinceLastActivity } = require('../services/sessionService');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { getMediaBufferFromId, uploadImageToStorage } = require('../services/whatsappMedia');
const { aiTranscriptionModel } = require('../config/ai');

/**
 * Transcribe un archivo de audio a texto usando Gemini
 */
async function transcribeAudio(audioBuffer, mimeType) {
  try {
    const prompt = "Transcribe el siguiente audio de WhatsApp exactamente. No agregues comentarios, explicaciones, introducciones ni formato adicional. Si no hay voz inteligible, devuelve vacío.";
    const result = await aiTranscriptionModel.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: audioBuffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ]);
    return result.response.text().trim();
  } catch (error) {
    console.error("Error transcribiendo audio:", error);
    return "";
  }
}

/**
 * Tarea asíncrona que procesa el flujo conversacional y la persistencia de propiedades.
 * Delega el control del estado y las preguntas al Agente de IA.
 */
async function handleCoreMessageProcess({ messageText, mediaId, mimeType, senderPhone, tenantId }) {
  let processedText = messageText;

  // 1.5 Transcribir el audio a texto si es necesario
  if (!messageText && mediaId && mimeType && mimeType.startsWith('audio/')) {
    console.log(`Descargando y transcribiendo audio con mediaId: ${mediaId}`);
    const audioBuffer = await getMediaBufferFromId(mediaId);
    processedText = await transcribeAudio(audioBuffer, mimeType);
    console.log(`Audio transcrito con éxito: "${processedText}"`);
  }

  // 2. Comprobar comandos globales de finalización/cierre
  const cleanedText = processedText ? processedText.trim().toLowerCase() : "";
  if (cleanedText === "terminar" || cleanedText === "finalizar") {
    await clearSession(senderPhone);
    await sendWhatsAppMessage(senderPhone, "✅ *¡Entendido!* Sesión cerrada. Puedes comenzar a cargar una nueva propiedad cuando quieras.");
    return;
  }

  // 3. Obtener sesión actual
  const session = await getSession(senderPhone);
  const hasActiveSession = isSessionValid(session);

  // --- ESCENARIO 1: SESIÓN ACTIVA ---
  if (hasActiveSession) {
    const propertyId = session.lastPropertyId;
    console.log(`Sesión activa encontrada para la propiedad: ${propertyId}`);

    // CASO A: El mensaje contiene una Imagen
    if (mediaId && mimeType && mimeType.startsWith('image/')) {
      console.log(`Descargando e insertando imagen en propiedad existente: ${propertyId}`);
      const mediaBuffer = await getMediaBufferFromId(mediaId);
      const imageUrl = await uploadImageToStorage(mediaBuffer, tenantId, mimeType);
      await appendImageToProperty(propertyId, imageUrl);
      
      await createOrUpdateSession(senderPhone, propertyId, 'active', [], null);
      
      if (!processedText) {
        await sendWhatsAppMessage(senderPhone, "📸 *¡Foto guardada con éxito!* ¿Algo más para agregar o ya estamos listos?", [{ id: 'finalizar', title: 'Finalizar Carga' }]);
        return;
      }
    }

    // CASO B: El mensaje es de texto o audio (acompañado o no de imagen)
    if (processedText) {
      if (cleanedText === 'listo') {
        await clearSession(senderPhone);
        await sendWhatsAppMessage(senderPhone, "✅ *¡Registro completado!* Ya guardé la propiedad. Puedes revisarla en el panel web.");
        return;
      }

      console.log(`Combinando nueva información en propiedad existente: ${propertyId}`);
      const propertyData = await getPropertyById(propertyId);
      if (propertyData) {
        const minutesInactive = getMinutesSinceLastActivity(session);
        const timeWarning = minutesInactive > 10;
        
        const aiResponse = await mergePropertyDetails(propertyData, processedText, timeWarning);
        
        // Actualizar en Firestore
        await updateProperty(propertyId, aiResponse.propertyData || aiResponse);
        
        // Refrescar sesión
        await createOrUpdateSession(senderPhone, propertyId, 'active', [], null);
        
        // Si la IA marca isComplete y no hay warning, sugerimos finalizar
        let responseMsg = aiResponse.chatResponse || "📝 *¡Detalles actualizados!*";
        await sendWhatsAppMessage(senderPhone, responseMsg, [{ id: 'finalizar', title: 'Finalizar Carga' }]);
        return;
      }
    }
    return; // Fin de procesamiento para sesión activa
  }

  // --- ESCENARIO 2: CREACIÓN DE NUEVA PROPIEDAD ---
  console.log("No hay sesión activa para el operador. Iniciando nueva propiedad...");

  if (!processedText && mediaId && (!mimeType || !mimeType.startsWith('audio/'))) {
    await sendWhatsAppMessage(senderPhone, "🤖 *¡Hola!* Por favor envía primero la descripción en texto o un audio con los detalles de la propiedad para iniciar el registro.");
    return;
  }

  let mediaBuffer = null;
  let imageUrl = null;
  if (mediaId && mimeType && mimeType.startsWith('image/')) {
    console.log("Descargando imagen adjunta al mensaje inicial...");
    mediaBuffer = await getMediaBufferFromId(mediaId);
    imageUrl = await uploadImageToStorage(mediaBuffer, tenantId, mimeType);
  }

  console.log("Llamando al Agente IA Autónomo...");
  const aiResponse = await parsePropertyMessage(processedText, mediaBuffer, mimeType);
  const parsedData = aiResponse.propertyData || aiResponse;
  
  if (imageUrl) {
    parsedData.images = [imageUrl];
  }

  // Guardar en Firestore directamente (aunque falten datos, se guardará el borrador)
  const propertyId = await saveProperty(parsedData, senderPhone, tenantId);

  // Inicializar sesión
  await createOrUpdateSession(senderPhone, propertyId, 'active', [], null);

  let responseMsg = aiResponse.chatResponse || `✅ *¡Borrador creado!*\nRef: ${propertyId}`;
  
  if (!responseMsg.includes(propertyId)) {
     responseMsg += `\n\n*(Ref: ${propertyId})*`;
  }
  
  await sendWhatsAppMessage(senderPhone, responseMsg, [{ id: 'finalizar', title: 'Finalizar Carga' }]);
}

// Exportar la función core para ser reutilizada por la demo callable
exports.handleCoreMessageProcess = handleCoreMessageProcess;

// Definición de la tarea de Cloud Tasks
exports.processMessage = onTaskDispatched(async (request) => {
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

    // Ejecutar lógica de procesamiento core
    await handleCoreMessageProcess({ messageText, mediaId, mimeType, senderPhone, tenantId });

  } catch (error) {
    console.error("Error crítico en processMessageTask:", error);
    try {
      await sendWhatsAppMessage(senderPhone, "❌ Ocurrió un error al procesar tu mensaje con Inteligencia Artificial. Por favor, asegúrate de que tus credenciales de API estén vigentes e inténtalo más tarde.");
    } catch (sendErr) {
      console.error("Error al enviar mensaje de error a WhatsApp:", sendErr);
    }
  }
});
