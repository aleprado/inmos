const axios = require('axios');

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
    if (!WA_ACCESS_TOKEN || WA_ACCESS_TOKEN === 'fake-access-token' || WA_PHONE_NUMBER_ID === 'fake-phone-id') {
      console.log(`[Mock WA] Enviando mensaje a ${to}: ${text}`);
      return;
    }

    const url = `https://graph.facebook.com/v17.0/${WA_PHONE_NUMBER_ID}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text }
    };

    await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Mensaje WA enviado a ${to}`);
  } catch (error) {
    console.error(`Error enviando mensaje WA a ${to}:`, error.response?.data || error.message);
    // No lanzamos error para no romper la tarea principal si solo falla la notificación
  }
}

module.exports = {
  sendWhatsAppMessage
};
