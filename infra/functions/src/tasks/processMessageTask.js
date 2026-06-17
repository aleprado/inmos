const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const { parsePropertyMessage, mergePropertyDetails, extractSingleField } = require('../services/aiAgent');
const { saveProperty, getOperatorTenant, getPropertyById, updateProperty, appendImageToProperty } = require('../services/propertyService');
const { getSession, createOrUpdateSession, clearSession, isSessionValid, getMinutesSinceLastActivity, shouldSendImageAck } = require('../services/sessionService');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { getMediaBufferFromId, uploadImageToStorage } = require('../services/whatsappMedia');
const { aiTranscriptionModel } = require('../config/ai');

// Dominio base para deep links (configurable para extender a otros proyectos)
const APP_DOMAIN = process.env.APP_DOMAIN || 'inmos.app';

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
    return null;
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
    
    if (processedText === null) {
      await sendWhatsAppMessage(senderPhone, "⚠️ Ups, tuve un problema técnico al intentar escuchar tu audio (el servicio de IA puede estar saturado). ¿Podrías enviarme la información por texto o intentar de nuevo en un ratito?");
      return;
    }
    
    if (processedText === "") {
      await sendWhatsAppMessage(senderPhone, "⚠️ No pude detectar ninguna voz clara en el audio. ¿Podrías volver a grabarlo o enviarme los datos por texto?");
      return;
    }

    console.log(`Audio transcrito con éxito: "${processedText}"`);
  }

  // 2. Comprobar comandos globales de finalización/cierre
  const cleanedText = processedText ? processedText.trim().toLowerCase() : "";
  if (cleanedText === "terminar" || cleanedText === "finalizar") {
    const session = await getSession(senderPhone);
    const propId = session?.lastPropertyId;
    await clearSession(senderPhone);
    let msg = "✅ *¡Entendido!* Sesión cerrada. Puedes comenzar a cargar una nueva propiedad cuando quieras.";
    if (propId) {
      const propertyLink = `https://${tenantId}.${APP_DOMAIN}/?p=${propId}`;
      msg += `\n\n🔗 *Ver propiedad:* ${propertyLink}`;
    }
    await sendWhatsAppMessage(senderPhone, msg);
    return;
  }

  // 2b. Botón "Seguir Cargando": refrescar sesión y confirmar
  if (cleanedText === "continuar") {
    const session = await getSession(senderPhone);
    if (isSessionValid(session)) {
      await createOrUpdateSession(senderPhone, session.lastPropertyId, 'active', [], null);
      await sendWhatsAppMessage(senderPhone, "👍 *¡Perfecto!* Seguimos con la misma propiedad. Enviame los datos o fotos que quieras agregar.", [{ id: 'finalizar', title: 'Finalizar Carga' }]);
    } else {
      await sendWhatsAppMessage(senderPhone, "ℹ️ No hay ninguna propiedad activa. Enviame un mensaje con los datos para crear una nueva.");
    }
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
        const canSendAck = await shouldSendImageAck(senderPhone);
        if (canSendAck) {
          await sendWhatsAppMessage(senderPhone, "📸 *¡Foto guardada con éxito!* ¿Algo más para agregar?", [{ id: 'finalizar', title: 'Finalizar Carga' }]);
        } else {
          console.log(`Silenciando mensaje de éxito de foto para ${senderPhone} (debounce)`);
        }
        return;
      }
    }

    // CASO B: El mensaje es de texto o audio (acompañado o no de imagen)
    if (processedText) {
      if (cleanedText === 'listo') {
        const propertyLink = `https://${tenantId}.${APP_DOMAIN}/?p=${propertyId}`;
        await clearSession(senderPhone);
        await sendWhatsAppMessage(senderPhone, `✅ *¡Registro completado!* Ya guardé la propiedad. Puedes revisarla en el panel web.\n\n🔗 *Ver propiedad:* ${propertyLink}`);
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
        
        // Botones contextuales: si pasó mucho tiempo, ofrecer continuar o finalizar
        let responseMsg = aiResponse.chatResponse || "📝 *¡Detalles actualizados!*";
        const buttons = timeWarning 
          ? [{ id: 'continuar', title: 'Seguir Cargando' }, { id: 'finalizar', title: 'Finalizar Carga' }]
          : [{ id: 'finalizar', title: 'Finalizar Carga' }];
        await sendWhatsAppMessage(senderPhone, responseMsg, buttons);
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

  // Deep link a la propiedad recién creada
  const propertyLink = `https://${tenantId}.${APP_DOMAIN}/?p=${propertyId}`;
  responseMsg += `\n\n🔗 *Ver propiedad:* ${propertyLink}`;
  
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
