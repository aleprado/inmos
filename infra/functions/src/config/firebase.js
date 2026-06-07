const admin = require('firebase-admin');

// Inicializa la aplicación de admin
if (admin.apps.length === 0) {
  admin.initializeApp();
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
