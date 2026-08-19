# Deploy — Timbre QR

## Pre-requisitos

- Firebase CLI instalado: `npm install -g firebase-tools`
- Proyecto Firebase existente (el de inmos o uno nuevo)
- Cuenta Meta Business con WhatsApp Business API activa

---

## 1 — Configurar credenciales

### 1a. Firebase project ID
Editá `.firebaserc` y reemplazá `YOUR_FIREBASE_PROJECT_ID` por el ID real
(ej: `inmos-2c701`).

### 1b. Firebase Web config (para las páginas HTML)
En Firebase Console → Configuración → Tu app web, copiá los valores y
reemplazá los placeholders en:
- `web-visitor/index.html` → bloque `CONFIG.firebase`
- `web-visitor/resident.html` → bloque `CONFIG.firebase`

Los placeholders son: `YOUR_API_KEY`, `YOUR_PROJECT`, `YOUR_SENDER_ID`, `YOUR_APP_ID`

### 1c. Crear los dos Hosting Sites en Firebase Console
Firebase Console → Hosting → Agregar sitio:
- `timbre-qr-visitor`  (URL visitante: timbre-qr-visitor.web.app)
- `timbre-qr-app`      (URL residente: timbre-qr-app.web.app)

---

## 2 — Variables de entorno de las Functions

```bash
firebase functions:secrets:set GEMINI_API_KEY
# pegar el valor cuando lo pida

firebase functions:secrets:set WA_ACCESS_TOKEN
firebase functions:secrets:set WA_PHONE_NUMBER_ID
```

Y en `infra/functions/src/index.js` (o via Firebase Console → Functions → Config):
```
APP_DOMAIN = https://timbre-qr-visitor.web.app
```

---

## 3 — Build del frontend residente

```bash
cd front
npm install
npm run build
cd ..
```

---

## 4 — Deploy completo

```bash
# Desde la raíz del repo
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID

firebase deploy --only functions
firebase deploy --only hosting:visitor
firebase deploy --only hosting:app
firebase deploy --only firestore
firebase deploy --only storage
```

O todo junto:
```bash
firebase deploy
```

---

## 5 — Seed de primera unidad y puerta (Firestore)

Crear manualmente en Firebase Console → Firestore:

**Colección `units`**, documento con ID aleatorio:
```json
{
  "unitId": "<mismo-id-del-doc>",
  "name": "Dpto 4B",
  "address": "Av. Corrientes 1234",
  "ownerUid": "<uid-del-residente-en-Firebase-Auth>",
  "memberUids": ["<uid-del-residente>"],
  "fcmTokens": [],
  "whatsappPhones": ["5491112345678"],
  "absenceMode": false,
  "createdAt": "<timestamp>"
}
```

**Colección `doors`**, documento con ID aleatorio:
```json
{
  "doorId": "<mismo-id-del-doc>",
  "unitId": "<id-de-la-unit-de-arriba>",
  "label": "Puerta Principal",
  "status": "active",
  "qrUrl": "https://timbre-qr-visitor.web.app/v/<doorId>",
  "geofenceLatLng": null,
  "geofenceRadius": 60,
  "webhookUrl": null,
  "createdAt": "<timestamp>"
}
```

El QR apunta a: `https://timbre-qr-visitor.web.app/v/{doorId}`

---

## 6 — Test rápido

1. Abrí `https://timbre-qr-visitor.web.app/v/{doorId}` en un celular
2. Tocá "Tocar timbre"
3. Debería llegar un WhatsApp al número configurado con un link a `resident.html`
4. Abrí el link → ves la foto/clip → mandás una respuesta rápida
5. El visitante la ve en su pantalla en tiempo real
