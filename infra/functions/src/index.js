'use strict';

const { onRequest, onCall } = require('firebase-functions/v2/https');

const { ringDispatcher }        = require('./webhooks/ringDispatcher');
const { handleConciergeMessage } = require('./triggers/geminiConcierge');
const { quickAction }           = require('./callables/quickAction');
const { adminConfig }           = require('./callables/adminConfig');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC HTTP endpoints (no auth required)
// ─────────────────────────────────────────────────────────────────────────────

/** Visitor rings the door via QR scan. POST { doorId, visitorPhoto? } */
exports.ring = onRequest(
  { cors: true, region: 'us-central1', minInstances: 0 },
  ringDispatcher
);

/** Visitor sends a message to the Gemini AI concierge. POST { sessionId, message } */
exports.concierge = onRequest(
  { cors: true, region: 'us-central1', minInstances: 0 },
  handleConciergeMessage
);

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED callables (resident app)
// ─────────────────────────────────────────────────────────────────────────────

/** Resident sends a quick reply text to visitor. { sessionId, message } */
exports.quickAction = onCall(
  { region: 'us-central1' },
  quickAction
);

/** Admin CRUD: units, doors, members. { action, payload } */
exports.adminConfig = onCall(
  { region: 'us-central1' },
  adminConfig
);
