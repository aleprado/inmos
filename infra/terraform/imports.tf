import {
  to = google_firestore_database.database
  id = "projects/${var.project_id}/databases/(default)"
}

import {
  to = google_cloud_tasks_queue.whatsapp_queue
  id = "projects/${var.project_id}/locations/${var.region}/queues/${var.whatsapp_queue_name}"
}

import {
  to = google_storage_bucket.media_bucket
  id = "${var.project_id}-inmos-media"
}

import {
  to = google_service_account.whatsapp_receiver_sa
  id = "projects/${var.project_id}/serviceAccounts/whatsapp-receiver-sa@${var.project_id}.iam.gserviceaccount.com"
}

import {
  to = google_service_account.motor_ia_sa
  id = "projects/${var.project_id}/serviceAccounts/motor-ia-sa@${var.project_id}.iam.gserviceaccount.com"
}

import {
  to = google_service_account.operator_manager_sa
  id = "projects/${var.project_id}/serviceAccounts/operator-manager-sa@${var.project_id}.iam.gserviceaccount.com"
}

import {
  to = google_firebase_project.firebase
  id = "projects/${var.project_id}"
}

import {
  to = google_firebase_web_app.frontend_app
  id = "projects/${var.project_id}/webApps/1:200855748437:web:791659deffb48d740239dc"
}
