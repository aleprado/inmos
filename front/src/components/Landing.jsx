import React from 'react';
import { MessageSquare, Sparkles, Globe, QrCode, Eye, ArrowRight, LogIn, Network } from 'lucide-react';

export default function Landing({ setRoute }) {
  const handleGoToLogin = () => {
    setRoute((prev) => ({ ...prev, view: 'login', propertyId: null }));
  };

  const handleGoToDemo = () => {
    setRoute((prev) => ({ ...prev, view: 'marketplace', propertyId: null, tenantId: 'demo' }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans relative overflow-hidden flex flex-col justify-between selection:bg-brand-500 selection:text-white">

      {/* Decorative background blobs */}
      <div className="absolute top-0 left-1/4 h-[500px] w-[500px] bg-brand-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] bg-emerald-950/10 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER */}
      <header className="border-b border-slate-900/80 sticky top-0 bg-slate-950/80 backdrop-blur-md z-40 shrink-0">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Inmos Logo" className="h-9 w-9 rounded-xl object-cover shadow-lg shadow-brand-500/10" />
            <div>
              <span className="text-[10px] text-brand-400 font-bold uppercase tracking-widest block -mb-0.5">Plataforma</span>
              <span className="font-extrabold text-white text-base tracking-tight">INMOS</span>
            </div>
          </div>

          <button
            onClick={handleGoToLogin}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 transition btn-premium shadow-sm"
          >
            <LogIn className="h-4 w-4" />
            Acceso Operadores
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 md:py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">

        {/* Left column (CTA / Pitch) */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-950/40 border border-brand-900/40 text-brand-400 text-xs font-bold font-mono tracking-wider">
            <Sparkles className="h-4.5 w-4.5 text-brand-400 animate-pulse" />
            SaaS Inmobiliario Inteligente
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Gestiona tu inmobiliaria <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-brand-500 to-emerald-400">
              desde WhatsApp con IA
            </span>
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
            Sube propiedades enviando audios, fotos y videos por WhatsApp. Nuestra Inteligencia Artificial procesa la información y publica tu catálogo premium de marca blanca al instante. Sin fricciones, sin cargar planillas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
            <button
              onClick={handleGoToLogin}
              className="w-full sm:w-auto bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition btn-premium shadow-lg shadow-brand-500/20 text-sm"
            >
              Comenzar / Ingresar
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={handleGoToDemo}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-2 transition btn-premium text-sm"
            >
              Ver demo del catálogo
            </button>
          </div>
        </div>

        {/* Right column (Visual Mock-up) */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[420px] dark-glassmorphism rounded-3xl p-5 shadow-2xl relative overflow-hidden">

            {/* Mock Header */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-4 mb-4">
              <div className="h-8.5 w-8.5 bg-emerald-600 rounded-full flex items-center justify-center text-white font-black text-xs">
                WA
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">WhatsApp Inmos Bot</h4>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                  En línea
                </span>
              </div>
            </div>

            {/* Mock Chat Bubbles */}
            <div className="space-y-4">
              {/* User Voice Message */}
              <div className="flex justify-end">
                <div className="bg-emerald-950/60 border border-emerald-900/50 text-slate-100 rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-xs shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-500 text-slate-950 p-1 rounded-full cursor-pointer">
                      ▶
                    </span>
                    <div className="flex-1">
                      <div className="h-1 bg-slate-700 w-32 rounded-full overflow-hidden relative">
                        <div className="h-full bg-emerald-400 w-3/4" />
                      </div>
                      <span className="text-[8px] text-emerald-400 mt-1 block">Audio · 0:24</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] italic text-slate-300 leading-normal">
                    "Hola, quiero subir un departamento de 2 ambientes en Palermo con cochera por USD 150.000. Tiene 50m² y balcón al frente..."
                  </p>
                </div>
              </div>

              {/* Bot Processing */}
              <div className="flex justify-start">
                <div className="bg-slate-900/90 border border-slate-800 text-slate-300 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-xs shadow-sm flex items-start gap-2.5">
                  <Sparkles className="h-4.5 w-4.5 text-brand-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[9px] text-brand-400 font-bold block mb-1">PROCESANDO CON IA</span>
                    <p className="text-[10px] leading-relaxed text-slate-200">
                      Entendido. He extraído los siguientes datos para Palermo:
                    </p>
                    <ul className="mt-2 space-y-1 text-[9px] text-slate-400 font-mono">
                      <li>• Operación: Venta</li>
                      <li>• Precio: USD 150,000</li>
                      <li>• Ambientes: 2 (50m²)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Bot Success Card */}
              <div className="flex justify-start">
                <div className="bg-slate-900/90 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none p-3.5 max-w-[85%] text-xs shadow-md">
                  <div className="h-24 bg-slate-950 rounded-xl overflow-hidden mb-2 relative">
                    <div className="absolute top-2 left-2 bg-blue-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Venta
                    </div>
                    {/* CSS abstract representation of property image */}
                    <div className="w-full h-full bg-gradient-to-br from-brand-900/40 to-slate-900 flex items-center justify-center">
                      <Globe className="h-8 w-8 text-brand-500/50" />
                    </div>
                  </div>
                  <h5 className="font-extrabold text-[10.5px] text-slate-100 truncate">Depto 2 ambientes en Palermo</h5>
                  <span className="text-[9.5px] text-brand-400 font-bold block mt-1">USD 150,000</span>
                  <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex justify-between items-center text-[9px] text-slate-400">
                    <span>✨ Publicado en borrador</span>
                    <span className="text-brand-400 font-bold flex items-center gap-0.5">
                      Ver panel →
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </main>

      {/* FEATURE GRID */}
      <section className="bg-slate-900/30 border-t border-b border-slate-900 py-16 md:py-24 relative z-10 shrink-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Diseñado para simplificar tu operación diaria
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-3 leading-relaxed">
              Eliminamos la carga burocrática y creamos herramientas premium de venta para tus agentes inmobiliarios.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            {/* Feature 1 */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl hover:border-brand-500/30 transition duration-300">
              <div className="h-10 w-10 bg-brand-950/60 rounded-xl flex items-center justify-center border border-brand-900/40 mb-4">
                <MessageSquare className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Carga por WhatsApp</h3>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                Envía un texto o audio describiendo la propiedad, adjunta fotos y deja que nuestra IA procese los datos automáticamente.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl hover:border-brand-500/30 transition duration-300">
              <div className="h-10 w-10 bg-brand-950/60 rounded-xl flex items-center justify-center border border-brand-900/40 mb-4">
                <Globe className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Catálogo Premium</h3>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                Sitio web optimizado para móviles con filtros, mapas interactivos. Configurable con tu logo, nombre y colores de tu marca.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl hover:border-brand-500/30 transition duration-300">
              <div className="h-10 w-10 bg-brand-950/60 rounded-xl flex items-center justify-center border border-brand-900/40 mb-4">
                <QrCode className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Flyers y Carteles QR</h3>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                Genera folletos PDF en formato A4 comercial y código QR para carteleria con un solo clic.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl hover:border-brand-500/30 transition duration-300">
              <div className="h-10 w-10 bg-brand-950/60 rounded-xl flex items-center justify-center border border-brand-900/40 mb-4">
                <Network className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Dominio Propio</h3>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                Te entregamos tu propio dominio http://tuinmobiliaria.inmos.app.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl hover:border-brand-500/30 transition duration-300">
              <div className="h-10 w-10 bg-brand-950/60 rounded-xl flex items-center justify-center border border-brand-900/40 mb-4">
                <Eye className="h-5 w-5 text-brand-400" />
              </div>
              <h3 className="font-bold text-sm text-slate-200">Métricas de Rendimiento</h3>
              <p className="text-slate-400 text-xs mt-2.5 leading-relaxed">
                Monitorea el total de vistas y consultas de cada propiedad desde tu panel de administración para medir el ROI real de tu catálogo.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-500 shrink-0">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Inmos. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <span className="cursor-pointer hover:text-slate-350 transition">Términos de servicio</span>
            <span className="cursor-pointer hover:text-slate-350 transition">Privacidad</span>
            <span className="cursor-pointer hover:text-slate-350 transition" onClick={handleGoToLogin}>Panel</span>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href="https://wa.me/5492364459744?text=Hola%20Inmos%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20la%20plataforma"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform duration-300 flex items-center justify-center group"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
        </svg>
        <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          ¿Dudas? Escríbenos
        </span>
      </a>
    </div>
  );
}
