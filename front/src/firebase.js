// Inicialización y configuración de Firebase en el cliente
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

// Configuración de Firebase leída de las variables de entorno de Vite (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-inmos.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-inmos",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-inmos.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:0000000000000000000000"
};

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios principales
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Inicializar Firebase App Check para proteger contra scraping y peticiones maliciosas
if (typeof window !== "undefined") {
  // Habilitar token de depuración para desarrollo en localhost
  const isLocalhost = 
    window.location.hostname === "localhost" || 
    window.location.hostname === "127.0.0.1";
    
  if (isLocalhost) {
    // Esto inyecta el token de desarrollo para evitar fallos de reCAPTCHA
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = 
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    console.info("Firebase App Check configurado en modo debug (localhost).");
  }

  try {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        // Clave pública del sitio de reCAPTCHA Enterprise configurada en la consola de Firebase
        import.meta.env.VITE_RECAPTCHA_ENTERPRISE_KEY || "6Lc_mock_site_key_goes_here"
      ),
      isTokenAutoRefreshEnabled: true
    });
    console.info("Firebase App Check inicializado correctamente.");
  } catch (error) {
    console.error("Error al inicializar Firebase App Check:", error);
  }
}

export default app;
