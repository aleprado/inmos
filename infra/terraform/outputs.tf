output "project_id" {
  value       = var.project_id
  description = "ID del proyecto de Google Cloud"
}

output "whatsapp_queue_id" {
  value       = google_cloud_tasks_queue.whatsapp_queue.id
  description = "ID de la cola de Google Cloud Tasks"
}

output "receiver_sa_email" {
  value       = google_service_account.whatsapp_receiver_sa.email
  description = "Email de la Service Account para el receptor del Webhook"
}

output "motor_ia_sa_email" {
  value       = google_service_account.motor_ia_sa.email
  description = "Email de la Service Account para el procesador Motor IA"
}

output "media_bucket_name" {
  value       = google_storage_bucket.media_bucket.name
  description = "Nombre del bucket de Storage para multimedia"
}

output "firebase_hosting_url" {
  value       = "https://${var.project_id}.web.app"
  description = "URL predeterminada del sitio de Firebase Hosting"
}

# Obtener la configuración del SDK Web generada por Firebase
data "google_firebase_web_app_config" "frontend" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.frontend_app.app_id
}

output "firebase_config_js" {
  value = <<EOT
Copia y pega este bloque en front/src/firebase.js:

const firebaseConfig = {
  apiKey: "${data.google_firebase_web_app_config.frontend.api_key}",
  authDomain: "${data.google_firebase_web_app_config.frontend.auth_domain}",
  projectId: "${var.project_id}",
  storageBucket: "${data.google_firebase_web_app_config.frontend.storage_bucket}",
  messagingSenderId: "${data.google_firebase_web_app_config.frontend.messaging_sender_id}",
  appId: "${google_firebase_web_app.frontend_app.app_id}"
};
EOT
  description = "Objeto de configuración de Firebase para el Frontend"
}
