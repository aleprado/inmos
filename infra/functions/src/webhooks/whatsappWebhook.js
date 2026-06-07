const { onRequest } = require('firebase-functions/v2/https');
const { getFunctions } = require('firebase-admin/functions');
const { getOperatorTenant } = require('../services/propertyService');

const WA_VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || 'inmos-webhook-secret-token';

/**
 * Webhook HTTP para WhatsApp.
 * Maneja tanto la verificación GET (Meta) como los POST de mensajes entrantes.
 */
exports.whatsappWebhook = onRequest(async (req, res) => {
  // 1. Verificación inicial de Meta (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === WA_VERIFY_TOKEN) {
      console.log('Webhook verificado exitosamente por Meta.');
      res.status(200).send(challenge);
      return;
    } else {
      res.sendStatus(403);
      return;
    }
  }

  // 2. Recepción de mensajes (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;

      // Verificar que es un evento de mensaje de WhatsApp
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          const message = messages[0];
          const senderPhone = message.from;
          
          let messageText = null;
          let mediaId = null;
          let mimeType = null;

          // Manejar mensaje de texto
          if (message.type === 'text') {
            messageText = message.text.body;
          } 
          // Manejar mensaje de audio
          else if (message.type === 'audio') {
            mediaId = message.audio.id;
            mimeType = message.audio.mime_type;
            console.log(`Audio recibido: ${mediaId} (${mimeType})`);
          } 
          // Manejar mensaje de imagen
          else if (message.type === 'image') {
            mediaId = message.image.id;
            mimeType = message.image.mime_type;
            // Si el usuario mandó texto adjunto a la imagen (caption)
            messageText = message.image.caption || "";
            console.log(`Imagen recibida: ${mediaId} (${mimeType})`);
          } else {
            console.log(`Tipo de mensaje no soportado: ${message.type}`);
            res.sendStatus(200);
            return;
          }

          if (messageText !== null || mediaId !== null) {
            console.log(`Mensaje/Media recibido de ${senderPhone}`);

            // Validación de seguridad RÁPIDA: ¿es un operador registrado?
            // Hacemos esta consulta rápida para evitar encolar tareas inútiles de spam.
            const tenantId = await getOperatorTenant(senderPhone);
            if (!tenantId) {
              console.log(`Spam o no autorizado: ${senderPhone}`);
              res.sendStatus(200);
              return;
            }

            // ENCOLAR LA TAREA ASÍNCRONA
            // En vez de procesar la IA aquí (lo que toma > 5 seg y causa timeouts en Meta),
            // encolamos la tarea en Cloud Tasks (processMessageTask).
            const queue = getFunctions().taskQueue('processMessage');
            
            await queue.enqueue({
              messageText: messageText,
              mediaId: mediaId,
              mimeType: mimeType,
              senderPhone: senderPhone,
              messageId: message.id
            }, {
              scheduleDelaySeconds: 1 // Opcional, ejecuta casi de inmediato
            });
            
            console.log(`Tarea encolada para el mensaje de ${senderPhone}`);
          }
        }
      }
      
      // DEVOLVER HTTP 200 INMEDIATAMENTE
      // Meta requiere que el webhook responda en menos de 10-20 seg o deshabilita el webhook
      res.sendStatus(200);
    } catch (error) {
      console.error("Error crítico en el webhook:", error);
      // Siempre devolver 200 a Meta incluso si fallamos, para no generar penalizaciones
      // a menos que sea un error de auth
      res.sendStatus(200); 
    }
  } else {
    // Métodos no permitidos
    res.sendStatus(405);
  }
});
