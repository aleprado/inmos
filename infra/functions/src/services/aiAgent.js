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
    
    const result = await aiModel.generateContent(parts);
    const responseText = result.response.text();
    
    // Limpiar posible formato markdown (```json ... ```)
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(jsonString);
    return parsedData;

  } catch (error) {
    console.error("Error en AI Parser:", error);
    throw new Error("No se pudo procesar el mensaje con Inteligencia Artificial.");
  }
}

module.exports = {
  parsePropertyMessage
};
