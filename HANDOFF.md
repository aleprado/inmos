# Inmos - Handoff & Context Document 🚀

Este documento provee **todo el contexto necesario** a una nueva instancia de Antigravity (o cualquier agente de IA / desarrollador humano) que deba continuar con el desarrollo y mantenimiento del proyecto Inmos.

## 📌 Visión del Producto
Inmos es una plataforma B2B (SaaS) multi-tenant diseñada para revolucionar cómo las inmobiliarias gestionan y publican sus propiedades. Su propuesta de valor principal es eliminar la fricción de entrada de datos: **los operadores (agentes inmobiliarios) suben propiedades enviando audios, fotos y texto por WhatsApp o mediante un Web Chat con IA**. Un agente autónomo impulsado por Gemini procesa esa información y publica automáticamente la propiedad en un catálogo web estético y moderno.

### Arquitectura General (Serverless Monorepo)
- **Backend/Infraestructura (`/infra`):** Basado 100% en Firebase/Google Cloud Platform. Provisionado vía Terraform.
  - Base de Datos: Firestore (NoSQL).
  - Funciones Serverless: Cloud Functions v2 (Node.js 20).
  - Almacenamiento: Cloud Storage (para imágenes).
  - Colas de Tareas: Cloud Tasks (para procesar mensajes de WhatsApp de forma asíncrona sin timeouts).
- **Frontend (`/front`):** Single Page Application (SPA).
  - Framework: React 18 (Vite).
  - Enrutamiento: Manual basado en estado (sin React Router).
  - Estilos: Tailwind CSS 3.4.
  - Hosting: Firebase Hosting.
- **CI/CD (`/.github/workflows`):** GitHub Actions con Path Filters para despliegues independientes de Front, Functions e Infraestructura (Terraform).

---

## 📂 Backend (Cloud Functions)
El backend procesa la lógica de IA, la integración con WhatsApp y provee APIs para el frontend.

### Entry Points (`infra/functions/src/`)
| Función | Tipo | Descripción |
|---|---|---|
| `whatsappWebhook` | HTTP (`onRequest`) | Recibe mensajes de Meta (WhatsApp Graph API). Valida al operador, da feedback rápido ("Procesando...") y encola la tarea pesada en Cloud Tasks. Siempre devuelve HTTP 200 rápido para evitar penalizaciones de Meta. |
| `processMessage` | Task (`onTaskDispatched`) | Consume la cola de Cloud Tasks. Transcribe audios (si los hay), maneja comandos ("continuar", "finalizar"), descarga imágenes, llama al Agente IA, y guarda en Firestore. |
| `exportTenantData` | Callable (`onCall`) | Exporta todo el catálogo de una inmobiliaria en formato JSON. |
| `processDemoMessage` | Callable (`onCall`) | Simula el bot de WhatsApp en la web para el tenant `demo`. Incluye **Rate Limiting** por IP (max 20 msg/día) guardado en Firestore. |
| `processOperatorMessage`| Callable (`onCall`) | Permite a operadores autenticados usar la IA desde el dashboard web, reutilizando el motor core. |
| `endDemoSession` | Callable (`onCall`) | Limpia datos (borra propiedades e imágenes de Storage) generados en la sesión de demo cuando el usuario cierra la pestaña. |

### Servicios Clave (`infra/functions/src/services/`)
- **`aiAgent.js`**: El cerebro de IA. Usa **Gemini 2.5 Flash** para:
  1. `parsePropertyMessage`: Extraer JSON inicial (precio, ambientes, ubicación, etc.) a partir de texto o transcripciones.
  2. `mergePropertyDetails`: Fusionar mensajes nuevos en un borrador existente (ej. el usuario dice "Ah, y tiene balcón", la IA actualiza el JSON).
- **`sessionService.js`**: Mantiene el contexto conversacional en la colección `sessions` (expira en 30 min). Permite que la IA sepa de qué propiedad está hablando el usuario en mensajes consecutivos. Implementa un debounce de 15s para confirmaciones de fotos.
- **`whatsappMedia.js` / `whatsappSender.js`**: Integración con Graph API v17.0 para descargar adjuntos y enviar mensajes interactivos (botones).

### Variables de Entorno (Backend)
- `GEMINI_API_KEY`, `GEMINI_PROCESSING_MODEL`, `GEMINI_TRANSCRIPTION_MODEL`
- `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN` (Webhooks Meta)
- `APP_DOMAIN` (ej. `inmos.app` para deep links)

---

## 💻 Frontend (React + Vite)
SPA construida para ser rápida, visualmente premium y completamente "white-label" (personalizable por cada inmobiliaria).

### Sistema de Multi-Tenancy y Theming
El hook `useTenant.js` lee el subdominio de la URL (ej. `lopez.inmos.app`) y busca en la colección `tenants` de Firestore. El archivo `theme.js` inyecta dinámicamente variables CSS (`--brand-50` a `--brand-900`) basadas en el `primaryColor` del tenant, personalizando toda la UI.

