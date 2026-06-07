const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializar el SDK de Administración (se conecta automáticamente en el entorno GCP/Firebase)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * Función HTTPS Callable para registrar nuevos operadores.
 * Solo puede ser llamada por un administrador autenticado de la inmobiliaria.
 */
exports.createOperator = functions.https.onCall(async (data, context) => {
  // 1. Validar autenticación del llamador
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "El usuario debe estar autenticado para realizar esta acción."
    );
  }

  // 2. Validar que el llamador sea Administrador
  const callerClaims = context.auth.token;
  if (!callerClaims.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo los administradores autorizados pueden registrar operadores."
    );
  }

  const tenantId = callerClaims.tenant_id;
  if (!tenantId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "El administrador no tiene un identificador de inmobiliaria (tenant_id) válido en sus credenciales."
    );
  }

  // 3. Validar y limpiar parámetros de entrada
  const { name, email, phone } = data;
  if (!name || !email || !phone) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Debes proporcionar 'name', 'email' y 'phone' del operador."
    );
  }

  // Limpiar número de teléfono (quitar espacios, guiones o el signo + si existiera)
  let cleanPhone = phone.replace(/[\s\-\+]/g, "");
  // Agregar prefijo 54 (Argentina) por defecto si no lo tiene
  if (!cleanPhone.startsWith("54")) {
    cleanPhone = "54" + cleanPhone;
  }

  // Asegurar que el email sea nombre@tenant.com (restringido al dominio del tenant)
  const emailPrefix = email.split("@")[0].trim();
  const operatorEmail = `${emailPrefix}@${tenantId}.com`;

  console.log(`Admin ${context.auth.uid} iniciando registro de operador: ${name} (${operatorEmail}, Tel: ${cleanPhone}) para el tenant: ${tenantId}`);

  try {
    // 4. Crear el usuario en Firebase Auth usando el Admin SDK
    // Generar una contraseña temporal aleatoria (ej: Temp123! seguida de caracteres aleatorios)
    const tempPassword = `Temp123!${Math.random().toString(36).slice(-8)}`;

    const userRecord = await admin.auth().createUser({
      email: operatorEmail,
      password: tempPassword,
      displayName: name,
      emailVerified: true // Auto-verificar correo
    });

    console.log(`Usuario creado en Auth con UID: ${userRecord.uid}`);

    // 5. Configurar Custom Claims del nuevo operador
    // El operador hereda el tenant_id pero no tiene permisos de admin
    const operatorClaims = {
      admin: false,
      tenant_id: tenantId
    };

    await admin.auth().setCustomUserClaims(userRecord.uid, operatorClaims);
    console.log(`Claims configuradas para el operador: tenant_id = ${tenantId}`);

    // 6. Guardar el registro en la colección /operadores de Firestore
    // Usamos el número de teléfono como clave del documento para búsquedas rápidas en el webhook
    await admin
      .firestore()
      .collection("operadores")
      .doc(cleanPhone)
      .set({
        nombre: name,
        email: operatorEmail,
        tenant_id: tenantId,
        uid: userRecord.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.uid
      });

    console.log(`Operador registrado con éxito en Firestore en /operadores/${cleanPhone}`);

    // En un entorno productivo real, aquí enviarías un correo de invitación
    // o un mensaje por WhatsApp al operador con sus credenciales de acceso temporal.
    
    return {
      success: true,
      uid: userRecord.uid,
      phone: cleanPhone,
      email: operatorEmail,
      tempPassword: tempPassword, // Retornamos para visualización del admin
      message: "Operador registrado exitosamente en Auth y Firestore."
    };

  } catch (error) {
    console.error("Error al registrar operador:", error);
    
    // Devolver un error HTTP estructurado al frontend
    if (error.code === "auth/email-already-exists") {
      throw new functions.https.HttpsError(
        "already-exists",
        "El correo electrónico ya se encuentra registrado en el sistema."
      );
    }
    
    throw new functions.https.HttpsError(
      "internal",
      `Error interno del servidor al dar de alta el operador: ${error.message}`
    );
  }
});
