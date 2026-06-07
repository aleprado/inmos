import os
import json
import logging
from datetime import datetime, timezone
import functions_framework
import firebase_admin
from firebase_admin import credentials, firestore
import google.generativeai as genai

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializar Firebase Admin SDK (automático en GCP)
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

# Configurar API de Gemini
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

# DIRECTIVAS / INSTRUCCIONES DEL AGENTE DE IA
SYSTEM_PROMPT = """
Actúas como un asistente inmobiliario experto para operadores de la plataforma Inmos. Tu tarea es analizar el mensaje de texto enviado por el operador, extraer las características clave del inmueble y redactar una respuesta conversacional amigable.

Debes devolver obligatoriamente un único objeto JSON estructurado con el siguiente formato:
{
  "data": {
    "title": "Un título comercial descriptivo y atractivo (máximo 50 caracteres)",
    "description": "Una descripción detallada y profesional para el público final a partir de los datos dados",
    "price": 120000 (número entero o null si no se especifica),
    "currency": "USD" o "ARS" (o null si no se especifica),
    "rooms": 3 (número de ambientes/dormitorios, entero o null),
    "bathrooms": 2 (número de baños, entero o null),
    "area": 75 (metros cuadrados, entero o null),
    "propertyType": "Casa", "Departamento", "Oficina", "Local Comercial" o "Terreno" (estimar por contexto),
    "operationType": "Alquiler", "Venta" o "Alquiler Temporario" (estimar por contexto, por defecto Alquiler)
  },
  "chatResponse": "Tu respuesta directa para el operador de WhatsApp. Debe confirmar amigablemente los datos extraídos (ej: '¡Excelente! He cargado un Departamento de 3 ambientes en Venta por USD 120,000.'). IMPORTANTE: Si en el mensaje original NO se especificó la ubicación geográfica o dirección exacta de forma clara con coordenadas, debes terminar tu mensaje pidiendo explícitamente: 'Por favor, compárteme la ubicación de la propiedad usando la opción de \"Ubicación\" de WhatsApp para poder situarla correctamente en el mapa del Marketplace.'"
}

Devuelve estrictamente el JSON sin comentarios ni formateo Markdown de bloques de código (sin ```json ... ```), solo el texto JSON plano.
"""

