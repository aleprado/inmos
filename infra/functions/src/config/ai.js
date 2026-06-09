const { GoogleGenerativeAI } = require('@google/generative-ai');

// Se obtiene desde las variables de entorno / secrets de Firebase (.env)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'fake-api-key-for-local';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Obtener el modelo optimizado para extracción estructurada (Flash)
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

module.exports = {
  genAI,
  aiModel
};
