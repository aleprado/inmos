import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { MessageCircle, MapPin, BedDouble, Ruler, Share2, ShieldAlert, ArrowLeft, ArrowRight, Eye, Bath, Video } from 'lucide-react';
import { db } from '../firebase';
import { updateMetaTags } from '../utils/seo';
import { useToast } from '../contexts/ToastContext';

export default function PropertyDetailView({ propertyId, tenantId, setRoute }) {
  const toast = useToast();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashFadeOut, setSplashFadeOut] = useState(false);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!propertyId) {
      setLoading(false);
      return;
    }

    const fetchProperty = async () => {
      try {
        const docRef = doc(db, 'properties', propertyId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Permitir visualizar si la propiedad está aprobada
          // O si está en borrador/pendiente y estamos previsualizando de forma administrativa
          if (data.status === 'approved' || window.location.pathname.includes('review')) {
            setProperty({id: docSnap.id, ...data}); // Incluimos el ID para referencia futura
            
            // Incrementar contador de vistas único por sesión (solo para propiedades aprobadas vistas por el público)
            const viewKey = `viewed_${propertyId}`;
            if (data.status === 'approved' && !sessionStorage.getItem(viewKey) && !window.location.pathname.includes('review')) {
              sessionStorage.setItem(viewKey, 'true');
              updateDoc(docRef, { views: increment(1) }).catch(err => console.error("No se pudo actualizar vistas:", err));
            }

            // Actualizar SEO Dinámico
            updateMetaTags({
              title: data.title,
              description: data.description?.substring(0, 160) || `Propiedad en ${data.operationType} - ${tenantId}`,
              image: data.images?.[0] || null,
              url: window.location.href
            });
          } else {
            console.warn("Intento de acceso a propiedad no aprobada:", propertyId);
          }
        } else {
          console.error("Propiedad no encontrada:", propertyId);
        }
      } catch (error) {
        console.error("Error al cargar la propiedad:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [propertyId]);

  // Manejar el ciclo de vida del Splash Screen
  useEffect(() => {
    if (!loading) {
      // Iniciar el fade out cuando ya no estemos cargando
      const timer1 = setTimeout(() => setSplashFadeOut(true), 500);
      // Quitar el splash del DOM después de que termine la animación
      const timer2 = setTimeout(() => setShowSplash(false), 1000);
      return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }
  }, [loading]);

  const handleNextImage = () => {
    if (!property || !property.images) return;
    setActiveImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const handlePrevImage = () => {
    if (!property || !property.images) return;
    setActiveImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  // Inicializar mapa de Leaflet si la propiedad tiene coordenadas
  useEffect(() => {
    if (!property || !property.latitude || !property.longitude || !document.getElementById('detail-map-container') || !window.L) return;

    if (!mapRef.current) {
      const map = window.L.map('detail-map-container', {
        zoomControl: true,
        scrollWheelZoom: false, // Desactivar zoom con scroll para no interferir con la navegación de la página
        dragging: !window.L.Browser.mobile // Desactivar dragging en móviles
      }).setView([property.latitude, property.longitude], 15);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapRef.current = map;

      const pinIcon = window.L.divIcon({
        html: `<div style="background-color: #0b57d0; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>`,
        className: 'custom-leaflet-pin',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });

      markerRef.current = window.L.marker([property.latitude, property.longitude], { icon: pinIcon }).addTo(map);
    } else {
      mapRef.current.setView([property.latitude, property.longitude], 15);
      if (markerRef.current) {
        markerRef.current.setLatLng([property.latitude, property.longitude]);
      }
    }
  }, [property]);

  // Enlace de WhatsApp predefinido para consultas de clientes
  const getWhatsAppLink = () => {
    if (!property) return '#';
    const message = `Hola, estoy interesado en el/la ${property.propertyType || 'propiedad'} en ${property.operationType || 'operación'} ubicado/a en "${property.address || property.title}" que vi mediante el código QR (Ref: ${property.id}). ¿Sigue disponible?`;
    let phone = property.metadata?.sender || property.whatsappNumber || "5491100000000";
    // Si es un número de Argentina de 11 dígitos (ej: 542342...), insertamos el '9' móvil para ruteo correcto de WhatsApp
    if (phone.startsWith('54') && !phone.startsWith('549') && phone.length === 11) {
      phone = '549' + phone.substring(2);
    }
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppClick = () => {
    if (!propertyId || !property || property.status !== 'approved' || window.location.pathname.includes('review')) return;
    
    const inquiryKey = `inquiry_${propertyId}`;
    if (!sessionStorage.getItem(inquiryKey)) {
      sessionStorage.setItem(inquiryKey, 'true');
      const docRef = doc(db, 'properties', propertyId);
      updateDoc(docRef, { inquiries: increment(1) }).catch(err => console.error("No se pudo actualizar consultas:", err));
    }
  };

  // Obtener estilo estético del badge de operación
  const getOperationBadgeStyle = (op) => {
    switch (op) {
      case 'Venta':
        return 'bg-blue-600 text-white';
      case 'Alquiler':
        return 'bg-emerald-600 text-white';
      case 'Alquiler Temporario':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-24 animate-pulse">
        {/* Skeleton Hero */}
        <div className="relative h-[48vh] md:h-[65vh] w-full bg-slate-200"></div>
        {/* Skeleton Content */}
        <div className="max-w-3xl mx-auto px-6 pt-6 space-y-4">
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-slate-200 rounded-full"></div>
            <div className="h-6 w-24 bg-slate-200 rounded-full"></div>
          </div>
          <div className="h-10 bg-slate-200 w-3/4 rounded-xl mt-4"></div>
          <div className="h-12 bg-slate-200 w-1/3 rounded-xl"></div>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6 mb-6">
            <div className="h-8 w-8 bg-slate-200 rounded-full shrink-0"></div>
            <div className="h-4 bg-slate-200 w-1/2 rounded"></div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="h-24 bg-slate-200 rounded-2xl"></div>
            <div className="h-24 bg-slate-200 rounded-2xl"></div>
            <div className="h-24 bg-slate-200 rounded-2xl"></div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 w-full rounded"></div>
            <div className="h-4 bg-slate-200 w-full rounded"></div>
            <div className="h-4 bg-slate-200 w-3/4 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4 animate-bounce">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-800">Publicación no disponible</h1>
        <p className="text-slate-500 text-sm max-w-sm mt-2 leading-relaxed">
          Esta publicación no se encuentra activa, está bajo revisión o el enlace es incorrecto. Por favor, escanea un código QR activo.
        </p>
        <a 
          href="/" 
          className="mt-6 bg-brand-500 hover:bg-brand-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition"
        >
          Ir al catálogo público
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans pb-24 flex flex-col relative overflow-hidden">
      
      {/* SPLASH SCREEN PREMIUM */}
      {showSplash && (
        <div className={`absolute inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center transition-all duration-500 ease-in-out ${splashFadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="relative flex flex-col items-center justify-center animate-in zoom-in-95 duration-1000">
            <div className="absolute inset-0 bg-brand-500/20 blur-[80px] rounded-full"></div>
            {tenantData?.logoUrl ? (
              <img src={tenantData.logoUrl} alt="Logo" className="w-24 h-24 object-contain mb-6 drop-shadow-2xl bg-white p-3 rounded-[2rem] relative z-10" />
            ) : (
              <img src="/favicon.png" alt="Logo" className="w-24 h-24 object-cover mb-6 rounded-[2rem] drop-shadow-2xl relative z-10" />
            )}
            <div className="relative z-10 flex flex-col items-center text-center">
              <span className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-[0.3em] mb-2">Catálogo</span>
              <h1 className="text-3xl sm:text-4xl font-black text-brand-400 tracking-tight leading-none px-4">
                {tenantData?.name ? tenantData.name.toUpperCase() : 'INMOS'}
              </h1>
            </div>
            <div className="mt-10 flex gap-3 relative z-10">
              <div className="h-3 w-3 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="h-3 w-3 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="h-3 w-3 bg-brand-500 rounded-full animate-bounce"></div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Hero Image Carousel (Full Screen Width) */}
      <div className="relative h-[48vh] md:h-[65vh] w-full bg-slate-950 group">
        {property.images && property.images.length > 0 ? (
          <>
            <img 
              src={property.images[activeImageIndex]} 
              alt={property.title} 
              className="w-full h-full object-cover transition-all duration-700 ease-in-out cursor-pointer"
              onClick={() => setShowLightbox(true)}
            />
            {/* Carrusel dots */}
            <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10">
              {property.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${idx === activeImageIndex ? 'w-6 bg-white shadow-md' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                />
              ))}
            </div>
            {/* Controles del Carrusel */}
            {property.images.length > 1 && (
              <>
                <button 
                  onClick={handlePrevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <button 
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2.5 rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
            <Share2 className="h-10 w-10 stroke-1" />
            <span className="text-xs mt-2">Cargando imágenes de la propiedad...</span>
          </div>
        )}

        {/* Gradiente sutil superior */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Botón Volver (si no es embebido) */}
        <a 
          href={tenantId === 'demo' ? '/?tenant=demo' : `/?tenant=${tenantId}`}
          onClick={(e) => {
            e.preventDefault();
            window.history.pushState(null, '', tenantId === 'demo' ? '/?tenant=demo' : `/?tenant=${tenantId}`);
            if (setRoute) {
              setRoute(prev => ({ ...prev, view: 'marketplace', propertyId: null }));
            } else {
              window.location.href = tenantId === 'demo' ? '/?tenant=demo' : `/?tenant=${tenantId}`;
            }
          }}
          className="absolute top-4 left-4 bg-white/80 hover:bg-white text-slate-800 p-2.5 rounded-full backdrop-blur-md shadow-md transition cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </a>
      </div>

      {/* 2. Sección de Contenido */}
      <div className="max-w-3xl mx-auto px-6 pt-6">
        
        {/* Badges de Operación, Tipo e Inmobiliaria */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider shadow-sm ${getOperationBadgeStyle(property.operationType)}`}>
              {property.operationType || 'Consulta'}
            </span>
            <span className="bg-slate-100 text-slate-700 text-[10px] px-3.5 py-1.5 rounded-full font-bold uppercase tracking-wider border border-slate-200">
              {property.propertyType || 'Inmueble'}
            </span>
            {property.featured && (
              <span className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 text-[10px] px-3 py-1 rounded-full font-extrabold uppercase tracking-wider">
                ★ Destacado
              </span>
            )}
          </div>
          <button 
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: property.title,
                  text: property.description,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Enlace de propiedad copiado al portapapeles.");
              }
            }}
            className="text-slate-400 hover:text-slate-650 p-2 rounded-full hover:bg-slate-100 transition"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {/* Título & Precio */}
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 mb-2 leading-tight">
          {property.title}
        </h1>

        <div className="text-3xl font-black text-brand-500 mb-5 flex items-baseline">
          {property.price ? `${property.currency || 'USD'} ${property.price.toLocaleString()}` : "Consultar Precio"}
        </div>

        {/* Dirección */}
        {property.address && (
          <div className="flex items-center gap-2.5 text-slate-550 text-sm mb-6 pb-6 border-b border-slate-100">
            <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 shrink-0">
              <MapPin className="h-4.5 w-4.5" />
            </div>
            <span>{property.address}</span>
          </div>
        )}

        {/* Características Iconográficas Premium */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="h-9 w-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-1.5">
              <BedDouble className="h-4.5 w-4.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Dormitorios</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{property.rooms ? `${property.rooms} Dorm.` : '—'}</div>
          </div>
          
          <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="h-9 w-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-1.5">
              <Bath className="h-4.5 w-4.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Baños</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{property.bathrooms ? `${property.bathrooms} Baños` : '—'}</div>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="h-9 w-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center mb-1.5">
              <Ruler className="h-4.5 w-4.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">Superficie</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">{property.area ? `${property.area} m²` : '—'}</div>
          </div>
        </div>

        {/* Descripción */}
        <div className="space-y-3 pb-8">
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider text-[11px]">Descripción de la propiedad</h2>
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line bg-slate-50/40 p-5 rounded-2xl border border-slate-100">
            {property.description || "Esta publicación no cuenta con descripción detallada en este momento."}
          </p>
        </div>

        {/* Mapa de Ubicación */}
        {property.latitude && property.longitude && (
          <div className="space-y-3 pb-8">
            <h2 className="text-base font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-brand-500" />
              Ubicación Geográfica
            </h2>
            <div 
              id="detail-map-container" 
              className="w-full h-[250px] sm:h-[350px] bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-md relative z-0"
            ></div>
          </div>
        )}

        {/* Recorrido Virtual 360 */}
        {property.virtualTourUrl && (
          <div className="space-y-3 pb-10">
            <h2 className="text-base font-bold text-indigo-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Video className="h-4.5 w-4.5" />
              Recorrido Virtual 360° Premium
            </h2>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-4 border-indigo-50 shadow-xl bg-slate-100">
              <iframe 
                src={property.virtualTourUrl.includes('youtube.com/watch?v=') ? property.virtualTourUrl.replace('watch?v=', 'embed/') : property.virtualTourUrl} 
                className="absolute inset-0 w-full h-full"
                title="Recorrido Virtual"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}
      </div>

      {/* 3. Floating Action Bar (Mobile Premium UX) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-slate-100 p-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="flex-1 hidden md:block">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inmobiliaria</div>
            <div className="text-sm font-black text-slate-850">{tenantId.toUpperCase()}</div>
          </div>
          <a 
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWhatsAppClick}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] text-xs uppercase tracking-wider text-center"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Enviar Consulta por WhatsApp
          </a>
        </div>
      </div>

      {/* 4. Fullscreen Lightbox */}
      {showLightbox && property.images && property.images.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-end p-4 shrink-0">
            <button 
              onClick={() => setShowLightbox(false)}
              className="text-white/70 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
            >
              <ArrowLeft className="h-6 w-6" /> {/* Uso ArrowLeft o X como salir */}
            </button>
          </div>
          <div className="flex-1 relative flex items-center justify-center p-4">
            <img 
              src={property.images[activeImageIndex]} 
              alt="Vista completa"
              className="max-w-full max-h-full object-contain select-none"
            />
            {property.images.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-black/50 hover:bg-black/80 rounded-full transition"
                >
                  <ArrowLeft className="h-8 w-8" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-black/50 hover:bg-black/80 rounded-full transition"
                >
                  <ArrowRight className="h-8 w-8" />
                </button>
              </>
            )}
          </div>
          <div className="p-4 text-center text-white/70 text-sm shrink-0 font-bold">
            {activeImageIndex + 1} / {property.images.length}
          </div>
        </div>
      )}
    </div>
  );
}
