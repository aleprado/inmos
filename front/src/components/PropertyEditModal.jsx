import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { X, Save, AlertCircle } from 'lucide-react';

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
    address: property?.address || ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const docRef = doc(db, 'properties', property.id);
      
      let latitude = property.latitude || null;
      let longitude = property.longitude || null;

      // Si la dirección cambió, intentamos geocodificarla en el cliente
      if (formData.address !== property.address) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.address + ', Argentina')}&format=json&limit=1`);
          const data = await response.json();
          if (data && data.length > 0) {
            latitude = parseFloat(data[0].lat);
            longitude = parseFloat(data[0].lon);
          } else {
            latitude = null;
            longitude = null;
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
        longitude: longitude
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

  if (!property) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        
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

          <form id="edit-property-form" onSubmit={handleSave} className="space-y-5">
            {/* Título */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Título de Publicación</label>
              <input 
                type="text" 
                name="title" 
                value={formData.title} 
                onChange={handleChange}
                required
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección / Ubicación</label>
              <input 
                type="text" 
                name="address" 
                value={formData.address} 
                onChange={handleChange}
                placeholder="ej: Av. Cabildo 1500, Belgrano, CABA"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
              />
            </div>

            {/* Fila: Operación y Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Operación</label>
                <select 
                  name="operationType" 
                  value={formData.operationType} 
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
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
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Baños</label>
                <input 
                  type="number" 
                  name="bathrooms" 
                  value={formData.bathrooms} 
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Superficie (m²)</label>
                <input 
                  type="number" 
                  name="area" 
                  value={formData.area} 
                  onChange={handleChange}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Estado de Publicación</label>
              <select 
                name="status" 
                value={formData.status} 
                onChange={handleChange}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 bg-white"
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
                URL del Recorrido Virtual (YouTube/Matterport)
                {property.virtualTourRequested && !formData.virtualTourUrl && (
                  <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">¡Solicitado por el operador!</span>
                )}
              </label>
              <input 
                type="url" 
                name="virtualTourUrl" 
                value={formData.virtualTourUrl} 
                onChange={handleChange}
                placeholder="ej: https://www.youtube.com/watch?v=..."
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition bg-indigo-50/30"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción Detallada</label>
              <textarea 
                name="description" 
                value={formData.description} 
                onChange={handleChange}
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500 transition resize-none"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 shrink-0 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            form="edit-property-form"
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition disabled:opacity-50"
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
