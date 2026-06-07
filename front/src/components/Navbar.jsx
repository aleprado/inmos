import React from 'react';

export default function Navbar({ tenantData, children }) {
  const name = tenantData?.name || 'INMOS';
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="bg-white border-b border-slate-100 shrink-0 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          {tenantData?.logoUrl ? (
            <img src={tenantData.logoUrl} alt={name} className="h-9 w-auto max-w-[120px] object-contain" />
          ) : (
            <>
              <div 
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: tenantData?.primaryColor || '#0b57d0' }}
              >
                {initial}
              </div>
              <div>
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest block -mb-0.5">Catálogo</span>
                <span className="font-extrabold text-slate-800 text-base">{name.toUpperCase()}</span>
              </div>
            </>
          )}
        </a>
        
        {/* Acciones del lado derecho (alternadores de vista, etc.) */}
        {children && (
          <div className="flex items-center gap-3">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
