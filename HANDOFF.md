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

## 🛠️ Estado Actual y Últimos Desarrollos (Contexto Crítico)
El proyecto se encuentra en un estado funcional avanzado con integraciones complejas de UI y Backend. **Si eres un nuevo agente analizando este repositorio, lee atentamente los siguientes puntos recientes:**

1. **AI Chat Assistant Web (`AIChatAssistant.jsx`):**
   - Se migró la funcionalidad del bot de WhatsApp al navegador. Los operadores autenticados pueden cargar propiedades chateando o subiendo imágenes directamente desde la web (`processOperatorMessage.js`).
   - El entorno "Demo" (`inmos.app` público) también utiliza este componente, pero envía la data al endpoint `processDemoMessage.js`.

2. **Personalización Multi-Tenant (White-label):**
   - El `PropertyReviewDashboard` y `PropertyMarketplace` ahora leen configuraciones visuales del tenant (color principal, color de fondo, logo, diseño del catálogo 'grid/map/mixed') y las inyectan en el DOM (CSS vars).

3. **Seguridad y Control de Costos (MUY IMPORTANTE):**
   - **Rate Limiting por IP:** Para evitar que usuarios maliciosos agoten la cuota de Vertex AI / Gemini en el entorno Demo público, se implementó un Rate Limiter por IP en la Cloud Function `processDemoMessage`. El límite es de 20 interacciones por día por IP, respaldado en Firestore (`demo_rate_limits`).
   - **Limpieza de Demo Segura (`keepalive`):** En lugar de un cronjob costoso, la limpieza de propiedades de la demo se dispara cuando el usuario cierra la pestaña (`beforeunload`). Para sortear la cancelación agresiva del navegador, se usa un `fetch` nativo con `keepalive: true` apuntando a la Callable `endDemoSession`.
   - **Timeouts de Inactividad (`useInactivityTimer.js`):** El Frontend vigila inactividad pura (mouse/teclado). Si pasan 30 minutos, se finaliza la sesión de la Demo (limpiando backend) o se desloguea forzosamente al Operador.
   - **Persistencia de Sesión de Operadores:** Firebase Auth está configurado explícitamente y globalmente con `browserSessionPersistence` en `firebase.js`. La sesión muere al cerrar el navegador.

4. **Quirk de Firebase Storage con Terraform:**
   - Terraform aprovisiona el bucket `inmos-2c701-inmos-media` nativamente en GCP. Debido a que la SDK Web de Firebase (`firebasestorage.googleapis.com`) no reconoce buckets genéricos por defecto (lanzando un error disfrazado de CORS), este bucket **debe estar enlazado manualmente a Firebase** mediante el menú "Importar Bucket" en la consola web de Firebase Storage.
   - El frontend `.env` debe apuntar a `VITE_FIREBASE_STORAGE_BUCKET=inmos-2c701-inmos-media`.
   - Las reglas de Storage están exportadas en `infra/storage.rules`.

## 🚀 Próximos Pasos (Next Steps)
- [ ] **Configuración Frontend en Hosting:** Asegurarse de que las variables de entorno inyectadas por el CI/CD (GitHub Secrets) coincidan con el `.env` local.
- [ ] **Verificación de Meta Webhook:** Enlazar la URL pública de la Cloud Function del Webhook al dashboard de desarrolladores de Meta (WhatsApp Business API).

## ⚠️ Reglas a Respetar por el Agente (Ver `rules.md`)
- Modificar el código de manera quirúrgica y atómica.
- Evitar regenerar archivos completos.
- Mantener la separación de responsabilidades (ej. UI en componentes, estado en hooks, llamadas API en `functions/`).

---
*Este documento fue autogenerado para asegurar una transición fluida hacia un nuevo entorno de desarrollo.*
