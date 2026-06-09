import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { Search, Home, MapPin, BedDouble, Ruler, ArrowRight, X, SlidersHorizontal, Info, Map as MapIcon, Grid, Columns, MessageSquare, Send, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import Navbar from './Navbar';

export default function PropertyMarketplace({ tenantId, tenantData }) {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [operationType, setOperationType] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [rooms, setRooms] = useState('');
  
  // Modos de Vista: 'grid' (Solo Lista), 'map' (Solo Mapa), 'mixed' (Lista y Mapa)
  const [viewMode, setViewMode] = useState(() => window.innerWidth >= 768 ? 'mixed' : 'grid'); 
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Estados para el Chat Demo de WhatsApp (Simulación de IA)
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('Vendo departamento 3 ambientes con cochera en Palermo, 82m2, al frente por USD 150.000');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const chatEndRef = useRef(null);

  // Clases CSS dinámicas para los paneles
  const getLeftPanelClass = () => {
    if (viewMode === 'grid') return 'w-full flex flex-col h-full bg-white overflow-hidden';
    if (viewMode === 'map') return 'hidden';
    // 'mixed'
    return 'w-full md:w-1/2 lg:w-[45%] flex flex-col h-full bg-white border-r border-slate-100 overflow-hidden';
  };

  const getRightPanelClass = () => {
    if (viewMode === 'grid') return 'hidden';
    if (viewMode === 'map') return 'w-full h-full flex bg-slate-200 relative';
    // 'mixed'
    return 'hidden md:flex flex-1 h-full bg-slate-200 relative';
  };

  const getGridColumnsClass = () => {
    if (viewMode === 'grid') {
      return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6';
    }
    // 'mixed'
    return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4';
  };

  // Referencias para Leaflet Map
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  // 1. Escuchar propiedades en tiempo real
  useEffect(() => {
    const q = query(
      collection(db, 'properties'),
      where('status', '==', 'approved'),
      where('tenant_id', '==', tenantId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tempProperties = [];
      snapshot.forEach((doc) => {
        tempProperties.push({ id: doc.id, ...doc.data() });
      });
      tempProperties.sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setProperties(tempProperties);
      setFilteredProperties(tempProperties);
      setLoading(false);
    }, (error) => {
      console.error("Error cargando el catálogo:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // 1.5 Inicializar session ID para el chat de demostración
  useEffect(() => {
    if (tenantId === 'demo') {
      let currentSessionId = sessionStorage.getItem('inmos_demo_session_id');
      if (!currentSessionId || currentSessionId === 'undefined' || currentSessionId === 'null') {
        const randomStr = Math.random().toString(36).substring(2, 11);
        currentSessionId = `demo_session_${randomStr}`;
        sessionStorage.setItem('inmos_demo_session_id', currentSessionId);
      }
      setSessionId(currentSessionId);
    }
  }, [tenantId]);

  // 1.6 Mensaje inicial del bot (solo para simulación local, evita llamadas a DB)
  useEffect(() => {
    if (tenantId === 'demo' && chatMessages.length === 0) {
      setChatMessages([{
        id: 'initial',
        text: '¡Hola! Soy Inmos IA. Envíame la descripción de una propiedad (texto o audio) para probar cómo extraigo los datos y los publico.',
        sender: 'bot',
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      }]);
    }
  }, [tenantId, chatMessages.length]);

  // 1.7 Hacer scroll al último mensaje
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isBotTyping, isChatOpen]);

  // Enviar mensaje en el chat
  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() || !sessionId) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setIsBotTyping(true);
    
    // Agregamos mensaje del usuario localmente
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    }]);

    try {
      const functions = getFunctions();
      const processDemoMessageFn = httpsCallable(functions, 'processDemoMessage');
      
      const response = await processDemoMessageFn({
        messageText: messageText,
        sessionId: sessionId
      });
      
      // Procesamos las respuestas del bot
      if (response.data && response.data.replies) {
        const botMessages = response.data.replies.map((text, idx) => ({
          id: `bot_${Date.now()}_${idx}`,
          text: text,
          sender: 'bot',
          createdAt: { seconds: Math.floor(Date.now() / 1000) }
        }));
        
        setChatMessages(prev => [...prev, ...botMessages]);
      }
      setIsBotTyping(false);

    } catch (error) {
      console.error("Error al procesar mensaje de demo:", error);
      setIsBotTyping(false);
      
      setChatMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        text: `❌ Error al conectar con el chatbot de demo: ${error.message || 'Error desconocido'}. Inténtalo de nuevo.`,
        sender: 'bot',
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      }]);
    }
  };

  // Formateador de texto estilo WhatsApp (*negrita* y saltos de línea)
  const formatMessageText = (text) => {
    if (!text) return '';
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: formatted.replace(/\n/g, '<br/>') }} />;
  };

  const welcomeMessage = {
    id: 'welcome',
    sender: 'bot',
    text: `🤖 *¡Hola!* Bienvenido al demostrador interactivo de Inmos.

Aquí puedes probar cómo funciona nuestro cargador de propiedades por IA (WhatsApp style).

*Intenta escribiéndome una descripción de una propiedad en lenguaje natural*, por ejemplo:
_"Vendo departamento de 3 ambientes con 2 baños y cochera en Palermo, 82 m2, por USD 170.000."_

¡Yo procesaré el texto, y la propiedad aparecerá mágicamente en el mapa y el catálogo detrás de mí!`,
    createdAt: null
  };

  const displayedMessages = chatMessages.length === 0 ? [welcomeMessage] : chatMessages;

  // 2. Filtrar propiedades
  useEffect(() => {
    let result = properties;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          (p.title && p.title.toLowerCase().includes(term)) ||
          (p.address && p.address.toLowerCase().includes(term)) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    if (operationType) {
      result = result.filter((p) => p.operationType === operationType);
    }

    if (propertyType) {
      result = result.filter((p) => p.propertyType === propertyType);
    }

    if (priceMin) {
      result = result.filter((p) => p.price && p.price >= Number(priceMin));
    }

    if (priceMax) {
      result = result.filter((p) => p.price && p.price <= Number(priceMax));
    }

    if (rooms) {
      result = result.filter((p) => p.rooms && p.rooms >= Number(rooms));
    }

    setFilteredProperties(result);
  }, [searchTerm, operationType, propertyType, priceMin, priceMax, rooms, properties]);

  // 3. Inicializar y actualizar Leaflet Map
  useEffect(() => {
    // Si el mapa no está visible en el DOM o Leaflet no está cargado por CDN, no hacer nada
    if (!window.L || !document.getElementById('map-container')) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersGroupRef.current = null;
      }
      return;
    }

    // Inicializar mapa si no existe
    if (!mapRef.current) {
      // Coordenadas por defecto (centrado en Buenos Aires/Palermo)
      const initialLat = -34.5986;
      const initialLng = -58.4201;

      const map = window.L.map('map-container', {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([initialLat, initialLng], 13);

      // Usamos el estilo premium Positron de CartoDB (limpio y elegante)
      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      mapRef.current = map;
      markersGroupRef.current = window.L.featureGroup().addTo(map);
    }

    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;

    // Limpiar marcadores previos
    markersGroup.clearLayers();

    // Dibujar marcadores para propiedades con georreferenciación
    const propertiesWithCoords = filteredProperties.filter((p) => p.latitude && p.longitude);

    if (propertiesWithCoords.length > 0) {
      propertiesWithCoords.forEach((p) => {
        const popupContent = `
          <div style="font-family: 'Inter', sans-serif; width: 190px; padding: 4px;">
            ${p.images && p.images.length > 0 ? `<img src="${p.images[0]}" style="width:100%; height:90px; object-fit:cover; border-radius:10px; margin-bottom:8px;"/>` : ''}
            <span style="font-size:9px; color:#0b57d0; font-weight:800; text-transform:uppercase; display:block; margin-bottom:2px;">
              ${p.propertyType} · ${p.operationType}
            </span>
            <h4 style="margin: 0 0 6px 0; font-size:11.5px; font-weight:800; color:#0f172a; line-height:1.3;">
              ${p.title}
            </h4>
            <div style="font-size:13px; font-weight:900; color:#0b57d0; margin-bottom:8px;">
              ${p.currency} ${p.price ? p.price.toLocaleString() : 'Consultar'}
            </div>
            <a href="/propiedad/${p.id}" style="display:block; text-align:center; background:#0b57d0; color:white; font-size:10px; font-weight:bold; padding:6px 0; border-radius:6px; text-decoration:none;">
              Ver Detalles
            </a>
          </div>
        `;

        // Pin personalizado de estilo premium (círculo azul oscuro con sombra)
        const pinIcon = window.L.divIcon({
          html: `<div style="background-color: #0b57d0; width: 14px; height: 14px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
          className: 'custom-leaflet-pin',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        const marker = window.L.marker([p.latitude, p.longitude], { icon: pinIcon })
          .bindPopup(popupContent, { closeButton: false });

        markersGroup.addLayer(marker);
      });

      // Auto-zoom para encuadrar todos los pines en el mapa
      map.fitBounds(markersGroup.getBounds(), { padding: [50, 50] });
    }

  }, [filteredProperties, viewMode]);

  // 4. Forzar redibujado/redimensionamiento de Leaflet cuando cambia el modo de vista
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize({ animate: true });
      }, 100);
    }
  }, [viewMode]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setOperationType('');
    setPropertyType('');
    setPriceMin('');
    setPriceMax('');
    setRooms('');
  };

  const getOperationBadgeStyle = (op) => {
    switch (op) {
      case 'Venta':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'Alquiler':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'Alquiler Temporario':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col h-screen overflow-hidden">
      
      {/* HEADER DE MARCA BLANCA */}
      <Navbar tenantData={tenantData}>
        {/* Alternador de Vistas */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition ${viewMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Grid className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition ${viewMode === 'map' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <MapIcon className="h-3.5 w-3.5" />
            Mapa
          </button>
          <button
            onClick={() => setViewMode('mixed')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition ${viewMode === 'mixed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Columns className="h-3.5 w-3.5" />
            Mixta
          </button>
        </div>
      </Navbar>

      {/* CONTENEDOR PRINCIPAL FLEXIBLE (Fuerza scroll interno) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* PANEL IZQUIERDO: FILTROS Y LISTA DE PROPIEDADES */}
        <div className={getLeftPanelClass()}>
          {/* Caja de Búsqueda y Filtros Rápidos */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 h-4.5 w-4.5" />
              <input
                type="text"
                placeholder="Busca por zona, calle o palabra clave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-brand-500 transition shadow-sm"
              />
            </div>
            
            {/* Filtros de un Clic */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowMobileFilters(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 transition"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
              </button>
              {(operationType || propertyType || priceMin || priceMax || rooms) && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold px-2"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Listado de Propiedades con Scroll Interno */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className={getGridColumnsClass()}>
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-white border border-slate-150 rounded-2xl overflow-hidden flex flex-col h-64 animate-pulse">
                    <div className="h-36 bg-slate-200 w-full" />
                    <div className="p-4 flex-1 flex flex-col space-y-3">
                      <div className="h-3 bg-slate-200 w-1/4 rounded-full" />
                      <div className="h-4 bg-slate-200 w-3/4 rounded-full" />
                      <div className="h-3 bg-slate-200 w-1/2 rounded-full mt-1" />
                      <div className="flex justify-between items-end mt-auto pt-2">
                        <div className="h-5 bg-slate-200 w-1/3 rounded-full" />
                        <div className="h-3 bg-slate-200 w-1/4 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-8 text-center max-w-sm mx-auto mt-6">
                <Info className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <h3 className="font-bold text-slate-800 text-sm">Sin resultados</h3>
                <p className="text-slate-500 text-xs mt-1">Prueba reajustando la búsqueda o los filtros.</p>
              </div>
            ) : (
              <div className={getGridColumnsClass()}>
                {filteredProperties.map((prop) => (
                  <a
                    href={`/propiedad/${prop.id}`}
                    key={prop.id}
                    className="bg-white border border-slate-150 rounded-2xl overflow-hidden flex flex-col hover:border-brand-500/30 hover:shadow-md transition group"
                  >
                    {/* Foto */}
                    <div className="h-36 bg-slate-100 relative overflow-hidden">
                      {prop.images && prop.images.length > 0 ? (
                        <img
                          src={prop.images[0]}
                          alt={prop.title}
                          className="w-full h-full object-cover group-hover:scale-101 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                          <Home className="h-8 w-8 stroke-1" />
                          <span className="text-[10px]">Sin imagen</span>
                        </div>
                      )}
                      <span className={`absolute top-2.5 left-2.5 border text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider backdrop-blur-md ${getOperationBadgeStyle(prop.operationType)}`}>
                        {prop.operationType || 'Consulta'}
                      </span>
                    </div>

                    {/* Contenido */}
                    <div className="p-4 flex-1 flex flex-col">
                      <span className="text-[9px] text-brand-500 font-extrabold uppercase tracking-wider block mb-0.5">
                        {prop.propertyType}
                      </span>
                      <h3 className="font-bold text-sm text-slate-850 line-clamp-1 group-hover:text-brand-500 transition-colors">
                        {prop.title}
                      </h3>
                      <p className="text-slate-400 text-[10px] flex items-center gap-1 mt-1 mb-3">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {prop.address || 'Ubicación reservada'}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                        <span className="text-slate-800 font-extrabold text-sm">
                          {prop.price ? `${prop.currency} ${prop.price.toLocaleString()}` : 'Consultar'}
                        </span>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <BedDouble className="h-3.5 w-3.5 text-slate-350" />
                          <span>{prop.rooms || '—'} amb.</span>
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: MAPA INTERACTIVO */}
        <div className={getRightPanelClass()}>
          <div id="map-container" className="h-full w-full z-10" />
          
          {/* Leyenda/Estado del Mapa */}
          <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 text-white text-[10px] px-3.5 py-2 rounded-xl backdrop-blur-md border border-slate-800 shadow-lg flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            <span>Ubicación aproximada de los inmuebles</span>
          </div>
        </div>
      </div>

      {/* FILTROS FLOTANTES MÓVILES / ESCRITORIO MODAL */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end animate-in fade-in duration-150">
          <div className="w-80 bg-white h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-extrabold text-lg text-slate-800">Filtros de Búsqueda</h2>
                <button 
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Operación */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Operación</label>
                  <select
                    value={operationType}
                    onChange={(e) => setOperationType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="">Cualquier operación</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Venta">Venta</option>
                    <option value="Alquiler Temporario">Alquiler Temporario</option>
                  </select>
                </div>

                {/* Tipo Propiedad */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Tipo de Propiedad</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="">Todos los tipos</option>
                    <option value="Casa">Casa</option>
                    <option value="Departamento">Departamento</option>
                    <option value="Oficina">Oficina</option>
                    <option value="Local Comercial">Local Comercial</option>
                    <option value="Terreno">Terreno</option>
                  </select>
                </div>

                {/* Precio Rango */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Rango de Precios</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Mínimo"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Máximo"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                {/* Dormitorios */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">Dormitorios (Mín.)</label>
                  <select
                    value={rooms}
                    onChange={(e) => setRooms(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="">Cualquiera</option>
                    <option value="1">1 o más</option>
                    <option value="2">2 o más</option>
                    <option value="3">3 o más</option>
                    <option value="4">4 o más</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={handleClearFilters}
                className="flex-1 border border-slate-200 text-slate-500 font-bold py-3 rounded-xl text-xs transition hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 bg-brand-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-brand-500/10"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT EN VIVO WHATSAPP SIMULACIÓN IA */}
      {tenantId === 'demo' && (
        <>
          {/* Contenedor del Botón y Animaciones (Más Choque Visual) */}
          <div className="fixed bottom-6 right-6 z-50 flex items-center justify-center">
            {/* Ondas expansivas intensas */}
            {!isChatOpen && (
              <>
                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30 duration-700"></div>
                <div className="absolute -inset-3 rounded-full border-2 border-emerald-400 animate-pulse opacity-50"></div>
              </>
            )}
            
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`relative z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer group ${
                isChatOpen 
                  ? 'bg-slate-800 text-white hover:bg-slate-700 hover:rotate-90' 
                  : 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white hover:scale-110 shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-emerald-300/30'
              }`}
              aria-label="Probar Bot de IA"
            >
              {isChatOpen ? (
                <X className="h-7 w-7" />
              ) : (
                <div className="relative">
                  <MessageSquare className="h-8 w-8 group-hover:scale-110 transition-transform duration-200" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white shadow-lg shadow-red-500/50"></span>
                  </span>
                </div>
              )}
            </button>
          </div>
          
          {/* Tooltip flotante explicativo más vibrante */}
          {!isChatOpen && (
            <div className="fixed bottom-9 right-[7.5rem] bg-gradient-to-r from-slate-900 to-slate-800 text-white text-xs font-black py-2.5 px-4 rounded-2xl shadow-[0_10px_25px_rgba(16,185,129,0.2)] z-40 animate-bounce flex items-center gap-2 border border-emerald-500/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              </span>
              ¡PRUEBA EL BOT DE WHATSAPP!
              {/* Flecha lateral derecha */}
              <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-slate-800 rotate-45 border-t border-r border-emerald-500/30 z-[-1]"></div>
            </div>
          )}

          {/* Panel de Chat */}
          {isChatOpen && (
            <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[550px] w-full h-full bg-[#efeae2] sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
              
              {/* Cabecera del chat (WhatsApp Style) */}
              <div className="bg-[#075e54] text-white p-4 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center font-bold text-sm border border-emerald-400/30">
                    🤖
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#075e54] rounded-full"></span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm tracking-wide">Inmos IA Assistant</span>
                    <span className="text-[11px] text-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                      En línea
                    </span>
                  </div>
                </div>
                
                {/* Cerrar */}
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 rounded-full hover:bg-emerald-700/50 text-emerald-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Historial de Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
                {displayedMessages.map((msg, idx) => (
                  <div
                    key={msg.id || idx}
                    className={`max-w-[85%] rounded-2xl p-3 shadow-sm text-sm relative break-words ${
                      msg.sender === 'user'
                        ? 'self-end bg-[#d9fdd3] text-slate-800 rounded-tr-none'
                        : 'self-start bg-white text-slate-800 rounded-tl-none border border-slate-100'
                    }`}
                  >
                    <div className="leading-relaxed">
                      {formatMessageText(msg.text)}
                    </div>
                    
                    <span className="text-[9px] text-slate-400 mt-1 block text-right">
                      {msg.createdAt 
                        ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                
                {/* Indicador de escritura del Bot */}
                {isBotTyping && (
                  <div className="self-start bg-white text-slate-800 rounded-2xl rounded-tl-none p-3 max-w-[85%] shadow-sm text-sm border border-slate-100 flex items-center gap-1.5 animate-pulse">
                    <span className="text-xs text-slate-400">Inmos IA está procesando...</span>
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>
              
              {/* Input de Mensajes */}
              <form onSubmit={handleSendChatMessage} className="p-3 bg-[#f0f0f0] flex items-center gap-2 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    if (isBotTyping || !sessionId) return;
                    setIsBotTyping(true);
                    setChatMessages(prev => [...prev, {
                      id: Date.now().toString(),
                      text: "📷 [Enviando imagen de ejemplo...]",
                      sender: 'user',
                      createdAt: { seconds: Math.floor(Date.now() / 1000) }
                    }]);
                    try {
                      const functions = getFunctions();
                      const processDemoMessageFn = httpsCallable(functions, 'processDemoMessage');
                      const response = await processDemoMessageFn({
                        messageText: '',
                        imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
                        sessionId: sessionId
                      });
                      if (response.data && response.data.replies) {
                        const botMessages = response.data.replies.map((text, idx) => ({
                          id: `bot_${Date.now()}_${idx}`,
                          text: text,
                          sender: 'bot',
                          createdAt: { seconds: Math.floor(Date.now() / 1000) }
                        }));
                        setChatMessages(prev => [...prev, ...botMessages]);
                      }
                    } catch (error) {
                      console.error("Error al enviar imagen de demo:", error);
                      setChatMessages(prev => [...prev, {
                        id: `err_${Date.now()}`,
                        text: `❌ Error: ${error.message}`,
                        sender: 'bot',
                        createdAt: { seconds: Math.floor(Date.now() / 1000) }
                      }]);
                    }
                    setIsBotTyping(false);
                  }}
                  title="Enviar foto de ejemplo"
                  disabled={isBotTyping}
                  className="w-10 h-10 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-600 rounded-full flex items-center justify-center shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  <Grid className="h-5 w-5" />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ej: Vendo depto 3 amb en Palermo por USD 150.000, 80m2..."
                  disabled={isBotTyping}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isBotTyping}
                  className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-full flex items-center justify-center shadow-md transition disabled:bg-slate-300 disabled:scale-100 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  {isBotTyping ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
