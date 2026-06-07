variable "project_id" {
  type        = string
  description = "El ID del proyecto de Google Cloud (GCP)"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Región de despliegue para los recursos de GCP"
}

variable "whatsapp_queue_name" {
  type        = string
  default     = "whatsapp-messages-queue"
  description = "Nombre de la cola de Google Cloud Tasks"
}
