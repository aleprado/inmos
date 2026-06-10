const { aiModel } = require('../config/ai');

const SYSTEM_PROMPT = `
Eres un asistente autónomo inmobiliario. Tu tarea es ayudar a un corredor a crear el borrador de una propiedad.
El mensaje puede contener texto, audio o imágenes.
Debes extraer la información y dirigir la conversación para pedir amigablemente los datos faltantes.

Estructura JSON esperada:
{
  "propertyData": {
    "operationType": "Venta" | "Alquiler" | "Alquiler Temporario",
    "propertyType": "Departamento" | "Casa" | "Oficina" | "Local Comercial" | "Terreno",
    "title": "Un título comercial atractivo corto (ej: Hermoso Depto 3 Amb en Palermo)",
    "price": número entero (ej: 150000) o null,
    "currency": "USD" | "ARS",
    "rooms": número entero o null,
    "bathrooms": número entero o null,
    "area": número entero o null,
    "description": "Una descripción redactada para venta, mejorando el texto original",
    "address": "La dirección o zona" o null
  },
  "missingLocation": boolean (true si address es null o ambiguo),
  "chatResponse": "Tu respuesta conversacional. Si faltan datos importantes (como el precio, la ubicación, ambientes o baños según el tipo de inmueble), pídelos amigablemente. Si no falta nada, confirma que está listo y pregunta si quiere subir fotos (si aún no lo hizo). Usa lenguaje natural, no parezcas un robot.",
  "isComplete": boolean (true si tenemos todos los datos esenciales para este tipo de propiedad y no falta pedir nada)
}

REGLA CRÍTICA:
Si missingLocation es true, DEBES pedir la ubicación en tu chatResponse de forma amigable (idealmente sugiriendo que use el clip de Ubicación de WhatsApp).
`;

async function parsePropertyMessage(messageText, mediaBuffer = null, mimeType = null) {
  try {
    const parts = [
      { text: SYSTEM_PROMPT }
    ];

    if (messageText) {
      parts.push({ text: `\n\nMensaje de texto del corredor:\n"""\n${messageText}\n"""\n` });
    }

    if (mediaBuffer && mimeType) {
      parts.push({
        inlineData: {
          data: mediaBuffer.toString("base64"),
          mimeType: mimeType
        }
      });
      parts.push({ text: `\n\nAnaliza el archivo multimedia adjunto para completar la información.` });
    }

    parts.push({ text: `\n\nJSON Output:` });
    
    // Función auxiliar para intentar con varios modelos si el preferido da 404
    const { genAI } = require('../config/ai');
    const tryModels = async (modelNames) => {
      let lastError;
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(parts);
          console.log(`[AI] Modelo ${modelName} utilizado exitosamente.`);
          return result.response.text();
        } catch (error) {
          console.warn(`[AI] Falló el modelo ${modelName}:`, error.message);
          lastError = error;
        }
      }
      throw lastError;
    };

    const modelsToTry = [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      mediaBuffer ? "gemini-pro-vision" : "gemini-pro", // Fallback a v1.0
      "gemini-pro"
    ];

    const responseText = await tryModels(modelsToTry);
    
    // Limpiar posible formato markdown (```json ... ```)
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(jsonString);
    return parsedData;

  } catch (error) {
    console.error("Error en AI Parser:", error);
    throw new Error("No se pudo procesar el mensaje con Inteligencia Artificial.");
  }
}

/**
 * Combina los detalles existentes de una propiedad con información nueva usando Gemini
 */
async function mergePropertyDetails(existingProperty, newText, timeWarning = false) {
  try {
    let warningInstruction = timeWarning 
      ? "\nATENCIÓN: Han pasado más de 10 minutos desde el último mensaje. En tu 'chatResponse', añade amigablemente una advertencia preguntando si este dato es para la misma propiedad, o si quiere enviar la palabra 'terminar' para empezar una nueva."
      : "";

    const prompt = `
Eres un asistente autónomo inmobiliario. 
Tenemos un borrador activo con estos datos:
${JSON.stringify(existingProperty, null, 2)}

El corredor acaba de enviar este mensaje para agregar o corregir datos:
"${newText}"
${warningInstruction}

Analiza el nuevo mensaje y fusiona los datos. Si corrige algo, cámbialo. Si agrega, súmalo.
Devuelve estrictamente el objeto JSON actualizado con el siguiente formato:

{
  "propertyData": {
    "operationType": "Venta" | "Alquiler" | "Alquiler Temporario",
    "propertyType": "Departamento" | "Casa" | "Oficina" | "Local Comercial" | "Terreno",
    "title": "string",
    "price": número entero o null,
    "currency": "USD" | "ARS",
    "rooms": número entero o null,
    "bathrooms": número entero o null,
    "area": número entero o null,
    "description": "string",
    "address": "string" o null
  },
  "chatResponse": "Respuesta conversacional. Confirma qué dato actualizaste. Luego, revisa el JSON resultante: si siguen faltando datos clave (precio, ubicación, ambientes/baños según corresponda), pídelos. Si no falta nada, dile que está completo y puede seguir mandando fotos o escribir 'listo'.",
  "isComplete": boolean
}

JSON Output:`;

    const { genAI } = require('../config/ai');
    const tryModels = async (modelNames) => {
      let lastError;
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([{ text: prompt }]);
          console.log(`[AI-Merge] Modelo ${modelName} utilizado exitosamente.`);
          return result.response.text();
        } catch (error) {
          console.warn(`[AI-Merge] Falló el modelo ${modelName}:`, error.message);
          lastError = error;
        }
      }
      throw lastError;
    };

    const modelsToTry = [
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-pro"
    ];

    const responseText = await tryModels(modelsToTry);
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error en mergePropertyDetails:", error);
    return existingProperty;
  }
}

module.exports = {
  parsePropertyMessage,
  mergePropertyDetails
};
