# Habilitar servicios / APIs en GCP
resource "google_project_service" "services" {
  for_each = toset([
    "firestore.googleapis.com",
    "cloudtasks.googleapis.com",
    "run.googleapis.com",
    "cloudfunctions.googleapis.com",
    "aiplatform.googleapis.com", # Vertex AI
    "iam.googleapis.com",
    "storage.googleapis.com",
    "firebase.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# Base de datos Firestore (modo nativo)
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Depende de que se habilite la API de Firestore primero
  depends_on = [google_project_service.services]
}

# Cola de Google Cloud Tasks para desacoplamiento del webhook de WhatsApp
resource "google_cloud_tasks_queue" "whatsapp_queue" {
  name     = var.whatsapp_queue_name
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts  = 5
    min_backoff   = "2s"
    max_backoff   = "300s"
    max_doublings = 16
  }

  depends_on = [google_project_service.services]
}

# Bucket de Storage para almacenar las imágenes de las propiedades y los códigos QR
resource "google_storage_bucket" "media_bucket" {
  name          = "${var.project_id}-inmos-media"
  location      = var.region
  force_destroy = false

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.services]
}

# --- SEGURIDAD E IAM ---

# 1. Service Account para el Webhook de WhatsApp (api-whatsapp-receiver)
resource "google_service_account" "whatsapp_receiver_sa" {
  account_id   = "whatsapp-receiver-sa"
  display_name = "Service Account for WhatsApp Webhook Receiver"
}

# Permiso para que el receptor publique en Cloud Tasks
resource "google_project_iam_member" "receiver_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.whatsapp_receiver_sa.email}"
}

# 2. Service Account para el Procesador Inteligente (motor-ia-processor)
resource "google_service_account" "motor_ia_sa" {
  account_id   = "motor-ia-sa"
  display_name = "Service Account for AI Processor"
}

# Permisos para el Motor de IA: Firestore, Storage y Vertex AI
resource "google_project_iam_member" "motor_ia_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.motor_ia_sa.email}"
}

resource "google_project_iam_member" "motor_ia_storage" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.motor_ia_sa.email}"
}

resource "google_project_iam_member" "motor_ia_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.motor_ia_sa.email}"
}

# 3. Service Account para el Gestor de Operadores (operator-manager)
resource "google_service_account" "operator_manager_sa" {
  account_id   = "operator-manager-sa"
  display_name = "Service Account for Operator Manager"
}

# Permisos para el Gestor de Operadores: Firestore (Datastore) y Firebase Auth Admin
resource "google_project_iam_member" "operator_manager_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.operator_manager_sa.email}"
}

resource "google_project_iam_member" "operator_manager_auth" {
  project = var.project_id
  role    = "roles/firebaseauth.admin"
  member  = "serviceAccount:${google_service_account.operator_manager_sa.email}"
}

# --- FIREBASE FRONTEND ---

# Enlazar el proyecto GCP con Firebase
resource "google_firebase_project" "firebase" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.services]
}

# Registrar la aplicación Web Frontend en Firebase
resource "google_firebase_web_app" "frontend_app" {
  provider     = google-beta
  project      = var.project_id
  display_name = "Inmos Web App"

  depends_on = [google_firebase_project.firebase]
}

# Sitio de Firebase Hosting
resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = "${var.project_id}-site"
  app_id   = google_firebase_web_app.frontend_app.app_id
}

