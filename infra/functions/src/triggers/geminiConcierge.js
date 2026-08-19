'use strict';

const { db } = require('../config/firebase');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `Sos el recepcionista virtual de un edificio o domicilio particular.
Un visitante está en la puerta y el residente no está disponible ahora mismo.
Tu tarea:
1. Saludar amablemente al visitante.
2. Preguntar quién es y el motivo de su visita.
3. Si es un repartidor (Mercado Libre, Andreani, OCA, Correo, etc.), preguntarle si puede dejar el paquete en portería, buzón o si necesita firma.
4. Tomar un mensaje o recado breve para el residente.
5. Siempre ser cordial, conciso y en español rioplatense informal.
No digas que sos una IA a menos que te lo pregunten directamente. Respondé siempre en 1-2 oraciones.`;

/**
 * Handles visitor messages when the session is in 'ai_mode'.
 * Called via callable from the visitor PWA.
 */
async function handleConciergeMessage(req, res) {
  // This is used as an HTTP function called by the visitor PWA
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { sessionId, message } = req.body || {};
  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' });
  }

  try {
    // Validate session exists and is in ai_mode
    const sessionRef = db.doc(`sessions/${sessionId}`);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionSnap.data();
    // Allow ai_mode or missed (visitor still wants to leave a message)
    if (!['ai_mode', 'missed'].includes(session.status)) {
      return res.status(409).json({ error: 'Session is not in AI mode' });
    }

    // Get conversation history from Firestore
    const historySnap = await db
      .collection(`sessions/${sessionId}/messages`)
      .orderBy('createdAt', 'asc')
      .limit(20)
      .get();

    const history = historySnap.docs.map(d => d.data());

    // Build Gemini chat history
    const chatHistory = history.map(m => ({
      role: m.role === 'visitor' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessage(message);
    const aiReply = result.response.text();

    // Save visitor message + AI reply
    const batch = db.batch();
    const visitorMsgRef = db.collection(`sessions/${sessionId}/messages`).doc();
    batch.set(visitorMsgRef, {
      role: 'visitor',
      text: message,
      createdAt: new Date(),
    });
    const aiMsgRef = db.collection(`sessions/${sessionId}/messages`).doc();
    batch.set(aiMsgRef, {
      role: 'ai',
      text: aiReply,
      createdAt: new Date(),
    });
    // Update session status to ai_mode if it wasn't already
    batch.update(sessionRef, { status: 'ai_mode', aiActive: true });
    await batch.commit();

    // Generate smart quick-reply suggestions for resident (3 options)
    let smartReplies = [];
    try {
      const srModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' });
      const srResult = await srModel.generateContent(
        `Dado que un visitante dijo: "${message}", generá exactamente 3 respuestas rápidas cortas (máx 6 palabras cada una) que el residente puede enviar. Respondé SOLO con las 3 opciones separadas por | sin numerarlas.`
      );
      smartReplies = srResult.response.text().split('|').map(s => s.trim()).filter(Boolean).slice(0, 3);
    } catch (_) { /* non-fatal */ }

    return res.status(200).json({ reply: aiReply, smartReplies });

  } catch (err) {
    console.error('[geminiConcierge]', err);
    return res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
}

module.exports = { handleConciergeMessage };
