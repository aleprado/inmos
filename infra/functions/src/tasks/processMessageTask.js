const { onTaskDispatched } = require('firebase-functions/v2/tasks');
const { parsePropertyMessage, mergePropertyDetails, extractSingleField } = require('../services/aiAgent');
const { saveProperty, getOperatorTenant, getPropertyById, updateProperty, appendImageToProperty } = require('../services/propertyService');
const { getSession, createOrUpdateSession, clearSession, isSessionValid } = require('../services/sessionService');
const { sendWhatsAppMessage } = require('../services/whatsappSender');
const { getMediaBufferFromId, uploadImageToStorage } = require('../services/whatsappMedia');
const { aiModel } = require('../config/ai');

/**
 * Transcribe un archivo de audio a texto usando Gemini
 */
async function transcribeAudio(audioBuffer, mimeType) {
  try {
    const prompt = "Transcribe el siguiente audio de WhatsApp exactamente. No agregues comentarios, explicaciones, introducciones ni formato adicional. Si no hay voz inteligible, devuelve vacío.";
    const result = await aiModel.generateContent([
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
 * Implementa una máquina de estados para gestionar la carga progresiva de imágenes y datos.
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
    await sendWhatsAppMessage(senderPhone, "✅ *¡Entendido!* Finalizamos el registro de esta propiedad. Todos los detalles actuales han sido guardados. Ya puedes revisarla en el panel web.");
    return;
  }

  // 3. Obtener sesión actual
  const session = await getSession(senderPhone);
  const hasActiveSession = isSessionValid(session);

  // --- ESCENARIO 1: SESIÓN ACTIVA ---
  if (hasActiveSession) {
    const propertyId = session.lastPropertyId;
    console.log(`Sesión activa encontrada para la propiedad: ${propertyId} (Estado: ${session.status})`);

    // CASO A: El mensaje contiene una Imagen
    if (mediaId && mimeType && mimeType.startsWith('image/')) {
      if (session.status === 'waiting_images') {
        console.log(`Descargando e insertando imagen en propiedad existente: ${propertyId}`);
        const mediaBuffer = await getMediaBufferFromId(mediaId);
        const imageUrl = await uploadImageToStorage(mediaBuffer, tenantId, mimeType);
        await appendImageToProperty(propertyId, imageUrl);
        
        // Actualizar la fecha de última actividad para evitar que expire la sesión
        await createOrUpdateSession(senderPhone, propertyId, 'waiting_images', session.missingFields, session.currentField);
        await sendWhatsAppMessage(senderPhone, "📸 *¡Foto agregada con éxito!* Sigue enviando fotos o escribe *'listo'* para continuar.");
        return;
      } else {
        // Si estamos esperando un campo y mandan una foto
        await sendWhatsAppMessage(senderPhone, "⚠️ Estoy esperando que respondas a la pregunta anterior. Envía la respuesta o escribe *'omitir'*.");
        return;
      }
    }

    // CASO B: El mensaje es de texto o audio (detalles descriptivos o respuestas a preguntas)
    if (processedText) {
      // Sub-Caso B1: El operador finaliza la carga de fotos escribiendo "listo"
      if (session.status === 'waiting_images' && (cleanedText === 'listo' || cleanedText === 'omitir')) {
        console.log("El operador indicó 'listo'. Pasando a validar campos vacíos...");
        const propertyData = await getPropertyById(propertyId);
        if (!propertyData) {
          await clearSession(senderPhone);
          await sendWhatsAppMessage(senderPhone, "⚠️ Error al recuperar la propiedad actual. Por favor inicia de nuevo.");
          return;
        }

        // Identificar qué campos clave están nulos en la base de datos
        const missing = [];
        if (propertyData.bathrooms === null || propertyData.bathrooms === undefined) missing.push('bathrooms');
        if (propertyData.rooms === null || propertyData.rooms === undefined) missing.push('rooms');
        if (propertyData.area === null || propertyData.area === undefined) missing.push('area');

        if (missing.length > 0) {
          const nextField = missing[0];
          const remaining = missing.slice(1);
          
          // Cambiar estado de sesión a waiting_field
          await createOrUpdateSession(senderPhone, propertyId, 'waiting_field', remaining, nextField);
          
          const fieldQuestions = {
            bathrooms: "🤖 ¿Cuántos *baños* tiene la propiedad? (Escribe el número o responde *'omitir'*).",
            rooms: "🤖 ¿Cuántos *ambientes/dormitorios* tiene? (Escribe el número o responde *'omitir'*).",
            area: "🤖 ¿Cuál es la *superficie total en m2*? (Escribe el número o responde *'omitir'*)."
          };
          await sendWhatsAppMessage(senderPhone, fieldQuestions[nextField]);
          return;
        } else {
          // No hay campos vacíos, terminar
          await clearSession(senderPhone);
          await sendWhatsAppMessage(senderPhone, "✅ *¡Registro completado!* Ya guardé la propiedad y sus imágenes. Puedes verla en el panel de administrador.");
          return;
        }
      }

      // Sub-Caso B2: Estamos esperando la respuesta para un campo específico (waiting_field)
      if (session.status === 'waiting_field') {
        const currentField = session.currentField;
        let fieldValue = null;

        if (cleanedText !== 'omitir' && cleanedText !== 'saltar') {
          console.log(`Extrayendo valor numérico para el campo '${currentField}' de la respuesta: "${processedText}"`);
          const extracted = await extractSingleField(currentField, processedText);
          fieldValue = extracted[currentField];
        }

        // Si pudimos extraer un valor numérico válido, actualizamos la propiedad
        if (fieldValue !== null && fieldValue !== undefined) {
          await updateProperty(propertyId, { [currentField]: fieldValue });
        }

        // Verificar si quedan más campos por preguntar
        const missing = session.missingFields || [];
        if (missing.length > 0) {
          const nextField = missing[0];
          const remaining = missing.slice(1);

          await createOrUpdateSession(senderPhone, propertyId, 'waiting_field', remaining, nextField);

          const fieldQuestions = {
            bathrooms: "🤖 ¿Cuántos *baños* tiene la propiedad? (Escribe el número o responde *'omitir'*).",
            rooms: "🤖 ¿Cuántos *ambientes/dormitorios* tiene? (Escribe el número o responde *'omitir'*).",
            area: "🤖 ¿Cuál es la *superficie total en m2*? (Escribe el número o responde *'omitir'*)."
          };
          await sendWhatsAppMessage(senderPhone, fieldQuestions[nextField]);
          return;
        } else {
          // No quedan campos, cerrar sesión
          await clearSession(senderPhone);
          await sendWhatsAppMessage(senderPhone, "✅ *¡Registro completado!* He guardado todos los datos. La propiedad ya está lista para revisión en el panel web.");
          return;
        }
      }

      // Sub-Caso B3: Envían texto adicional en modo waiting_images (quieren expandir la descripción)
      if (session.status === 'waiting_images') {
        console.log(`Combinando nueva descripción en propiedad existente: ${propertyId}`);
        const propertyData = await getPropertyById(propertyId);
        if (propertyData) {
          const mergedData = await mergePropertyDetails(propertyData, processedText);
          await updateProperty(propertyId, mergedData);
          
          // Actualizar la última actividad
          await createOrUpdateSession(senderPhone, propertyId, 'waiting_images', session.missingFields, session.currentField);
          await sendWhatsAppMessage(senderPhone, "📝 *¡Detalles actualizados!* He incorporado la nueva descripción al borrador. Sigue enviando fotos o escribe *'listo'* para continuar.");
          return;
        }
      }
    }
  }

  // --- ESCENARIO 2: CREACIÓN DE NUEVA PROPIEDAD ---
  console.log("No hay sesión activa para el operador. Iniciando nueva propiedad...");

  // Obligar a que el primer mensaje tenga texto o sea un audio (no puede iniciar solo enviando una foto huérfana)
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

  console.log("Llamando al Agente IA Multimodal...");
  const parsedData = await parsePropertyMessage(processedText, mediaBuffer, mimeType);
  console.log("Datos extraídos por la IA:", parsedData);

  if (imageUrl) {
    parsedData.images = [imageUrl];
  }

  // Validar ubicación inicial obligatoria
  if (parsedData.missingLocation) {
    console.log("Ubicación faltante. Solicitando dirección al operador...");
    await sendWhatsAppMessage(senderPhone, "🤖 *¡Hola!* Pude procesar la descripción, pero me falta la ubicación. *¿En qué dirección, barrio o zona queda esta propiedad?* Responde con la ubicación para iniciar el registro.");
    return;
  }

  // Guardar en Firestore
  const propertyId = await saveProperty(parsedData, senderPhone, tenantId);

  // Calcular qué campos clave quedaron vacíos
  const missing = [];
  if (parsedData.bathrooms === null || parsedData.bathrooms === undefined) missing.push('bathrooms');
  if (parsedData.rooms === null || parsedData.rooms === undefined) missing.push('rooms');
  if (parsedData.area === null || parsedData.area === undefined) missing.push('area');

  // Inicializar sesión
  await createOrUpdateSession(senderPhone, propertyId, 'waiting_images', missing, null);

  const successMsg = `✅ *¡Propiedad registrada con éxito!*\n\nTítulo: ${parsedData.title}\nRef: ${propertyId}\n\n🤖 ¿Quieres agregar imágenes? Envía las fotos ahora (puedes enviar varias). Cuando termines, responde con la palabra *'listo'*.`;
  await sendWhatsAppMessage(senderPhone, successMsg);
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
    console.error("Error en processMessageTask:", error);
    await sendWhatsAppMessage(senderPhone, "❌ Ocurrió un error al procesar tu mensaje. Por favor, inténtalo más tarde.");
    throw error;
  }
});