@functions_framework.http
def process_message(request):
    """
    Procesa el mensaje entrante de WhatsApp encolado por Cloud Tasks.
    Maneja bifurcación de tipos (texto / ubicación), georreferenciación y extracción de IA.
    """
    if request.method != "POST":
        return "Method Not Allowed", 405

    try:
        task_data = request.get_json(silent=True)
        if not task_data:
            return "Bad Request: No JSON payload", 400

        # Parsear payload de Meta/WhatsApp
        entry = task_data.get("entry", [{}])[0]
        change = entry.get("changes", [{}])[0]
        value = change.get("value", {})
        message_obj = value.get("messages", [{}])[0]
        
        sender_phone = message_obj.get("from")
        message_id = message_obj.get("id")
        message_type = message_obj.get("type", "text") # 'text', 'location', 'image', etc.

        if not sender_phone:
            logger.error("Remitente no identificado.")
            return "Unprocessable Entity", 422

        # 1. Validación de Seguridad Multi-tenant
        operador_ref = db.collection("operadores").document(sender_phone)
        operador_doc = operador_ref.get()

        if not operador_doc.exists:
            logger.warning(f"Descarte seguro: Remitente {sender_phone} no es operador autorizado.")
            return "OK: Unauthorized sender ignored", 200

        operador_data = operador_doc.to_dict()
        tenant_id = operador_data.get("tenant_id")

        # 2. Cargar o crear sesión de operador
        session_ref = db.collection("sessions").document(sender_phone)
        session_doc = session_ref.get()
        
        thread_id = None
        current_property_id = None
        new_session_required = True

        if session_doc.exists:
            session_data = session_doc.to_dict()
            last_interaction = session_data.get("last_interaction")
            
            if last_interaction:
                diff = datetime.now(timezone.utc) - last_interaction
                diff_hours = diff.total_seconds() / 3600
                if diff_hours < 12 and session_data.get("status") == "open":
                    thread_id = session_data.get("thread_id")
                    current_property_id = session_data.get("current_property_id")
                    new_session_required = False

        if new_session_required:
            thread_id = f"thread_{sender_phone}_{int(datetime.now().timestamp())}"
            session_ref.set({
                "thread_id": thread_id,
                "tenant_id": tenant_id,
                "status": "open",
                "current_property_id": None,
                "last_interaction": firestore.SERVER_TIMESTAMP
            }, merge=True)
            current_property_id = None

        # --- BIFURCACIÓN DE TIPOS DE MENSAJE ---

        # CASO A: El operador comparte una UBICACIÓN (latitude, longitude)
        if message_type == "location":
            location_data = message_obj.get("location", {})
            lat = location_data.get("latitude")
            lng = location_data.get("longitude")
            address = location_data.get("address", location_data.get("name", "Ubicación Georreferenciada"))

            if not lat or not lng:
                logger.error("Mensaje marcado como ubicación pero no posee coordenadas lat/lng.")
                return "Bad Location Data", 400

            if not current_property_id:
                # No hay propiedad activa en esta sesión para asociarle la ubicación
                # Responder al operador indicando que primero debe enviar los detalles del inmueble
                response_msg = "¡Hola! He recibido la ubicación, pero no tengo ninguna propiedad activa en borrador ahora. Por favor, primero envíame el texto con los detalles de la propiedad (precio, ambientes, etc.) y luego compárteme la ubicación."
                logger.info(f"Ubicación recibida sin propiedad activa en sesión. Enviando alerta a {sender_phone}.")
                # (Simulado) enviar mensaje por WhatsApp
                return "OK: Location received with no active property", 200

            # Actualizar la propiedad activa en Firestore con las coordenadas
            property_ref = db.collection("properties").document(current_property_id)
            property_ref.update({
                "latitude": float(lat),
                "longitude": float(lng),
                "address": address,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })

            logger.info(f"Ubicación enlazada con éxito a propiedad {current_property_id}: Lat {lat}, Lng {lng}")
            
            # Confirmación conversacional al operador
            chat_response = f"¡Perfecto! He registrado la ubicación geográfica exacta para la propiedad (Ref: {current_property_id}). Ya está posicionada correctamente en el mapa de {tenant_id.upper()}."
            # (Simulado) enviar chat_response por WhatsApp
            return f"OK: Property {current_property_id} geolocated", 200

        # CASO B: Mensaje de TEXTO descriptivo de la propiedad
        elif message_type == "text" or "text" in message_obj:
            message_text = message_obj.get("text", {}).get("body", "")

            # Analizar el texto con Gemini
            ai_data = {
                "data": {
                    "title": "Nueva Propiedad",
                    "description": message_text,
                    "price": None,
                    "currency": "USD",
                    "rooms": None,
                    "bathrooms": None,
                    "area": None,
                    "propertyType": "Departamento",
                    "operationType": "Alquiler"
                },
                "chatResponse": "He cargado el borrador de la propiedad. Por favor, compárteme la ubicación de la propiedad usando la opción de \"Ubicación\" de WhatsApp para poder situarla correctamente en el mapa del Marketplace."
            }

            if GENAI_API_KEY:
                try:
                    # Configurar modelo con System Prompt e indicarle JSON mode de forma nativa
                    model = genai.GenerativeModel(
                        model_name="gemini-1.5-flash",
                        system_instruction=SYSTEM_PROMPT
                    )
                    
                    # Llamar al modelo forzando JSON output en generation_config
                    response = model.generate_content(
                        f"Mensaje a procesar:\n{message_text}",
                        generation_config={"response_mime_type": "application/json"}
                    )
                    
                    # Cargar JSON directamente sin necesidad de limpieza de markdown
                    parsed_response = json.loads(response.text.strip())
                    
                    if "data" in parsed_response and "chatResponse" in parsed_response:
                        ai_data = parsed_response
                        logger.info("Respuesta estructurada de Gemini (JSON Mode) obtenida y parseada con éxito.")
                except Exception as ia_error:
                    logger.error(f"Error en llamada nativa a Gemini: {str(ia_error)}. Fallback activo.")

            # Crear el borrador de la propiedad en Firestore
            prop_ref = db.collection("properties").document()
            new_property_id = prop_ref.id

            extracted_fields = ai_data["data"]

            prop_ref.set({
                "id": new_property_id,
                "tenant_id": tenant_id,
                "title": extracted_fields.get("title", "Propiedad Nueva"),
                "description": extracted_fields.get("description", message_text),
                "address": "Ubicación pendiente",
                "price": extracted_fields.get("price"),
                "currency": extracted_fields.get("currency", "USD"),
                "rooms": extracted_fields.get("rooms"),
                "bathrooms": extracted_fields.get("bathrooms"),
                "area": extracted_fields.get("area"),
                "propertyType": extracted_fields.get("propertyType", "Departamento"),
                "operationType": extracted_fields.get("operationType", "Alquiler"),
                "status": "pending",
                "qrCodeUrl": "",
                "latitude": None,
                "longitude": None,
                "featured": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "metadata": {
                    "sender": sender_phone,
                    "messageId": message_id,
                    "thread_id": thread_id
                }
            })

            # Actualizar la sesión del operador con la propiedad actualmente activa
            session_ref.update({
                "current_property_id": new_property_id,
                "last_interaction": firestore.SERVER_TIMESTAMP
            })

            logger.info(f"Borrador {new_property_id} creado para el operador {sender_phone} en sesión.")
            
            # (Simulado) enviar la respuesta conversacional de la IA por WhatsApp
            chat_to_send = ai_data["chatResponse"]
            preview_url = f"https://{tenant_id}.inmos.app/review/{new_property_id}"
            full_response = f"{chat_to_send}\n\nPrevisualizar publicación: {preview_url}"
            logger.info(f"Enviando WhatsApp a {sender_phone}:\n{full_response}")

            return f"OK: Property created {new_property_id}", 200

        # Manejo de otros tipos (imágenes, audios, etc.) - Omitido por simplicidad
        else:
            logger.info(f"Tipo de mensaje '{message_type}' recibido y omitido.")
            return "OK: Message type skipped", 200

    except Exception as e:
        logger.error(f"Error crítico en el Motor de IA: {str(e)}")
        return "Internal Server Error", 500
