const { db, admin } = require('../config/firebase');
const axios = require('axios');

/**
 * Geocodifica una dirección de texto a coordenadas lat/lng usando OpenStreetMap Nominatim
 */
async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${address}, Argentina`, // Enfocado en Argentina
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'InmosApp/1.0 (contact@inmos.com)'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon)
      };
    }
    return null;
  } catch (error) {
    console.error(`Error al geocodificar dirección "${address}":`, error.message);
    return null;
  }
}


/**
 * Guarda una nueva propiedad generada por la IA en Firestore
 * @param {Object} parsedData Datos estructurados por la IA
 * @param {string} senderPhone Número de WhatsApp del operador
 * @param {string} tenantId ID de la inmobiliaria a la que pertenece el operador
 */
async function saveProperty(parsedData, senderPhone, tenantId) {
  try {
    const propertiesRef = db.collection('properties');
    
    // Geocodificar dirección si existe
    let latitude = null;
    let longitude = null;
    if (parsedData.address) {
      const coords = await geocodeAddress(parsedData.address);
      if (coords) {
        latitude = coords.latitude;
        longitude = coords.longitude;
      }
    }

    // Preparar el payload
    const payload = {
      title: parsedData.title || "Nueva propiedad",
      description: parsedData.description || "",
      operationType: parsedData.operationType || "Venta",
      propertyType: parsedData.propertyType || "Departamento",
      price: parsedData.price || null,
      currency: parsedData.currency || "USD",
      rooms: parsedData.rooms || null,
      bathrooms: parsedData.bathrooms || null,
      area: parsedData.area || null,
      address: parsedData.address || null,
      latitude: latitude,
      longitude: longitude,
      
      // Metadatos internos
      tenant_id: tenantId,
      status: tenantId === 'demo' ? 'approved' : 'pending', // Auto-aprobado para la demo
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      featured: false,
      images: [], // Las imágenes se procesarán en otro flujo o si llegaron en el mensaje
      metadata: {
        source: "whatsapp_ai",
        sender: senderPhone
      }
    };

    const docRef = await propertiesRef.add(payload);
    return docRef.id;

  } catch (error) {
    console.error("Error al guardar propiedad en DB:", error);
    throw new Error("Error interno al guardar los datos.");
  }
}

/**
 * Obtiene el tenantId asociado a un operador basado en su número de teléfono
 */
async function getOperatorTenant(phoneNumber) {
  try {
    const opDoc = await db.collection('operadores').doc(phoneNumber).get();
    if (!opDoc.exists) {
      return null;
    }
    return opDoc.data().tenant_id;
  } catch (error) {
    console.error("Error al buscar operador:", error);
    return null;
  }
}

/**
 * Obtiene una propiedad por su ID
 */
async function getPropertyById(propertyId) {
  try {
    const doc = await db.collection('properties').doc(propertyId).get();
    if (!doc.exists) return null;
    return doc.data();
  } catch (error) {
    console.error(`Error al obtener propiedad ${propertyId}:`, error);
    return null;
  }
}

/**
 * Actualiza los campos de una propiedad existente
 */
async function updateProperty(propertyId, updatedData) {
  try {
    const payload = {
      ...updatedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Si se actualiza la dirección, volvemos a geocodificar para actualizar el pin del mapa
    if (updatedData.address) {
      const coords = await geocodeAddress(updatedData.address);
      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
      }
    }
    
    await db.collection('properties').doc(propertyId).update(payload);
    console.log(`Propiedad ${propertyId} actualizada.`);
  } catch (error) {
    console.error(`Error al actualizar propiedad ${propertyId}:`, error);
    throw error;
  }
}

/**
 * Agrega una URL de imagen al array de imágenes de la propiedad
 */
async function appendImageToProperty(propertyId, imageUrl) {
  try {
    await db.collection('properties').doc(propertyId).update({
      images: admin.firestore.FieldValue.arrayUnion(imageUrl),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Imagen agregada a la propiedad ${propertyId}: ${imageUrl}`);
  } catch (error) {
    console.error(`Error al agregar imagen a propiedad ${propertyId}:`, error);
    throw error;
  }
}

module.exports = {
  saveProperty,
  getOperatorTenant,
  getPropertyById,
  updateProperty,
  appendImageToProperty
};
