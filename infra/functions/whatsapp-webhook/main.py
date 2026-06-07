import os
import json
import logging
import functions_framework
from google.cloud import tasks_v2

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración leída de las variables de entorno
PROJECT_ID = os.environ.get("PROJECT_ID", "demo-project")
REGION = os.environ.get("GCP_REGION", "us-central1")
QUEUE_NAME = os.environ.get("CLOUD_TASKS_QUEUE_NAME", "whatsapp-messages-queue")
# La URL del procesador Motor IA privado al que Cloud Tasks enviará la tarea
MOTOR_IA_URL = os.environ.get("MOTOR_IA_URL", "")

# El token de verificación definido en la consola de Meta Developers
VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "super-secret-token")

@functions_framework.http
def whatsapp_webhook(request):
    """
    Endpoint principal para recibir los eventos de Meta/WhatsApp.
    Debe responder extremadamente rápido (<500ms) para evitar timeouts.
    """
    # 1. Manejo del Handshake de Verificación (GET)
    if request.method == "GET":
        mode = request.args.get("hub.mode")
        token = request.args.get("hub.verify_token")
        challenge = request.args.get("hub.challenge")

        if mode and token:
            if mode == "subscribe" and token == VERIFY_TOKEN:
                logger.info("Webhook verificado exitosamente por Meta.")
                return challenge, 200
            else:
                logger.warning("Intento de verificación fallido: Token inválido.")
                return "Forbidden", 403
        return "Bad Request", 400

    # 2. Manejo de Notificaciones de Mensajes (POST)
    elif request.method == "POST":
        try:
            payload = request.get_json(silent=True)
            if not payload:
                return "Bad Request: No JSON payload", 400

            logger.info("Recibido evento de WhatsApp. Procesando para encolar...")

            # Estructurar la tarea para Google Cloud Tasks
            client = tasks_v2.CloudTasksClient()
            queue_path = client.queue_path(PROJECT_ID, REGION, QUEUE_NAME)

            # Preparar la tarea. Almacenamos el payload completo que Meta nos envía
            task_payload = json.dumps(payload).encode("utf-8")
            
            task = {
                "http_request": {
                    "http_method": tasks_v2.HttpMethod.POST,
                    "url": MOTOR_IA_URL,
                    "headers": {
                        "Content-Type": "application/json",
                    },
                    "body": task_payload,
                }
            }

            # Encolar la tarea asíncrona de manera inmediata
            response = client.create_task(parent=queue_path, task=task)
            logger.info(f"Tarea encolada con éxito: {response.name}")

            # Responder 200 OK inmediatamente a Meta
            return "OK", 200

        except Exception as e:
            logger.error(f"Error procesando el webhook de WhatsApp: {str(e)}")
            # Devolvemos 200 OK de todos modos para que Meta no reintente continuamente
            # y sature nuestro webhook con timeouts, pero registramos el error.
            return "Internal error processed", 200

    return "Method Not Allowed", 405
