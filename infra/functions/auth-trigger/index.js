const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const FREE_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'yahoo.com.ar',
  'icloud.com', 'aol.com', 'zoho.com', 'protonmail.com', 'proton.me', 'mail.com',
  'gmx.com', 'yandex.com', 'live.com.ar', 'hotmail.com.ar', 'outlook.com.ar'
]);

function getTenantIdFromEmail(email) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "demo";
  
  const localPart = email.substring(0, atIndex).toLowerCase();
  const domain = email.substring(atIndex + 1).toLowerCase();
  
  // Si es un dominio público/gratuito común, usamos la parte local (delante del @)
  if (FREE_DOMAINS.has(domain)) {
    // Reemplazar caracteres no alfanuméricos por guiones
    return localPart.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  
  // Si es un dominio propio, usamos el nombre del dominio
  const domainPart = domain.split(".")[0];
  return domainPart.replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Trigger que se ejecuta al crear un usuario en Firebase Auth.
 * Determina el tenant_id basándose en el dominio o la parte local del correo electrónico y asigna los Custom Claims.
 */
exports.processSignUp = functions.auth.user().onCreate(async (user) => {
  const email = user.email;
  
  if (!email) {
    console.log(`Usuario creado sin email (UID: ${user.uid}). Ignorando.`);
    return null;
  }

  const tenantId = getTenantIdFromEmail(email);

  console.log(`Procesando registro para ${email}. Asignando tenant_id: ${tenantId}`);

  try {
    // 1. Verificar si el correo ya está registrado como operador en Firestore.
    // Si ya existe, significa que es un operador y no debe ser tratado como admin por este trigger.
    const operatorsSnap = await admin.firestore()
      .collection("operadores")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!operatorsSnap.empty) {
      console.log(`El usuario ${email} es un operador registrado. Ignorando trigger de admin.`);
      return null;
    }

    // Definir los Custom Claims de administrador
    const customClaims = {
      admin: true,
      tenant_id: tenantId
    };

    // Establecer las claims en la cuenta de Firebase Auth
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    console.log(`Claims de seguridad asignadas exitosamente al usuario ${user.uid}`);

    // Opcional: Crear un registro del administrador en una colección /admins de Firestore
    await admin.firestore().collection("admins").doc(user.uid).set({
      email: email,
      tenant_id: tenantId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return null;
  } catch (error) {
    console.error("Error al asignar Custom Claims o crear registro en Firestore:", error);
    throw new functions.https.HttpsError("internal", "No se pudieron establecer los permisos de tenant.");
  }
});
