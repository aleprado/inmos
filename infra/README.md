# Inmos - Infraestructura y Cloud Functions (IaC)

Este repositorio contiene la configuración de Infraestructura como Código (IaC) usando Terraform para Google Cloud Platform (GCP) y Firebase, así como las Firebase Cloud Functions del backend de **Inmos**.

## Estructura del Repositorio

- `terraform/`: Contiene los scripts de Terraform para aprovisionar los recursos de GCP (Firestore, Cloud Tasks, Service Accounts, etc.).
- `functions/`: Contiene el código fuente de las Cloud Functions y el procesamiento asíncrono.
  - `auth-trigger/` (Node.js): Trigger de Firebase Auth para inyectar `tenant_id` en los claims del usuario.
  - `qr-generator/` (Node.js): Genera y guarda códigos QR en Storage para las propiedades aprobadas.
  - `whatsapp-webhook/` (Python): Webhook receptor de alta velocidad para Meta/WhatsApp.
  - `motor-ia/` (Python): Motor que consume Cloud Tasks y extrae entidades inmobiliarias de los mensajes usando el Antigravity SDK.

## Prerrequisitos para Despliegue

1. **Google Cloud SDK** instalado y autenticado.
2. **Terraform CLI** instalado.
3. **Firebase CLI** (`npm install -g firebase-tools`) para desplegar funciones y reglas.

---
© 2026 Inmos App. Todos los derechos reservados.
