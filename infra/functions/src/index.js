/**
 * Inmos Backend - Cloud Functions
 * Archivo principal de exportación (Modular)
 */

const { whatsappWebhook } = require('./webhooks/whatsappWebhook');
const { processMessage } = require('./tasks/processMessageTask');
const { exportTenantData } = require('./callables/exportProperties');

// Exportar las funciones para que Firebase las detecte y despliegue
exports.whatsappWebhook = whatsappWebhook;
exports.processMessage = processMessage;
exports.exportTenantData = exportTenantData;
