const axios = require('axios');

// Idealmente desde env vars
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || 'fake-phone-id';
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || 'fake-access-token';

/**
 * Envía un mensaje de texto vía WhatsApp Cloud API
 * @param {string} to Número de destino (con código de país)
 * @param {string} text Mensaje a enviar
 */
async function sendWhatsAppMessage(to, text, isRetry = false) {
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
    const errorData = error.response?.data?.error;
    const errorCode = errorData?.code;
    
    // Si falla porque el número no está en la whitelist (código 131030) y es un número de Argentina (empieza con 549)
    if (!isRetry && errorCode === 131030 && to.startsWith('549') && to.length === 13) {
      const fallbackTo = '54' + to.substring(3); // Elimina el '9' (ej: 549236... -> 54236...)
      console.log(`[Sandbox Retry] Reintentando enviar a formato sin '9': ${fallbackTo}`);
      return await sendWhatsAppMessage(fallbackTo, text, true);
    }
    
    console.error(`Error enviando mensaje WA a ${to}:`, error.response?.data || error.message);
    // No lanzamos error para no romper la tarea principal si solo falla la notificación
  }
}

module.exports = {
  sendWhatsAppMessage
};