### Componentes Core (`front/src/components/`)
1. **`main.jsx`**: Punto de entrada. Resuelve el tenant, aplica el tema, escucha el estado de autenticación (Firebase Auth) y renderiza la vista correspondiente (Landing, Catalog, Admin, Detail).
2. **`PropertyMarketplace.jsx` (Catálogo Público)**:
   - Modos de vista: Grid, Mapa, o Mixto. Configurable por el tenant.
   - Mapa interactivo con **Leaflet** y CartoDB Positron.
   - Filtros en tiempo real (operación, tipo, precio, ambientes).
   - Incluye el componente `AIChatAssistant.jsx` flotante si es el entorno de Demo.
3. **`PropertyDetailView.jsx` (Ficha de Propiedad)**:
   - Carrusel de fotos, mapa, visualizador de Tour 360° (YouTube/Matterport).
   - Contador de Vistas (`views`) persistido en Firestore por sesión.
   - Botón flotante para contactar al operador por WhatsApp.
   - Metadatos dinámicos para SEO (`seo.js`).
4. **`PropertyReviewDashboard.jsx` (Panel Administrativo)**:
   - Gestión de propiedades en pestañas: Pendientes (borradores de la IA), Aprobadas, Archivadas.
   - Configuración White-label (colores, logo, layout).
   - Gestión de Operadores (CRUD en la colección `operadores`).
   - Generación de documentos: Folletos PDF A4 y Flyers 1080x1080 para Redes Sociales usando `html2canvas` + `jsPDF`.
   - Generación de Cartelería Física (`SignageFlyer.jsx`): PDF A4 con QR gigante generado con `qrcode.react`.
5. **`PropertyEditModal.jsx`**:
   - Formulario completo de edición.
   - Mapa interactivo donde el operador puede mover el pin (usa Nominatim de OpenStreetMap para geocoding inverso).
   - Dropzone para arrastrar, reordenar (HTML5 Drag & Drop) y subir imágenes directamente a Firebase Storage.

### UX y Retención
- **`useInactivityTimer.js`**: Hook que detecta inactividad (mouse/teclado). Si pasan 30 minutos sin actividad:
  - En la Demo pública: Limpia backend y recarga (protege costos).
  - En el Dashboard Admin: Cierra la sesión por seguridad.
- **`ToastContext.jsx`**: Sistema global de notificaciones no bloqueantes (reemplaza `alert()`).
- **Limpieza Segura (`keepalive`)**: El componente `main.jsx` detecta cuando el usuario cierra la pestaña (`beforeunload`) y lanza un fetch nativo con `keepalive: true` hacia `endDemoSession` para asegurar que la Demo no acumule basura.

---

## 🛠️ Quirks y Detalles Operativos Críticos

1. **Bug del Sandbox de Meta WhatsApp**: En modo pruebas, los números de teléfono argentinos (`549...`) sufren de un bug donde Meta a veces requiere el `9` y a veces no. El servicio `whatsappSender` incluye una limpieza específica para esto.
2. **Firebase Storage CORS con Terraform**: Terraform aprovisiona el bucket `inmos-2c701-inmos-media` nativamente en GCP. La SDK Web de Firebase da un error disfrazado de CORS si este bucket no se enlaza manualmente en la consola web de Firebase. El `.env` del frontend debe usar `VITE_FIREBASE_STORAGE_BUCKET=inmos-2c701-inmos-media`.
3. **Flujo de WhatsApp a Firestore**: 
   - La IA **NO** analiza las imágenes visualmente para ahorrar costos y bajar latencia; solo extrae datos del texto/audio. Las fotos enviadas por WhatsApp se suben directo a Storage y se pegan al array `images` del documento en Firestore.
4. **Rate Limits de la Demo**: La función pública `processDemoMessage` está expuesta a la web. Para evitar abuso de la API de Gemini, tiene un límite estricto de 20 mensajes por IP por día guardado en Firestore (`demo_rate_limits`).

---

## ⚠️ Reglas a Respetar por el Agente (`rules.md`)
1. **Quirúrgico:** Modificar código con `replace_file_content` o `multi_replace_file_content` usando bloques exactos. No regenerar archivos enteros a menos que sea estrictamente necesario.
2. **Separación:** Mantener la lógica de negocio pesada o dependiente de APIs secretas en Cloud Functions. Mantener el Frontend puramente para UI e interacciones de base de datos directas (con Reglas de Seguridad).
3. **Multi-Tenancy:** Todo query en Frontend debe incluir `where('tenant_id', '==', tenantId)`. No asumir jamás un tenant único.
4. **Dependencias Frontend:** Minimizar NPM; preferir CDNs (como Leaflet) para no inflar el bundle de Vite. Evitar React Router; usar el sistema de rutas manual ya implementado.

*Este documento fue generado automáticamente por Antigravity analizando el código fuente en su totalidad.*
