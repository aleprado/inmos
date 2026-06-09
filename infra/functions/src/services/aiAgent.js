const { aiModel } = require('../config/ai');

const SYSTEM_PROMPT = `
Eres un agente inmobiliario experto. Tu tarea es extraer información estructurada de un mensaje enviado por un corredor inmobiliario. 
El mensaje puede contener texto, pero también puede venir acompañado de una nota de voz (audio) o una fotografía de la propiedad.
Debes analizar todo el contenido provisto (texto, audio o imagen) y devolver estrictamente un objeto JSON con la siguiente estructura y nada más.

Estructura JSON esperada:
{
  "operationType": "Venta" | "Alquiler" | "Alquiler Temporario" (Infiera del contexto si no es explícito),
  "propertyType": "Departamento" | "Casa" | "Oficina" | "Local Comercial" | "Terreno",
  "title": "Un título comercial atractivo corto (ej: Hermoso Depto 3 Amb en Palermo)",
  "price": número entero (ej: 150000) o null si no se especifica,
  "currency": "USD" | "ARS",
  "rooms": número entero (cantidad de ambientes/dormitorios) o null,
  "bathrooms": número entero o null,
  "area": número entero (superficie en m2) o null,
  "description": "Una descripción redactada para venta, mejorando el texto original",
  "address": "La dirección o zona mencionada" o null si NO se menciona,
  "missingLocation": boolean (true si no se menciona dirección, barrio, zona o ciudad en el mensaje original, false si hay alguna referencia de ubicación)
}

REGLA CRÍTICA:
Si el contenido provisto NO menciona una dirección, barrio, ciudad, o zona, DEBES obligatoriamente marcar "missingLocation": true. 
Si menciona al menos un barrio o zona (ej: "en Palermo", "por el centro"), pon "missingLocation": false y extrae esa zona en "address".
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
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
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
async function mergePropertyDetails(existingProperty, newText) {
  try {
    const prompt = `
Eres un asistente experto en el mercado inmobiliario. 
Se te proporcionará el estado actual de los detalles de una propiedad en formato JSON y un nuevo mensaje enviado por el operador de la inmobiliaria.
Tu tarea es analizar el nuevo mensaje e incorporar los nuevos detalles, correcciones o adiciones al JSON original.

JSON original:
${JSON.stringify(existingProperty, null, 2)}

Mensaje del operador:
"${newText}"

Devuelve estrictamente el objeto JSON actualizado con la misma estructura y nada más. No inventes campos. Si el mensaje corrige un dato (ej: "no cuesta 150000, cuesta 140000"), cámbialo. Si agrega datos (ej: "tiene 2 baños"), añádelos.
Estructura esperada:
{
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
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
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

/**
 * Extrae el valor de un único campo a partir del texto del usuario usando Gemini
 */
async function extractSingleField(fieldName, text) {
  try {
    const prompt = `
Tu tarea es extraer el valor para el campo '${fieldName}' a partir de la respuesta del usuario.
El usuario está respondiendo a una pregunta sobre este campo en específico.

Campo a extraer: '${fieldName}' (puede ser 'rooms', 'bathrooms' o 'area').
Respuesta del usuario: "${text}"

Debes devolver estrictamente un objeto JSON con el siguiente formato y nada más:
{
  "${fieldName}": número entero o null si no se puede determinar o si no es un número válido.
}

Ejemplos:
- Si el campo es 'bathrooms' y la respuesta es 'tiene 2 baños', devuelve: { "bathrooms": 2 }
- Si el campo es 'area' y la respuesta es 'son 80 metros', devuelve: { "area": 80 }
- Si el texto es 'no sé', 'omitir', 'después', devuelve: { "${fieldName}": null }

JSON Output:`;

    const { genAI } = require('../config/ai');
    const tryModels = async (modelNames) => {
      let lastError;
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([{ text: prompt }]);
          console.log(`[AI-Extract] Modelo ${modelName} utilizado exitosamente.`);
          return result.response.text();
        } catch (error) {
          console.warn(`[AI-Extract] Falló el modelo ${modelName}:`, error.message);
          lastError = error;
        }
      }
      throw lastError;
    };

    const modelsToTry = [
      "gemini-1.5-flash", 
      "gemini-1.5-pro", 
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro-latest",
      "gemini-pro"
    ];

    const responseText = await tryModels(modelsToTry);
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error(`Error en extractSingleField para ${fieldName}:`, error);
    return { [fieldName]: null };
  }
}

module.exports = {
  parsePropertyMessage,
  mergePropertyDetails,
  extractSingleField
};
