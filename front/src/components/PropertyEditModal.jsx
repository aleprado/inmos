import React, { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { X, Save, AlertCircle, Upload, Trash2, GripVertical, Star } from 'lucide-react';

export default function PropertyEditModal({ property, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    title: property?.title || '',
    description: property?.description || '',
    price: property?.price || '',
    currency: property?.currency || 'USD',
    operationType: property?.operationType || 'Venta',
    propertyType: property?.propertyType || 'Departamento',
    status: property?.status || 'pending',
    rooms: property?.rooms || '',
    bathrooms: property?.bathrooms || '',
    area: property?.area || '',
    virtualTourUrl: property?.virtualTourUrl || '',
    address: property?.address || '',
    latitude: property?.latitude || null,
    longitude: property?.longitude || null,
    featured: property?.featured || false
  });

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const [images, setImages] = useState(property?.images || []);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Drag and Drop States
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setUploadingImages(true);
    setError(null);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const fileRef = ref(storage, `properties/${property.id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedUrls.push(url);
      }
      setImages(prev => [...prev, ...uploadedUrls]);
    } catch (err) {
      console.error("Error uploading images:", err);
      setError("Ocurrió un error al subir las imágenes. Inténtalo de nuevo.");
    } finally {
      setUploadingImages(false);
    }
  };

  const handleImageDelete = (idxToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'properties', property.id);
      
      let latitude = formData.latitude;
      let longitude = formData.longitude;

      // Si la dirección cambió y no ajustaron el pin manualmente, intentamos geocodificar
      if (formData.address !== property.address && formData.latitude === property?.latitude && formData.longitude === property?.longitude) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.address + ', Argentina')}&format=json&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
            latitude = parseFloat(data[0].lat);
            longitude = parseFloat(data[0].lon);
          }
        } catch (err) {
          console.error("Error geocodificando en cliente:", err);
        }
      }

      const payload = {
        title: formData.title,
        description: formData.description,
        currency: formData.currency,
        operationType: formData.operationType,
        propertyType: formData.propertyType,
        status: formData.status,
        virtualTourUrl: formData.virtualTourUrl || null,
        address: formData.address || null,
        latitude: latitude,
        longitude: longitude,
        images: images,
        featured: formData.featured
      };

      // Limpiar numéricos
      if (formData.price) payload.price = Number(formData.price);
      if (formData.rooms) payload.rooms = Number(formData.rooms);
      if (formData.bathrooms) payload.bathrooms = Number(formData.bathrooms);
      if (formData.area) payload.area = Number(formData.area);

      await updateDoc(docRef, payload);
      
      onUpdated({ ...property, ...payload });
      onClose();
    } catch (err) {
      console.error("Error updating property:", err);
      setError("No se pudo guardar la propiedad. Revisa los permisos o la conexión.");
    } finally {
      setSaving(false);
    }
  };

  // ----- Drag and Drop Reordering Handlers -----
  const handleDragStart = (e, idx) => {
    setDraggedItemIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    // Fix for Firefox
    e.dataTransfer.setData("text/html", e.target.parentNode);
    e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (draggedItemIndex === null) return;
    if (draggedItemIndex === idx) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedItemIndex];
    newImages.splice(draggedItemIndex, 1);
    newImages.splice(idx, 0, draggedItem);
    
    setImages(newImages);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleGeocode = async () => {
    if (!formData.address) return;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.address + ', Argentina')}&format=json&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        setFormData(prev => ({ ...prev, latitude: lat, longitude: lon }));
        
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 16);
          if (!markerRef.current) {
            const pinIcon = window.L.divIcon({
              html: `<div style="background-color: #0b57d0; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>`,
              className: 'custom-leaflet-pin',
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            markerRef.current = window.L.marker([lat, lon], { icon: pinIcon, draggable: true }).addTo(mapRef.current);
            markerRef.current.on('dragend', function () {
              const latlng = markerRef.current.getLatLng();
              setFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }));
            });
          } else {
            markerRef.current.setLatLng([lat, lon]);
          }
        }
      } else {
        alert("No se encontró la ubicación. Por favor, sé más específico.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Inicializar mapa de edición
  React.useEffect(() => {
    const initMap = () => {
      if (!document.getElementById('edit-map-container') || !window.L || mapRef.current) return;

      const initialLat = formData.latitude || -34.6037; // Default: Buenos Aires
      const initialLon = formData.longitude || -58.3816;
      const zoom = formData.latitude ? 16 : 11;

      const map = window.L.map('edit-map-container').setView([initialLat, initialLon], zoom);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors',
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

      if (formData.latitude && formData.longitude) {
        markerRef.current = window.L.marker([formData.latitude, formData.longitude], { icon: pinIcon, draggable: true }).addTo(map);
        markerRef.current.on('dragend', function () {
          const latlng = markerRef.current.getLatLng();
          setFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }));
        });
      }

      map.on('click', function(e) {
        if (!markerRef.current) {
          markerRef.current = window.L.marker(e.latlng, { icon: pinIcon, draggable: true }).addTo(map);
          markerRef.current.on('dragend', function () {
            const latlng = markerRef.current.getLatLng();
            setFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }));
          });
        } else {
          markerRef.current.setLatLng(e.latlng);
        }
        setFormData(prev => ({ ...prev, latitude: e.latlng.lat, longitude: e.latlng.lng }));
      });
    };

    // Pequeño delay para asegurar que el modal y su DOM están listos
    const timer = setTimeout(initMap, 300);
    return () => clearTimeout(timer);
  }, []);

  // ----- Drag and Drop File Uploading Handlers -----
  const handleFileDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDropzone(true);
  };
  
  const handleFileDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDropzone(false);
  };
  
  const handleFileDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOverDropzone) setIsDragOverDropzone(true);
  };
  
  const handleFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverDropzone(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  if (!property) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white text-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">Editar Propiedad</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="edit-property-form" onSubmit={handleSave} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Columna Izquierda (Datos Principales) */}
              <div className="md:col-span-7 space-y-5">
                {/* Título */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Título de Publicación</label>
                  <input 
                    type="text" 
                    name="title" 
                    value={formData.title} 
                    onChange={handleChange}
                    required
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                  />
                </div>

                {/* Dirección y Mapa */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección / Ubicación (Calle y Ciudad)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        name="address" 
                        value={formData.address} 
                        onChange={handleChange}
                        placeholder="Ej: Av. San Martín 1234, Mendoza"
                        className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                      />
                      <button
                        type="button"
                        onClick={handleGeocode}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-sm transition border border-slate-300"
                      >
                        Buscar
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Ajuste Preciso en Mapa</span>
                      <span className="text-[9px] text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Haz clic o arrastra el pin</span>
                    </label>
                    <div className="w-full h-48 bg-slate-100 rounded-2xl border border-slate-300 overflow-hidden relative z-0">
                      <div id="edit-map-container" className="absolute inset-0 z-0"></div>
                    </div>
                  </div>
                </div>

                {/* Fila: Operación y Tipo */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operación</label>
                    <select 
                      name="operationType" 
                      value={formData.operationType} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    >
                      <option value="Venta">Venta</option>
                      <option value="Alquiler">Alquiler</option>
                      <option value="Alquiler Temporario">Alquiler Temporario</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo de Inmueble</label>
                    <select 
                      name="propertyType" 
                      value={formData.propertyType} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    >
                      <option value="Departamento">Departamento</option>
                      <option value="Casa">Casa</option>
                      <option value="Oficina">Oficina</option>
                      <option value="Local Comercial">Local Comercial</option>
                      <option value="Terreno">Terreno</option>
                    </select>
                  </div>
                </div>

                {/* Fila: Precio */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda</label>
                    <select 
                      name="currency" 
                      value={formData.currency} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                    >
                      <option value="USD">USD</option>
                      <option value="ARS">ARS</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Precio</label>
                    <input 
                      type="number" 
                      name="price" 
                      value={formData.price} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>

                {/* Fila: Características */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Ambientes</label>
                    <input 
                      type="number" 
                      name="rooms" 
                      value={formData.rooms} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Baños</label>
                    <input 
                      type="number" 
                      name="bathrooms" 
                      value={formData.bathrooms} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Superficie (m²)</label>
                    <input 
                      type="number" 
                      name="area" 
                      value={formData.area} 
                      onChange={handleChange}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Columna Derecha (Atributos Extra) */}
              <div className="md:col-span-5 space-y-5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                {/* Propiedad Destacada Toggle */}
                <div className="bg-white border border-yellow-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-2">
                    <Star className={`h-12 w-12 opacity-10 ${formData.featured ? 'fill-yellow-500 text-yellow-500' : 'text-slate-300'}`} />
                  </div>
                  <label className="flex items-center justify-between cursor-pointer relative z-10">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <Star className={`h-4 w-4 ${formData.featured ? 'fill-yellow-500 text-yellow-500' : 'text-slate-400'}`} />
                        Destacar Propiedad
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Aparecerá con un diseño premium y resaltado en el catálogo.</div>
                    </div>
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        name="featured" 
                        className="sr-only" 
                        checked={formData.featured}
                        onChange={handleChange}
                      />
                      <div className={`block w-10 h-6 rounded-full transition ${formData.featured ? 'bg-yellow-400' : 'bg-slate-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${formData.featured ? 'translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </div>

                {/* Estado */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado de Publicación</label>
                  <select 
                    name="status" 
                    value={formData.status} 
                    onChange={handleChange}
                    className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="pending">Pendiente de Revisión</option>
                    <option value="approved">Aprobado / Publicado</option>
                    <option value="rejected">Rechazado</option>
                    <option value="sold">Vendido / Alquilado</option>
                  </select>
                </div>

                {/* Recorrido Virtual */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                    URL Recorrido Virtual
                    {property.virtualTourRequested && !formData.virtualTourUrl && (
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">¡Solicitado!</span>
                    )}
                  </label>
                  <input 
                    type="url" 
                    name="virtualTourUrl" 
                    value={formData.virtualTourUrl} 
                    onChange={handleChange}
                    placeholder="YouTube, Matterport, etc."
                    className="w-full bg-indigo-50/50 text-slate-900 border border-indigo-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción Detallada</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                rows={4}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition resize-none"
              />
            </div>

            {/* Gestión de Imágenes (Drag and Drop) */}
            <div className="border-t border-slate-100 pt-6">
              <label className="block text-sm font-bold text-slate-800 tracking-wider mb-4 flex items-center justify-between">
                Imágenes de la Propiedad
                {uploadingImages && (
                  <span className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-full animate-pulse font-bold flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                    Subiendo fotos...
                  </span>
                )}
              </label>
              
              {/* Dropzone para Subir Nuevas */}
              <div 
                onDragEnter={handleFileDragEnter}
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
                className={`mb-5 border-2 border-dashed rounded-2xl p-6 text-center transition ${isDragOverDropzone ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
              >
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  id="images-upload-input"
                  onChange={handleImageUpload}
                  disabled={uploadingImages}
                  className="hidden" 
                />
                <div className="flex flex-col items-center justify-center pointer-events-none">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${isDragOverDropzone ? 'bg-brand-100 text-brand-500' : 'bg-white text-slate-400 shadow-sm'}`}>
                    <Upload className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-700 mb-1">Arrastra tus fotos aquí</h3>
                  <p className="text-xs text-slate-500 mb-4">o haz clic para explorar en tu equipo</p>
                  <label 
                    htmlFor="images-upload-input"
                    className={`cursor-pointer pointer-events-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-brand-600 font-bold py-2 px-5 rounded-xl text-xs shadow-sm transition ${uploadingImages ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    Seleccionar Archivos
                  </label>
                </div>
              </div>

              {/* Grilla de Miniaturas Ordenables */}
              {images.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-500 mb-2 uppercase font-bold tracking-wider">Orden Actual (Arrastra para organizar - La primera es la portada)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {images.map((url, idx) => (
                      <div 
                        key={url}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`relative aspect-video rounded-xl border-2 overflow-hidden bg-slate-100 group cursor-move transition-all ${draggedItemIndex === idx ? 'opacity-50 border-brand-500 scale-95' : 'border-transparent hover:border-slate-300'}`}
                      >
                        <img src={url} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover pointer-events-none" />
                        
                        {/* Drag Handle Indicator */}
                        <div className="absolute top-1.5 left-1.5 p-1 bg-black/40 text-white rounded-md opacity-0 group-hover:opacity-100 transition backdrop-blur-sm pointer-events-none">
                          <GripVertical className="h-3.5 w-3.5" />
                        </div>

                        {idx === 0 && (
                          <div className="absolute bottom-1.5 left-1.5 bg-brand-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-md pointer-events-none">
                            Portada
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageDelete(idx);
                          }}
                          className="absolute top-1.5 right-1.5 p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-full transition shadow-md backdrop-blur-sm"
                          title="Eliminar imagen"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="edit-property-form"
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-brand-500/20"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
