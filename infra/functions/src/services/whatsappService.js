'use strict';

const https = require('https');

const WA_API_VERSION = 'v20.0';

/**
 * Sends a WhatsApp message to a resident when someone rings the door.
 *
 * Requires env vars:
 *   WA_ACCESS_TOKEN     — Meta Graph API token
 *   WA_PHONE_NUMBER_ID  — WhatsApp Business sender phone number ID
 *   APP_DOMAIN          — e.g. https://timbreqr.app
 *
 * The resident must have previously opted in (sent at least one message to the
 * WA Business number), or you need a pre-approved template for outbound.
 * For MVP we use a free-form text message inside the 24h window.
 * For production, replace with sendTemplate() using a pre-approved template.
 */

/**
 * Sends the ring notification to the resident's WhatsApp.
 * @param {object} opts
 * @param {string} opts.toPhone     — E.164 format, e.g. "5491112345678"
 * @param {string} opts.doorLabel   — e.g. "Puerta Principal"
 * @param {string} opts.sessionId
 * @param {string} [opts.unitName]
 */
async function sendRingNotification({ toPhone, doorLabel, sessionId, unitName }) {
  const domain = process.env.APP_DOMAIN || 'https://timbreqr.app';
  const residentUrl = `${domain}/resident.html?s=${sessionId}`;

  // Free-form text (works within 24h opt-in window)
  const body = [
    `🔔 *Timbre QR — Hay alguien en la puerta*`,
    unitName ? `🏠 Unidad: ${unitName}` : null,
    `🚪 ${doorLabel}`,
    ``,
    `Respondé desde acá (expira en 10 min):`,
    residentUrl,
  ].filter(Boolean).join('\n');

  return sendWAMessage({
    to: normalizePhone(toPhone),
    type: 'text',
    text: { body, preview_url: false },
  });
}

/**
 * Sends the ring notification using a pre-approved template (for production).
 * Template name must be approved in Meta Business Manager.
 *
 * @param {object} opts
 * @param {string} opts.toPhone
 * @param {string} opts.doorLabel
 * @param {string} opts.sessionId
 * @param {string} [opts.templateName]  — default: 'timbre_ring'
 */
async function sendRingTemplate({ toPhone, doorLabel, sessionId, templateName = 'timbre_ring' }) {
  const domain = process.env.APP_DOMAIN || 'https://timbreqr.app';
  const residentUrl = `${domain}/resident.html?s=${sessionId}`;

  return sendWAMessage({
    to: normalizePhone(toPhone),
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_AR' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: doorLabel },
            { type: 'text', text: residentUrl },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: sessionId }],
        },
      ],
    },
  });
}

// ── Internal ────────────────────────────────────────────────────────────────

function sendWAMessage(payload) {
  return new Promise((resolve, reject) => {
    const token = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

    if (!token || !phoneNumberId) {
      console.warn('[WhatsApp] WA_ACCESS_TOKEN or WA_PHONE_NUMBER_ID not set — skipping');
      return resolve({ skipped: true });
    }

    const body = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...payload,
    });

    const options = {
      hostname: 'graph.facebook.com',
      path: `/${WA_API_VERSION}/${phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            console.error('[WhatsApp] API error:', parsed);
            reject(new Error(parsed?.error?.message || 'WhatsApp API error'));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Normalizes an Argentine phone number to E.164 without the '+'.
 * Handles: 011-XXXX-XXXX, 15-XXXX-XXXX, +549..., 549..., 11XXXXXXXX
 */
function normalizePhone(raw) {
  if (!raw) return raw;
  // Strip everything except digits
  let digits = raw.replace(/\D/g, '');

  // Already has country+9: 5491112345678
  if (digits.startsWith('549') && digits.length === 13) return digits;
  // Has country without 9: 5411XXXXXXXX → 54911XXXXXXXX
  if (digits.startsWith('54') && digits.length === 12) {
    return '549' + digits.slice(2);
  }
  // Local with 0: 0111XXXXXXXX → 5491XXXXXXXX
  if (digits.startsWith('0') && digits.length === 11) {
    return '549' + digits.slice(1);
  }
  // Local without 0: 1112345678 (10 digits)
  if (digits.length === 10) {
    return '549' + digits;
  }
  // Fallback: return as-is
  return digits;
}

module.exports = { sendRingNotification, sendRingTemplate, normalizePhone };
