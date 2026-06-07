import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { onAuthStateChanged } from 'firebase/auth'
import PropertyReviewDashboard from './components/PropertyReviewDashboard'
import PropertyDetailView from './components/PropertyDetailView'
import PropertyMarketplace from './components/PropertyMarketplace'
import Login from './components/Login'
import { auth } from './firebase'
import { useTenant } from './hooks/useTenant'
import { ToastProvider } from './contexts/ToastContext'
import './index.css'

function App() {
  const [route, setRoute] = useState({
    view: 'marketplace', // 'marketplace' | 'admin' | 'detail' | 'login'
    propertyId: null,
    tenantId: 'demo'
  })
  
  const [currentUser, setCurrentUser] = useState(null)
  const [userClaims, setUserClaims] = useState({ admin: false, tenant_id: null })
  const [authLoading, setAuthLoading] = useState(true)

  const { tenantData, loading: tenantLoading } = useTenant(route.tenantId)

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
              return { ...prev, view: 'admin', tenantId: claims.tenant_id || prev.tenantId }
            }
            return { ...prev, tenantId: claims.tenant_id || prev.tenantId }
          })
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

  // 2. Enrutador por URL en base al path
  useEffect(() => {
    const hostname = window.location.hostname
    let currentTenant = 'demo'

    // Extraer tenant del subdominio si no está logueado
    if (hostname && !hostname.startsWith('localhost') && hostname.includes('inmos.app')) {
      const parts = hostname.split('.')
      if (parts.length > 2) {
        currentTenant = parts[0]
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
    }

    setRoute((prev) => ({
      view: authLoading ? prev.view : view, // Evitar parpadeos durante la carga de auth
      propertyId,
      tenantId: userClaims.tenant_id || currentTenant
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
        return <PropertyDetailView propertyId={route.propertyId} tenantId={route.tenantId} tenantData={tenantData} />
      case 'marketplace':
      default:
        return <PropertyMarketplace tenantId={route.tenantId} tenantData={tenantData} />
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
