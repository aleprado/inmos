import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BedDouble, Bath, Ruler, MapPin } from 'lucide-react';

// Estilos diseñados para una hoja A4 a 96DPI (794px x 1123px) o Cuadrado para Redes (1080x1080)
export default function PropertyFlyer({ property, tenantId, type = 'pdf' }) {
  if (!property) return null;

  const isSocial = type === 'social';
  const width = isSocial ? '1080px' : '794px';
  const height = isSocial ? '1080px' : '1123px';
  const elementId = isSocial ? `social-${property.id}` : `flyer-${property.id}`;

  // URL pública de la propiedad (asume que la app está en la raíz)
  const publicUrl = `${window.location.origin}/?p=${property.id}`;
  const price = property.price ? `${property.currency || 'USD'} ${property.price.toLocaleString()}` : 'Consultar Precio';

  // Lógica de Collage Dinámico (Máximo 3 imágenes)
  const renderImages = () => {
    const imgs = property.images || [];
    if (imgs.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center text-slate-300 text-xl font-bold bg-slate-100">
          Sin imagen disponible
        </div>
      );
    }

    if (!isSocial || imgs.length === 1) {
      return (
        <div 
          className="w-full h-full" 
          style={{ backgroundImage: `url(${imgs[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
        />
      );
    }

    if (imgs.length === 2) {
      return (
        <div className="flex w-full h-full bg-white">
          <div 
            className="w-[70%] h-full border-r-[8px] border-white" 
            style={{ backgroundImage: `url(${imgs[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
          />
          <div 
            className="w-[30%] h-full" 
            style={{ backgroundImage: `url(${imgs[1]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
          />
        </div>
      );
    }

    // 3 o más imágenes (tomamos solo las primeras 3)
    return (
      <div className="flex w-full h-full bg-white">
        <div 
          className="w-[70%] h-full border-r-[8px] border-white" 
          style={{ backgroundImage: `url(${imgs[0]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
        />
        <div className="w-[30%] h-full flex flex-col">
          <div 
            className="h-1/2 w-full border-b-[8px] border-white" 
            style={{ backgroundImage: `url(${imgs[1]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
          />
          <div 
            className="h-1/2 w-full" 
            style={{ backgroundImage: `url(${imgs[2]})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
          />
        </div>
      </div>
    );
  };

  return (
    <div className="absolute top-[-9999px] left-[-9999px]">
      <div 
        id={elementId} 
        className="bg-white font-sans text-slate-900 flex flex-col relative overflow-hidden"
        style={{ width, height, padding: '0' }}
      >
        {/* Cabecera / Marca */}
        <div className={`bg-slate-900 text-white flex justify-between items-center z-10 shrink-0 ${isSocial ? 'px-12 py-8' : 'px-10 py-6'}`}>
          <div className={`font-black tracking-tighter uppercase ${isSocial ? 'text-4xl' : 'text-2xl'}`}>{tenantId}</div>
          <div className={`text-brand-400 font-bold tracking-widest uppercase ${isSocial ? 'text-lg' : 'text-sm'}`}>
            {isSocial ? 'Nueva Propiedad' : 'Folleto de Propiedad'}
          </div>
        </div>

        {/* Imagen Principal o Collage Dinámico */}
        <div className={`relative w-full bg-slate-100 shrink-0 ${isSocial ? 'h-[500px]' : 'h-[480px]'}`}>
          {renderImages()}
          
          {/* Badge de Operación */}
          <div className={`absolute left-10 flex gap-3 ${isSocial ? 'bottom-8' : 'bottom-6'}`}>
            <div 
              className={`bg-brand-600 text-white font-bold uppercase tracking-wider shadow-xl text-center ${isSocial ? 'px-8 pt-3 pb-2 rounded-full text-lg' : 'px-5 pt-2 pb-1.5 rounded-full text-sm'}`}
            >
              {property.operationType || 'Venta'}
            </div>
            <div 
              className={`bg-white text-slate-900 font-bold uppercase tracking-wider shadow-xl text-center ${isSocial ? 'px-8 pt-3 pb-2 rounded-full text-lg' : 'px-5 pt-2 pb-1.5 rounded-full text-sm'}`}
            >
              {property.propertyType || 'Inmueble'}
            </div>
          </div>
        </div>

        {/* Contenido (Mitad Inferior) */}
        <div className={`flex-1 flex flex-col ${isSocial ? 'justify-center px-14 py-8' : 'justify-between px-10 py-10'}`}>
          
          {/* Título y Precio */}
          <div>
            <h1 className={`font-black leading-tight text-slate-900 ${isSocial ? 'text-5xl mb-4' : 'text-4xl mb-2'}`}>
              {property.title}
            </h1>
            {property.address && (
              <div className={`flex items-center gap-2 text-slate-500 ${isSocial ? 'text-2xl mb-8' : 'text-lg mb-6'}`}>
                <MapPin className={isSocial ? 'h-7 w-7' : 'h-5 w-5'} />
                <span>{property.address}</span>
              </div>
            )}
            
            <div className={`font-black text-brand-500 ${isSocial ? 'text-6xl mb-12' : 'text-5xl mb-10'}`}>
              {price}
            </div>

            {/* Atributos */}
            <div className={`flex border-y border-slate-200 ${isSocial ? 'gap-8 mb-4 py-10' : 'gap-6 mb-10 py-6'}`}>
              <div className="flex items-center gap-4 w-1/3">
                <div className={`bg-slate-100 rounded-full flex items-center justify-center text-slate-600 ${isSocial ? 'h-20 w-20' : 'h-12 w-12'}`}>
                  <BedDouble className={isSocial ? 'h-10 w-10' : 'h-6 w-6'} />
                </div>
                <div>
                  <div className={`text-slate-500 font-bold uppercase ${isSocial ? 'text-xl' : 'text-xs'}`}>Dormitorios</div>
                  <div className={`font-black text-slate-900 ${isSocial ? 'text-4xl' : 'text-xl'}`}>{property.rooms || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 w-1/3">
                <div className={`bg-slate-100 rounded-full flex items-center justify-center text-slate-600 ${isSocial ? 'h-20 w-20' : 'h-12 w-12'}`}>
                  <Bath className={isSocial ? 'h-10 w-10' : 'h-6 w-6'} />
                </div>
                <div>
                  <div className={`text-slate-500 font-bold uppercase ${isSocial ? 'text-xl' : 'text-xs'}`}>Baños</div>
                  <div className={`font-black text-slate-900 ${isSocial ? 'text-4xl' : 'text-xl'}`}>{property.bathrooms || '-'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 w-1/3">
                <div className={`bg-slate-100 rounded-full flex items-center justify-center text-slate-600 ${isSocial ? 'h-20 w-20' : 'h-12 w-12'}`}>
                  <Ruler className={isSocial ? 'h-10 w-10' : 'h-6 w-6'} />
                </div>
                <div>
                  <div className={`text-slate-500 font-bold uppercase ${isSocial ? 'text-xl' : 'text-xs'}`}>Superficie</div>
                  <div className={`font-black text-slate-900 ${isSocial ? 'text-4xl' : 'text-xl'}`}>{property.area ? `${property.area} m²` : '-'}</div>
                </div>
              </div>
            </div>

            {/* Descripción (Oculta en formato redes para dejar espacio y limpieza visual) */}
            {!isSocial && (
              <div className="text-slate-600 text-lg leading-relaxed line-clamp-5">
                {property.description}
              </div>
            )}
          </div>

          {/* Footer del Flyer: Código QR y Contacto (Oculto en redes) */}
          {!isSocial && (
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
          )}

        </div>
      </div>
    </div>
  );
}
