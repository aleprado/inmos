const admin = require('firebase-admin');

// Inicializa la aplicación de admin
if (admin.apps.length === 0) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'inmos-2c701';
  admin.initializeApp({
    storageBucket: process.env.STORAGE_BUCKET || `${projectId}-inmos-media`
  });
}

const db = admin.firestore();
const storage = admin.storage();
const auth = admin.auth();

module.exports = {
  admin,
  db,
  storage,
  auth
};
