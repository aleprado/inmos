import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { onAuthStateChanged } from 'firebase/auth'
import PropertyReviewDashboard from './components/PropertyReviewDashboard'
import PropertyDetailView from './components/PropertyDetailView'
import PropertyMarketplace from './components/PropertyMarketplace'
import Login from './components/Login'
import Landing from './components/Landing'
import { auth } from './firebase'
import { useTenant } from './hooks/useTenant'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'
import { applyTheme, applyBackgroundTheme } from './utils/theme'
import { getFunctions, httpsCallable } from 'firebase/functions'

function App() {
  const [route, setRoute] = useState(() => {
    // 1. Extraer tenant inicial sincrónicamente para evitar destellos
    const hostname = window.location.hostname;
    const urlParams = new URLSearchParams(window.location.search);
    let initialTenant = urlParams.get('tenant') || null;

    if (!initialTenant && hostname) {
      const parts = hostname.split('.');
      const isLocal = hostname.startsWith('localhost') || hostname === '127.0.0.1';
      if (!isLocal && parts.length > 2 && parts[0] !== 'www') {
        initialTenant = parts[0];
      }
    }

    const path = window.location.pathname;
    let initialView = 'marketplace';
    let initialPropertyId = null;

    if (path.startsWith('/admin') || path.startsWith('/review')) {
      initialView = 'login'; // Asumimos login hasta que auth cargue
    } else if (path.startsWith('/propiedad/')) {
      initialView = 'detail';
      initialPropertyId = path.split('/propiedad/')[1];
    } else if (path !== '/' && path.length > 1) {
      const cleanPath = path.substring(1);
      if (cleanPath.length > 5) {
        initialView = 'detail';
        initialPropertyId = cleanPath;
      }
    } else if (path === '/' && !initialTenant) {
      initialView = 'landing';
    }

    const finalTenant = initialTenant || (initialView === 'landing' ? null : 'demo');

    return {
      view: initialView,
      propertyId: initialPropertyId,
      tenantId: finalTenant
    };
  });
  
  const [currentUser, setCurrentUser] = useState(null)
  const [userClaims, setUserClaims] = useState({ admin: false, tenant_id: null })
  const [authLoading, setAuthLoading] = useState(true)

  const { tenantData, loading: tenantLoading } = useTenant(route.tenantId)

  // Aplicar el tema dinámico del tenant
  useEffect(() => {
    if (tenantData) {
      if (tenantData.primaryColor) {
        applyTheme(tenantData.primaryColor);
      }

      const root = document.documentElement;
      
      // Limpiar configuraciones previas de layout para evitar colisiones al cambiar tenants
      root.classList.remove('dark', 'theme-custom');
      root.style.removeProperty('--bg-custom');
      root.style.removeProperty('--text-custom');
      root.style.removeProperty('--text-muted-custom');
      root.style.removeProperty('--border-custom');
      root.style.removeProperty('--card-custom');

      if (tenantData.themeMode === 'dark') {
        root.classList.add('dark');
      } else if (tenantData.themeMode === 'custom' && tenantData.backgroundColor) {
        root.classList.add('theme-custom');
        applyBackgroundTheme(tenantData.backgroundColor);
      }
    }
  }, [tenantData]);

  // 1. Escuchar el estado de autenticación de Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true)
      if (user) {
        setCurrentUser(user)
        try {
          // Forzar refresco para obtener las Claims actualizadas (tenant_id, admin)
          const tokenResult = await user.getIdTokenResult(true)
          const claims = tokenResult.claims
          
          setUserClaims({
            admin: !!claims.admin,
            tenant_id: claims.tenant_id || null
          })

          console.log("Usuario logueado claims:", claims)

          // Si el usuario estaba intentando entrar a Login, redirigir a Admin
          setRoute((prev) => {
            if (prev.view === 'login') {
              if (window.location.pathname !== '/admin') {
                window.history.pushState(null, '', '/admin');
              }
              return { ...prev, view: 'admin', tenantId: claims.tenant_id || prev.tenantId };
            }
            return { ...prev, tenantId: claims.tenant_id || prev.tenantId };
          });
        } catch (error) {
          console.error("Error al obtener ID Token Claims:", error)
        }
      } else {
        setCurrentUser(null)
        setUserClaims({ admin: false, tenant_id: null })
        
        // Si no está autenticado e intenta ver el admin, redirigir a Login
        setRoute((prev) => {
          if (prev.view === 'admin') {
            return { ...prev, view: 'login' }
          }
          return prev
        })
      }
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Limpieza global de sesión Demo al cerrar pestaña (para no perder datos al navegar internamente)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (route.tenantId === 'demo') {
        const currentSessionId = sessionStorage.getItem('inmos_demo_session_id');
        if (currentSessionId) {
          const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "inmos-2c701";
          const url = `https://us-central1-${projectId}.cloudfunctions.net/endDemoSession`;
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { sessionId: currentSessionId } }),
            keepalive: true
          }).catch(console.error);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [route.tenantId]);

  // 2. Enrutador por URL en base al path y query parameters
  useEffect(() => {
    const hostname = window.location.hostname
    const urlParams = new URLSearchParams(window.location.search)
    const queryTenant = urlParams.get('tenant')
    
    let currentTenant = queryTenant || null

    // Extraer tenant del subdominio si no hay parámetro query
    if (!queryTenant && hostname) {
      const parts = hostname.split('.')
      const isLocal = hostname.startsWith('localhost') || hostname === '127.0.0.1'
      
      // Si no es local y tiene subdominio (ej: lopez.inmos.app o lopez.inmos-2c701.web.app)
      if (!isLocal && parts.length > 2) {
        const subdomain = parts[0]
        if (subdomain !== 'www') {
          currentTenant = subdomain
        }
      }
    }

    const path = window.location.pathname
    let view = 'marketplace'
    let propertyId = null

    if (path.startsWith('/admin') || path.startsWith('/review')) {
      view = currentUser ? 'admin' : 'login'
    } else if (path.startsWith('/propiedad/')) {
      view = 'detail'
      propertyId = path.split('/propiedad/')[1]
    } else if (path !== '/' && path.length > 1) {
      const cleanPath = path.substring(1)
      if (cleanPath.length > 5) {
        view = 'detail'
        propertyId = cleanPath
      }
    } else if (path === '/' && !currentTenant) {
      // Si estamos en la raíz y no hay ningún subdominio/parámetro de tenant, cargamos landing page
      view = 'landing'
    }

    // Si no es landing y no hay tenant, usar 'demo' como fallback de marketplace
    const finalTenant = currentTenant || (view === 'landing' ? null : 'demo')

    setRoute((prev) => ({
      view: authLoading ? prev.view : view, // Evitar parpadeos durante la carga de auth
      propertyId,
      tenantId: userClaims.tenant_id || finalTenant
    }))
  }, [currentUser, authLoading, userClaims])

  // Cambios manuales de ruta tras acciones (ej: éxito de login)
  const handleLoginSuccess = (user) => {
    // El useEffect de onAuthStateChanged se encargará de refrescar claims y redirigir
  }

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    )
  }

  // Renderizador de Vistas
  const renderView = () => {
    switch (route.view) {
      case 'landing':
        return <Landing setRoute={setRoute} />
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />
      case 'admin':
        return (
          <PropertyReviewDashboard 
            tenantId={route.tenantId} 
            tenantData={tenantData}
            userClaims={userClaims}
            currentUser={currentUser}
          />
        )
      case 'detail':
        return <PropertyDetailView propertyId={route.propertyId} tenantId={route.tenantId} tenantData={tenantData} setRoute={setRoute} />
      case 'marketplace':
      default:
        return <PropertyMarketplace tenantId={route.tenantId} tenantData={tenantData} setRoute={setRoute} />
    }
  }

  return (
    <React.StrictMode>
      <ToastProvider>
        {renderView()}
      </ToastProvider>
    </React.StrictMode>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
