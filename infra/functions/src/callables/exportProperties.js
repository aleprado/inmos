const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { db } = require("../config/firebase");

/**
 * Función llamable (Callable) para exportar el catálogo de propiedades.
 * Recibe el tenantId como parámetro.
 */
exports.exportTenantData = onCall(async (request) => {
  const data = request.data;
  const tenantId = data.tenantId;

  if (!tenantId) {
    throw new HttpsError('invalid-argument', 'El parámetro tenantId es obligatorio.');
  }

  try {
    const propertiesRef = db.collection('properties');
    const snapshot = await propertiesRef.where('tenantId', '==', tenantId).get();

    if (snapshot.empty) {
      return { properties: [] };
    }

    const properties = [];
    snapshot.forEach(doc => {
      const propData = doc.data();
      // Limpiar datos internos si fuera necesario, o formatear fechas
      properties.push({
        id: doc.id,
        title: propData.title || "",
        type: propData.type || "",
        operation: propData.operation || "",
        price: propData.price || 0,
        currency: propData.currency || "",
        status: propData.status || "pending",
        features: propData.features || {},
        location: propData.location || null,
        images: propData.images || [],
        virtualTourUrl: propData.virtualTourUrl || null, // Soporte para el nuevo feature
        createdAt: propData.createdAt ? propData.createdAt.toDate().toISOString() : null,
        description: propData.description || ""
      });
    });

    // Devolvemos el array estructurado
    return { 
      success: true,
      count: properties.length,
      properties: properties 
    };

  } catch (error) {
    console.error("Error al exportar propiedades:", error);
    throw new HttpsError('internal', 'Error interno al exportar los datos.');
  }
});
