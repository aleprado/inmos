const { GoogleGenerativeAI } = require('@google/generative-ai');

// Se obtiene desde las variables de entorno / secrets de Firebase (.env)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'fake-api-key-for-local';

const GEMINI_PROCESSING_MODEL = process.env.GEMINI_PROCESSING_MODEL || 'gemini-2.5-flash';
const GEMINI_TRANSCRIPTION_MODEL = process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-2.5-flash';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Modelo para procesamiento/agente de IA (extracción y fusión de datos)
const aiAgentModel = genAI.getGenerativeModel({ model: GEMINI_PROCESSING_MODEL });

// Modelo para transcripción de audio
const aiTranscriptionModel = genAI.getGenerativeModel({ model: GEMINI_TRANSCRIPTION_MODEL });

module.exports = {
  genAI,
  aiAgentModel,
  aiTranscriptionModel
};
