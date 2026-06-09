/**
 * Inmos Backend - Cloud Functions
 * Archivo principal de exportación (Modular)
 */

const { whatsappWebhook } = require('./webhooks/whatsappWebhook');
const { processMessage } = require('./tasks/processMessageTask');
const { exportTenantData } = require('./callables/exportProperties');
const { processDemoMessage } = require('./callables/processDemoMessage');
const { cleanupDemoProperties } = require('./tasks/cronJobs');

// Exportar las funciones para que Firebase las detecte y despliegue
exports.whatsappWebhook = whatsappWebhook;
exports.processMessage = processMessage;
exports.exportTenantData = exportTenantData;
exports.processDemoMessage = processDemoMessage;
exports.cleanupDemoProperties = cleanupDemoProperties;
