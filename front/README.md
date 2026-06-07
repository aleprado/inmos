# Inmos - Frontend Público y de Administración

Este repositorio contiene la aplicación de frontend para **Inmos** (un SaaS inmobiliario de marca blanca) desarrollada con **React**, **Vite** y **Tailwind CSS**.

## Características Clave

1. **Catálogo Público de Propiedades (`PropertyDetailView`):**
   - Interfaz altamente optimizada para teléfonos móviles (se accede mediante escaneo de códigos QR).
   - Incluye carrusel premium táctil y llamada a la acción flotante para consultas rápidas por WhatsApp.
   - Seguridad con Firebase App Check (reCAPTCHA Enterprise) para mitigar el raspado masivo de datos (scraping).

2. **Panel de Aprobación en Tiempo Real (`PropertyReviewDashboard`):**
   - Conectado en tiempo real a Firebase Firestore para listar propiedades con estado `"pending"`.
   - Permite a los operadores o administradores previsualizar de forma exacta cómo verá el cliente la publicación, modificar campos mediante modales y aprobar la propiedad en un clic.

3. **Subdominios Wildcard Dinámicos:**
   - Soporte para subdominios personalizados en Firebase Hosting (`*.inmos.app`).
   - El enrutador de entrada extrae el `tenant_id` a partir de `window.location.hostname` para filtrar de forma segura y automática el inventario específico de cada inmobiliaria.

## Instalación y Desarrollo Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=tu-api-key
   VITE_FIREBASE_AUTH_DOMAIN=tu-auth-domain
   VITE_FIREBASE_PROJECT_ID=tu-project-id
   VITE_FIREBASE_STORAGE_BUCKET=tu-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
   VITE_FIREBASE_APP_ID=tu-app-id
   VITE_APPCHECK_DEBUG_TOKEN=token-de-depuracion-local
   ```

3. Iniciar el servidor de desarrollo local:
   ```bash
   npm run dev
   ```

---
© 2026 Inmos App. Todos los derechos reservados.
