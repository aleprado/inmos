const axios = require('axios');
const { storage } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || 'fake-access-token';

/**
 * Obtiene la URL de descarga de un archivo multimedia desde la Graph API de WhatsApp.
 * @param {string} mediaId 
 * @returns {Promise<string>} url del archivo
 */
async function getMediaUrl(mediaId) {
  const url = `https://graph.facebook.com/v17.0/${mediaId}`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${WA_ACCESS_TOKEN}`
    }
  });

  if (!response.data.url) {
    throw new Error('No se pudo obtener la URL del archivo de WhatsApp.');
  }

  return response.data.url;
}

/**
 * Descarga el archivo desde la URL de WhatsApp en formato Buffer.
 * @param {string} mediaUrl 
 * @returns {Promise<Buffer>}
 */
async function downloadMedia(mediaUrl) {
  const response = await axios.get(mediaUrl, {
    headers: {
      'Authorization': `Bearer ${WA_ACCESS_TOKEN}`
    },
    responseType: 'arraybuffer' // Importante para archivos binarios
  });

  return Buffer.from(response.data, 'binary');
}

/**
 * Sube un buffer de imagen a Firebase Cloud Storage y devuelve la URL pública.
 * @param {Buffer} buffer 
 * @param {string} tenantId 
 * @param {string} mimeType ej: 'image/jpeg'
 * @returns {Promise<string>} public url
 */
async function uploadImageToStorage(buffer, tenantId, mimeType = 'image/jpeg') {
  const bucket = storage.bucket();
  const extension = mimeType.split('/')[1] || 'jpg';
  const fileName = `properties/${tenantId}/${uuidv4()}.${extension}`;
  
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType
    }
  });

  // Hacemos el archivo público (o alternativamente generar un signed URL si no es público)
  await file.makePublic();
  
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return publicUrl;
}

/**
 * Orquestador rápido para obtener el buffer desde el ID
 */
async function getMediaBufferFromId(mediaId) {
  const url = await getMediaUrl(mediaId);
  return await downloadMedia(url);
}

module.exports = {
  getMediaUrl,
  downloadMedia,
  uploadImageToStorage,
  getMediaBufferFromId
};
