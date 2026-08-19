# **Plan de Implementación Técnica: Timbre QR & Portero Virtual Inteligente con IA**

# **1\. Resumen Ejecutivo y Propuesta de Valor**

**Propósito**  
Plataforma integral de portero virtual y control de accesos basada en códigos QR pasivos para el exterior, videollamadas WebRTC ligeras y un recepcionista virtual autónomo potenciado por la API de Gemini y Antigravity SDK.

**Diferencial frente a porteros tradicionales y gigantes del mercado**

* **Cero cableado y costo de roturas:** Frente pasivo (placa QR de acrílico/aluminio) inmune al robo de hardware costoso en la vía pública.  
* **Sustitución económica directa:** Ahorro frente a los presupuestos millonarios de recableado en edificios pequeños, PHs y casas particulares.  
* **Asimetría de interfaz:** El visitante no requiere instalar aplicaciones ni crear cuentas; el residente cuenta con una app móvil nativa/híbrida con llamada en primer plano (CallKit / ConnectionService).

# **2\. Arquitectura del Sistema e Infraestructura Serverless (Capa Gratuita)**

El sistema se basa en un modelo de costo cero ($0 USD) para la etapa inicial, aprovechando servicios en la nube con capas gratuitas generosas:

| Componente | Tecnología Seleccionada | Beneficio de Capa Gratuita |
| :---- | :---- | :---- |
| API Gateway & Microservicios | AWS Lambda (Go) / Google Cloud Functions | 1M de peticiones gratuitas/mes |
| Señalización WebRTC | AWS API Gateway WebSockets / Firebase Realtime | Mensajería de baja latencia |
| Base de Datos | DynamoDB / Firestore | 25 GB de almacenamiento y alto throughput |
| Notificaciones Push | Firebase Cloud Messaging (FCM) | Alta prioridad para CallKit/VoIP |
| Hosting Frontend Visitante | Cloudflare Pages / AWS S3 \+ CloudFront | Distribución global eficiente |
| Servidor STUN | Google Public STUN | `stun.l.google.com:19302` sin costo |

# **3\. Desglose Modular de Funciones (Microservicios Serverless)**

## **3.1 RingDispatcherFunction (`POST /api/v1/door/{id}/ring`)**

* Valida el token/ID de la puerta.  
* Consulta dispositivos registrados y emite el payload push de alta prioridad vía FCM.  
* Genera un `session_id` efímero con TTL de 5 a 10 minutos.  
* Retorno inmediato (\<50 ms) para no bloquear la interfaz del visitante.

## **3.2 SignalingFunction (WebSockets WebRTC)**

* Maneja la negociación de conexión (ofertas/respuestas SDP y candidatos ICE) entre el navegador del visitante y la app del residente.  
* Cierra el canal una vez establecida la conexión Peer-to-Peer (P2P).

## **3.3 GeminiConciergeFunction (IA Multimodal & Antigravity Agent)**

* Se activa cuando el residente no atiende o tiene el 'Modo Ausente' activo.  
* **Visión Multimodal:** Analiza capturas de la cámara del visitante para identificar repartidores (Mercado Libre, Andreani, etc.) y enriquecer la notificación.  
* **Recepcionista Autónomo:** Mantiene diálogo por texto/voz con el visitante para tomar recados o dar instrucciones de entrega.  
* **Smart Quick-Replies:** Genera 3 botones de respuesta rápida contextual para el residente.

## **3.4 QuickActionFunction (`POST /api/v1/sessions/{id}/reply`)**

* Transmite respuestas instantáneas seleccionadas por el residente hacia la pantalla web del visitante (ej. 'Ya bajo', 'Dejalo en el buzón').

## **3.5 AdminConfigFunction (`/api/v1/admin/*`)**

* CRUD para gestión de unidades funcionales, domicilios, miembros autorizados, configuración de geocercas y suscripciones.

# **4\. Permisos, Seguridad y Validación de Presencia**

**Permisos del Visitante (Degradación Elegante)**

* Solicitud de clic explícito para cámara y micrófono bajo entorno HTTPS.  
* Si el visitante rechaza permisos, el sistema degrada a solo audio o chat de texto / recepcionista IA sin interrumpir la alerta de timbre.

**Geocerca y Prevención de Bromas Remotas**

* **Modo Estándar:** Captura de foto obligatoria, Rate Limiting estricto por IP/dispositivo y expiración de sesión.  
* **Modo Blindado (Geofencing GPS):** Validación obligatoria de coordenadas mediante `navigator.geolocation` dentro de un radio de 40 a 60 metros del domicilio. Bloqueo automático si el visitante no se encuentra en la ubicación física.  
* **Lista Negra:** Implementación de botón en la app del residente para silenciar dispositivos abusivos durante un periodo de 24 horas.

# **5\. Módulos de Domótica e Integración Física**

* **Apertura de Puerta Remota:** Integración mediante webhooks autenticados con relés Wi-Fi comerciales (Shelly 1, Sonoff Mini o ESP32) conectados al pestillo eléctrico de 12V. El botón de apertura se integra directamente en la pantalla de videollamada.  
* **Streaming de Cámaras de Seguridad (RTSP/ONVIF):** Visualización del flujo de cámaras fijas exteriores existentes en la app del residente al recibir la llamada, permitiendo una visión de contexto adicional.  
* **Campanilla / Chime Interior con ESP32 (Accesorio Opcional):** Módulo enchufable para el interior del hogar que suena al recibir eventos MQTT/WebSocket, ideal para situaciones donde el residente no dispone de su dispositivo móvil.

# **6\. Modelo de Negocio y Monetización**

1. **Venta de Hardware / Placas Físicas (Margen Inicial):** Comercialización de placas QR en acrílico grabado láser o aluminio apto para intemperie con adhesivo 3M de alta resistencia.  
2. **Planes de Suscripción (SaaS Recurrente):**  
   * **Plan Básico:** Timbre QR, notificación push y videollamada P2P estándar (gratuito con la compra de la placa o abono mínimo).  
   * **Plan Smart IA:** Recepcionista virtual 24/7 con Gemini, detección de paquetes/repartidores, buzón de voz con resumen y respuestas inteligentes.  
3. **Canal B2B para Consorcios:** Comercialización directa a administraciones de edificios y PHs, cobrado dentro de las expensas mensuales con una baja tasa de cancelación (*churn*).

# **7\. Estructura del Monorepo y Flujo de Desarrollo con Antigravity**

Estructura recomendada para el desarrollo asistido con Antigravity CLI/IDE:t  
timbre-qr/  
├── cmd/  
│   ├── ring-dispatcher/    \# main.go  
│   ├── signaling/          \# main.go  
│   ├── gemini-concierge/   \# main.go (o Python con google-antigravity)  
│   ├── quick-action/       \# main.go  
│   └── admin-api/          \# main.go  
├── web-visitor/            \# PWA estática (HTML/CSS/JS con WebRTC)  
├── app-resident/           \# Flutter / React Native (FCM \+ CallKit)  
├── pkg/  
│   ├── models/             \# Entidades Go  
│   ├── fcm/                \# Cliente Push  
│   └── gemini/             \# Integración Gemini API  
├── infra/                  \# Terraform / Serverless Framework  
├── Makefile  
└── go.mod