import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';

// Estilos diseñados para una hoja A4 a 96DPI (794px x 1123px)
export default function PropertyFlyer({ property, tenantId }) {
  if (!property) return null;

  // URL pública de la propiedad (asume que la app está en la raíz)
  const publicUrl = `${window.location.origin}/?p=${property.id}`;
  const price = property.price ? `${property.currency || 'USD'} ${property.price.toLocaleString()}` : 'Consultar Precio';

  return (
    <div className="absolute top-[-9999px] left-[-9999px]">
      <div 
        id={`flyer-${property.id}`} 
        className="bg-white font-sans text-slate-900 flex flex-col relative overflow-hidden"
        style={{ width: '794px', height: '1123px', padding: '0' }}
      >
        {/* Cabecera / Marca */}
        <div className="bg-slate-900 text-white px-10 py-6 flex justify-between items-center z-10 shrink-0">
          <div className="font-black text-2xl tracking-tighter uppercase">{tenantId}</div>
          <div className="text-brand-400 font-bold tracking-widest text-sm uppercase">Folleto de Propiedad</div>
        </div>

        {/* Imagen Principal (Ocupa la mitad superior) */}
        <div className="relative h-[480px] w-full bg-slate-100 shrink-0">
          {property.images && property.images.length > 0 ? (
            <img 
              src={property.images[0]} 
              alt="Property" 
              className="w-full h-full object-cover"
              crossOrigin="anonymous" // Importante para html2canvas
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 text-xl font-bold">
              Sin imagen disponible
            </div>
          )}
          
          {/* Badge de Operación */}
          <div className="absolute bottom-6 left-10 flex gap-3">
            <span className="bg-brand-600 text-white px-5 py-2 rounded-full font-bold uppercase text-sm tracking-wider shadow-xl">
              {property.operationType || 'Venta'}
            </span>
            <span className="bg-white text-slate-900 px-5 py-2 rounded-full font-bold uppercase text-sm tracking-wider shadow-xl">
              {property.propertyType || 'Inmueble'}
            </span>
          </div>
        </div>

        {/* Contenido (Mitad Inferior) */}
        <div className="flex-1 px-10 py-10 flex flex-col justify-between">
          
          {/* Título y Precio */}
          <div>
            <h1 className="text-4xl font-black leading-tight text-slate-900 mb-2">{property.title}</h1>
            {property.address && (
              <div className="flex items-center gap-2 text-slate-500 text-lg mb-6">
                <MapPin className="h-5 w-5" />
                <span>{property.address}</span>
              </div>
            )}
            
            <div className="text-5xl font-black text-brand-500 mb-10">
              {price}
            </div>

            {/* Atributos */}
            <div className="flex gap-6 mb-10 border-y border-slate-200 py-6">
              <div className="flex items-center gap-3 w-1/3">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                  <BedDouble className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase">Dormitorios</div>
                  <div className="text-xl font-black text-slate-900">{property.rooms || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-1/3">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                  <Bath className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase">Baños</div>
                  <div className="text-xl font-black text-slate-900">{property.bathrooms || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-1/3">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                  <Ruler className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase">Superficie</div>
                  <div className="text-xl font-black text-slate-900">{property.area ? `${property.area} m²` : '-'}</div>
                </div>
              </div>
            </div>

            {/* Descripción (Trunca si es muy larga para el A4) */}
            <div className="text-slate-600 text-lg leading-relaxed line-clamp-5">
              {property.description}
            </div>
          </div>

          {/* Footer del Flyer: Código QR y Contacto */}
          <div className="mt-8 bg-slate-50 border border-slate-200 p-6 rounded-3xl flex items-center gap-8 shrink-0">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
              <QRCodeSVG value={publicUrl} size={120} level="H" includeMargin={false} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Escanea para ver más</h3>
              <p className="text-slate-500 text-lg leading-snug">
                Usa la cámara de tu celular para escanear el código QR y ver todas las fotos, el recorrido virtual y contactar a la inmobiliaria directamente.
              </p>
              <div className="mt-4 font-mono text-xs text-slate-400">Ref: {property.id}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
