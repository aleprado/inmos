# Inmos - Handoff & Context Document 🚀

Este documento está diseñado específicamente para proveer **todo el contexto necesario** a una nueva instancia de Antigravity (o cualquier agente de IA) que deba continuar con el desarrollo y mantenimiento del proyecto Inmos.

## 📌 Visión del Producto
Inmos es una plataforma B2B (SaaS) diseñada para revolucionar cómo las inmobiliarias gestionan y publican sus propiedades. Su propuesta de valor principal es eliminar la fricción de entrada de datos: **los operadores (agentes inmobiliarios) suben propiedades enviando audios, fotos y videos por WhatsApp**. Un bot de IA (configurado en Meta) procesa esa información y publica automáticamente la propiedad en un frontend web estético y moderno.

### Arquitectura General (Serverless Monorepo)
El proyecto es un monorepo que contiene tanto el código frontend como la infraestructura backend (IaC).
- **Backend/Infraestructura (`/infra`):** Basado 100% en Firebase/Google Cloud Platform. Provisionado vía Terraform.
  - Base de Datos: Firestore.
  - Funciones Serverless: Cloud Functions (Node.js).
  - Almacenamiento: Cloud Storage (para imágenes y videos).
  - Colas de Tareas: Cloud Tasks (como alternativa a SQS/SNS para escalabilidad ante ráfagas de mensajes de WhatsApp).
- **Frontend (`/front`):** Aplicación web Single Page Application (SPA).
  - Framework: React (Vite).
  - Estilos: Tailwind CSS.
  - Componentes UI: Lucide React (iconos).
  - Hosting: Firebase Hosting.
- **CI/CD (`/.github/workflows`):** GitHub Actions configuradas con Path Filters para despliegues independientes de Front, Functions e Infraestructura.

## 📂 Estructura del Repositorio
```
/inmos
├── .github/workflows/       # Pipelines de CI/CD (deploy-frontend, deploy-functions, deploy-infra)
├── front/                   # Código fuente de React (Vite)
│   ├── src/
│   │   ├── components/      # PropertyReviewDashboard, PropertyDetailView, PropertyFlyer, SignageFlyer, etc.
│   │   ├── contexts/        # ToastContext (Notificaciones custom)
│   │   ├── hooks/           # useTenant (Lógica multi-tenant por URL)
│   │   ├── utils/           # seo.js (Meta tags dinámicos)
│   │   └── main.jsx         # Entry point, enrutador y Auth Listener
│   ├── package.json         # Dependencias (incluye html2canvas, jspdf, qrcode.react)
│   └── index.html
├── infra/                   # Infraestructura como Código (Terraform) y Backend (Functions)
│   ├── functions/           # Firebase Cloud Functions (Node.js)
│   │   ├── src/
│   │   │   ├── index.js     # Entry point de las funciones
│   │   │   ├── callables/   # Funciones invocadas desde el cliente (ej: exportProperties.js)
│   │   │   ├── http/        # Webhooks de Meta (WhatsApp)
│   │   │   └── tasks/       # Handlers de Cloud Tasks (procesamiento de IA en background)
│   │   └── package.json
│   ├── main.tf              # Configuración principal de Terraform para GCP/Firebase
│   ├── variables.tf         # Variables de entorno requeridas
│   └── outputs.tf           # Exporta la configuración de Firebase (firebaseConfig)
└── rules.md                 # Reglas de modularidad estrictas que el agente debe seguir
```

## ✨ Funcionalidades Core Implementadas
1. **Multi-Tenancy por URL:** El sistema lee el subdominio o un parámetro para determinar a qué inmobiliaria (tenant) pertenece la vista (`useTenant.js`).
2. **Dashboard Administrativo (`PropertyReviewDashboard.jsx`):**
   - Sistema de pestañas: Pendientes (para revisar antes de publicar), Aprobadas y Archivadas.
   - Edición completa de datos mediante `PropertyEditModal.jsx`.
   - Gestión de Operadores (para dar acceso a números de WhatsApp específicos).
3. **Vista Pública Premium (`PropertyDetailView.jsx`):**
   - Carrusel de imágenes inmersivo.
   - Reproductor embebido de Recorridos 360° (YouTube/Matterport).
   - Botón directo de WhatsApp para contactar al agente.
4. **Herramientas B2B (Adopción y Upselling):**
   - **Contador de Vistas:** Se registran `views` en Firestore (protegido por `sessionStorage` contra spam) y se muestran en el dashboard (ícono 👁️) para demostrar ROI a la inmobiliaria.
   - **Exportación Universal:** Botón "Exportar Catálogo" que invoca una Cloud Function para descargar todo en JSON (Data Freedom).
   - **Folleto PDF (1-Clic):** Genera un A4 comercial con fotos, atributos y un Código QR dinámico usando `html2canvas` y `jsPDF` (`PropertyFlyer.jsx`). Todo en el cliente.
   - **Cartel Vía Pública (QR):** Genera un cartel minimalista con un código QR masivo de 550px para pegar sobre cartelería física existente (`SignageFlyer.jsx`).
   - **UX Moderna (Toasts):** Notificaciones flotantes no bloqueantes creadas con Tailwind y React Context, eliminando por completo los `alert()`.

## ⚙️ Flujo de Procesamiento (WhatsApp a Web)
1. **Ingreso:** Un mensaje llega al Webhook de Meta (`infra/functions/src/http/metaWebhook.js`).
2. **Encolado:** Para soportar ráfagas sin timeout, el Webhook despacha rápidamente el payload a Google Cloud Tasks y retorna 200 OK a Meta.
3. **Procesamiento de IA:** Un handler de la Task asíncrona (ej: `infra/functions/src/tasks/processPropertyAudio.js`) recibe la información, interactúa con LLMs (ej: Gemini) para extraer datos estructurados, sube imágenes a Storage y guarda la entidad en Firestore con estado `pending`.
4. **Revisión:** El administrador entra al Dashboard en React, ve la propiedad pendiente, la edita si es necesario y la aprueba, haciéndola visible en la web pública.

## 🛠️ Estado Actual y Próximos Pasos (Next Steps)
Todo el código está desarrollado e integrado localmente. El proyecto está listo para el despliegue final en la nube.
- [ ] **Despliegue de Infraestructura:** Ejecutar `terraform init` y `terraform apply` en la carpeta `/infra` luego de proveer el `GOOGLE_APPLICATION_CREDENTIALS`.
- [ ] **Configuración Frontend:** Copiar el `firebaseConfig` resultante de Terraform y pegarlo en `front/src/firebase.js`.
- [ ] **Secretos CI/CD:** Configurar los secretos en GitHub (`GCP_CREDENTIALS`, etc.) para que GitHub Actions pueda desplegar automáticamente tras el push.
- [ ] **Verificación de Meta Webhook:** Enlazar la URL pública de la Cloud Function del Webhook al dashboard de desarrolladores de Meta (WhatsApp Business API).

## ⚠️ Reglas a Respetar por el Agente (Ver `rules.md`)
- Modificar el código de manera quirúrgica y atómica.
- Evitar regenerar archivos completos.
- Mantener la separación de responsabilidades (ej. UI en componentes, estado en hooks, llamadas API en `functions/`).

---
*Este documento fue autogenerado para asegurar una transición fluida hacia un nuevo entorno de desarrollo.*
