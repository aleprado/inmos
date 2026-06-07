import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Cartel de Vía Pública (Alto Contraste)
export default function SignageFlyer({ property, tenantId }) {
  if (!property) return null;

  const publicUrl = `${window.location.origin}/?p=${property.id}`;
  const isSale = property.operationType?.toLowerCase().includes('venta');
  
  // Colores de ultra alto contraste
  const bgColor = isSale ? 'bg-blue-600' : 'bg-emerald-600';

  return (
    <div className="absolute top-[-9999px] left-[-9999px]">
      <div 
        id={`signage-${property.id}`} 
        className="bg-white font-sans text-slate-900 flex flex-col items-center justify-center relative overflow-hidden text-center"
        style={{ width: '794px', height: '1123px', padding: '40px' }}
      >
        <div className="border-8 border-slate-900 rounded-[3rem] w-full h-full flex flex-col items-center justify-center p-12">
          
          <h1 className="text-5xl font-black uppercase tracking-widest text-slate-900 mb-16">
            ESCANEAR
          </h1>
          
          <div className="bg-white p-8 rounded-[2.5rem] shadow-none border-0">
            <QRCodeSVG value={publicUrl} size={550} level="H" includeMargin={false} />
          </div>

          <div className="mt-16 text-3xl font-bold text-slate-500 uppercase tracking-widest">
            {tenantId}
          </div>
          
          <div className="mt-4 font-mono text-xl text-slate-400">
            Ref: {property.id}
          </div>

        </div>
      </div>
    </div>
  );
}
