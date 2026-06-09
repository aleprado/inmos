const axios = require('axios');
const { db, admin } = require('../config/firebase');
const { EventEmitter } = require('events');
const demoEventEmitter = new EventEmitter();

// Idealmente desde env vars
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || 'fake-phone-id';
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || 'fake-access-token';

/**
 * Envía un mensaje de texto vía WhatsApp Cloud API
 * @param {string} to Número de destino (con código de país)
 * @param {string} text Mensaje a enviar
 */
async function sendWhatsAppMessage(to, text) {
  try {
    // Interceptar mensajes dirigidos a la demo web
    if (to && to.startsWith('demo_session_')) {
      console.log(`[Demo WA] Emitiendo respuesta del bot para la sesión ${to}: ${text}`);
      demoEventEmitter.emit('message', { to, text });
      return;
    }

    if (!WA_ACCESS_TOKEN || WA_ACCESS_TOKEN === 'fake-access-token' || WA_PHONE_NUMBER_ID === 'fake-phone-id') {
      console.log(`[Mock WA] Enviando mensaje a ${to}: ${text}`);
      return;
    }

    // En producción, Meta exige el 9 para números de Argentina (ej: 549...).
    // Pero en el Sandbox de Meta, existe un bug donde el número de prueba se registra sin el 9.
    // Detectamos si es Sandbox usando tu ID de teléfono de prueba o una flag.
    const isSandbox = WA_PHONE_NUMBER_ID === '1216214438232612' || process.env.WA_SANDBOX === 'true';
    
    let targetTo = to;
    if (isSandbox && to.startsWith('549') && to.length === 13) {
      targetTo = '54' + to.substring(3); // Remueve el '9' directamente para el Sandbox (ej: 549236... -> 54236...)
      console.log(`[Sandbox] Enviando directo sin '9' a: ${targetTo}`);
    }

    const url = `https://graph.facebook.com/v17.0/${WA_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: targetTo,
      type: "text",
      text: { body: text }
    };

    await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Mensaje WA enviado a ${targetTo}`);
  } catch (error) {
    console.error(`Error enviando mensaje WA a ${to}:`, error.response?.data || error.message);
    // No lanzamos error para no romper la tarea principal si solo falla la notificación
  }
}

module.exports = {
  sendWhatsAppMessage,
  demoEventEmitter
};
