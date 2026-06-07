const functions = require("firebase-functions");
const admin = require("firebase-admin");
const QRCode = require("qrcode");

admin.initializeApp();

/**
 * Trigger de Firestore que se dispara cuando una propiedad se actualiza.
 * Si el estado cambia a 'approved', genera un código QR que apunta a la página de la propiedad
 * y guarda el código QR en Firebase Storage, actualizando la propiedad con el enlace público.
 */
exports.generatePropertyQR = functions.firestore
  .document("properties/{propertyId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const propertyId = context.params.propertyId;

    // Verificar si el estado cambió a 'approved'
    if (beforeData.status === "approved" || afterData.status !== "approved") {
      console.log(`Propiedad ${propertyId} no requiere QR (Estado anterior: ${beforeData.status}, Estado actual: ${afterData.status}).`);
      return null;
    }

    console.log(`Generando código QR para la propiedad aprobada: ${propertyId}`);

    // Resolver el subdominio dinámico a partir del tenant_id de la propiedad
    // Ejemplo: tenant_id.inmos.app/propiedad/id
    const tenantId = afterData.tenant_id || "demo";
    const propertyUrl = `https://${tenantId}.inmos.app/propiedad/${propertyId}`;

    try {
      // Generar el código QR como un Buffer binario en formato PNG
      const qrPngBuffer = await QRCode.toBuffer(propertyUrl, {
        type: "png",
        width: 400,
        margin: 2,
        color: {
          dark: "#0b57d0", // Un azul premium moderno en vez del negro liso
          light: "#ffffff"
        }
      });

      // Subir el buffer a Cloud Storage en la ruta qrcodes/{propertyId}.png
      const bucket = admin.storage().bucket();
      const file = bucket.file(`qrcodes/${propertyId}.png`);

      await file.save(qrPngBuffer, {
        metadata: {
          contentType: "image/png",
          metadata: {
            propertyId: propertyId,
            generatedAt: new Date().toISOString()
          }
        }
      });

      // Configurar el archivo para que sea públicamente legible (o crear una URL firmada de largo plazo)
      // Nota: Hacemos el archivo público para el fácil escaneo y render en el front de cara al usuario.
      await file.makePublic();
      const qrCodeUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

      console.log(`Código QR subido exitosamente. URL: ${qrCodeUrl}`);

      // Actualizar el documento de la propiedad en Firestore
      await change.after.ref.update({
        qrCodeUrl: qrCodeUrl,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Documento de propiedad ${propertyId} actualizado con la URL del QR.`);
      return null;
    } catch (error) {
      console.error(`Error procesando generación de código QR para propiedad ${propertyId}:`, error);
      return null;
    }
  });
