import React, { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { X, MessageSquare, Send, Loader2, Image as ImageIcon } from 'lucide-react';
import { storage } from '../firebase';
import { useToast } from '../contexts/ToastContext';

export default function AIChatAssistant({ isDemo, tenantId, sessionId }) {
  const toast = useToast();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState(
    isDemo ? 'Vendo departamento 3 ambientes con cochera en Palermo, 82m2, al frente por USD 150.000' : ''
  );
  const [isBotTyping, setIsBotTyping] = useState(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Mensaje inicial del bot
  useEffect(() => {
    if (chatMessages.length === 0) {
      if (isDemo) {
        setChatMessages([{
          id: 'welcome',
          sender: 'bot',
          text: `🤖 *¡Hola!* Bienvenido al demostrador interactivo de Inmos.
          
Aquí puedes probar cómo funciona nuestro cargador de propiedades por IA (WhatsApp style).

*Intenta escribiéndome una descripción de una propiedad en lenguaje natural*, por ejemplo:
_"Vendo departamento de 3 ambientes con 2 baños y cochera en Palermo, 82 m2, por USD 170.000."_

¡Yo procesaré el texto, y la propiedad aparecerá mágicamente en el mapa y el catálogo detrás de mí!`,
          createdAt: null
        }]);
      } else {
        setChatMessages([{
          id: 'welcome',
          sender: 'bot',
          text: `🤖 *¡Hola!* Soy tu Asistente de carga de Inmos.
          
Dime los detalles de la propiedad que deseas cargar, o envíame una imagen.`,
          createdAt: null
        }]);
      }
    }
  }, [isDemo, chatMessages.length]);

  // Scroll automático
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isBotTyping, isChatOpen]);

  const callCloudFunction = async (payload) => {
    const functions = getFunctions();
    const functionName = isDemo ? 'processDemoMessage' : 'processOperatorMessage';
    const processMessageFn = httpsCallable(functions, functionName);
    
    // Inyectar sessionId si es demo, el endpoint de operador lo toma del Auth token.
    if (isDemo) {
      payload.sessionId = sessionId;
    }
    
    return processMessageFn(payload);
  };

  const handleSendChatMessage = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim() && !isBotTyping) return;

    const messageText = chatInput.trim();
    setChatInput('');
    setIsBotTyping(true);
    
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: messageText,
      sender: 'user',
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    }]);

    try {
      const response = await callCloudFunction({ messageText });
      
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
      console.error("Error al procesar mensaje:", error);
      setChatMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        text: `❌ Error de IA: ${error.message || 'Error desconocido'}.`,
        sender: 'bot',
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resetear el input
    e.target.value = '';
    
    setIsBotTyping(true);
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      text: `📷 [Subiendo imagen: ${file.name}...]`,
      sender: 'user',
      createdAt: { seconds: Math.floor(Date.now() / 1000) }
    }]);

    try {
      let imageUrl = null;

      if (isDemo && !file.type.startsWith('image/')) {
         // Fallback a Unsplash en demo puro si falla algo (o para facilitar la demo)
         // Pero ahora el usuario sube una imagen local, la subiremos a Storage igual
      }

      // Subir archivo a Firebase Storage
      const extension = file.name.split('.').pop();
      const storagePath = `chat_uploads/${tenantId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
      const fileRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(fileRef, file);
      imageUrl = await getDownloadURL(snapshot.ref);

      // Enviar la URL a la Cloud Function
      const response = await callCloudFunction({ imageUrl, messageText: '' });

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
      console.error("Error al subir imagen:", error);
      toast?.error("Error al subir la imagen");
      setChatMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        text: `❌ Error al subir imagen: ${error.message}`,
        sender: 'bot',
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      }]);
    } finally {
      setIsBotTyping(false);
    }
  };

  const formatMessageText = (text) => {
    if (!text) return '';
    let formatted = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
      
    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    return <span dangerouslySetInnerHTML={{ __html: formatted.replace(/\n/g, '<br/>') }} />;
  };

  return (
    <>
      {/* Botón flotante */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center">
        {!isChatOpen && (
          <>
            <div className={`absolute inset-0 rounded-full animate-ping opacity-30 duration-700 ${isDemo ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
            <div className={`absolute -inset-2 sm:-inset-3 rounded-full border-2 animate-pulse opacity-50 ${isDemo ? 'border-emerald-400' : 'border-indigo-400'}`}></div>
          </>
        )}
        
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`relative z-50 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 cursor-pointer group ${
            isChatOpen 
              ? 'bg-slate-800 text-white hover:bg-slate-700 hover:rotate-90' 
              : `bg-gradient-to-tr ${isDemo ? 'from-emerald-500 to-teal-400 border-emerald-300/30' : 'from-indigo-600 to-blue-500 border-indigo-400/30'} text-white hover:scale-110 shadow-lg`
          }`}
        >
          {isChatOpen ? (
            <X className="h-6 w-6 sm:h-7 sm:w-7" />
          ) : (
            <div className="relative">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 group-hover:scale-110 transition-transform duration-200" />
              <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 flex h-3 w-3 sm:h-4 sm:w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 sm:h-4 sm:w-4 bg-red-500 border-2 border-white shadow-lg shadow-red-500/50"></span>
              </span>
            </div>
          )}
        </button>
      </div>
      
      {/* Tooltip flotante (solo en desktop) */}
      {!isChatOpen && (
        <div className={`hidden sm:flex fixed bottom-9 right-[7.5rem] bg-gradient-to-r from-slate-900 to-slate-800 text-white text-xs font-black py-2.5 px-4 rounded-2xl shadow-xl z-40 animate-bounce items-center gap-2 border ${isDemo ? 'border-emerald-500/30' : 'border-indigo-500/30'}`}>
          <span className="relative flex h-2.5 w-2.5">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDemo ? 'bg-emerald-400' : 'bg-indigo-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isDemo ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(79,70,229,0.8)]'}`}></span>
          </span>
          {isDemo ? '¡PRUEBA EL BOT DE WHATSAPP!' : '¡ASISTENTE DE CARGA DISPONIBLE!'}
          <div className={`absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-3 bg-slate-800 rotate-45 border-t border-r z-[-1] ${isDemo ? 'border-emerald-500/30' : 'border-indigo-500/30'}`}></div>
        </div>
      )}

      {/* Panel del Chat */}
      {isChatOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[380px] sm:h-[550px] w-full h-full bg-[#efeae2] sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className={`${isDemo ? 'bg-[#075e54]' : 'bg-indigo-600'} text-white p-4 flex items-center justify-between shrink-0 shadow-md`}>
            <div className="flex items-center gap-3">
              <div className={`relative w-10 h-10 ${isDemo ? 'bg-emerald-600' : 'bg-indigo-500'} rounded-full flex items-center justify-center font-bold text-sm border border-white/20`}>
                🤖
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-transparent rounded-full"></span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-sm tracking-wide">Asistente de carga</span>
                <span className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  En línea
                </span>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="p-1 rounded-full hover:bg-black/10 transition">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Historial */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
            {chatMessages.map((msg, idx) => (
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
                  {msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            
            {isBotTyping && (
              <div className="self-start bg-white text-slate-800 rounded-2xl rounded-tl-none p-3 max-w-[85%] shadow-sm text-sm border border-slate-100 flex items-center gap-1.5 animate-pulse">
                <span className="text-xs text-slate-400">El asistente está procesando...</span>
                <div className="flex gap-1 items-center h-4">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          
          {/* Input Area */}
          <form onSubmit={handleSendChatMessage} className="p-3 bg-[#f0f0f0] flex items-center gap-2 border-t border-slate-200 shrink-0">
            {/* Input File Oculto */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImageUpload} 
            />
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Subir foto"
              disabled={isBotTyping}
              className="w-10 h-10 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-600 rounded-full flex items-center justify-center shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Escribe aquí tu solicitud..."
              disabled={isBotTyping}
              className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400"
            />

            <button
              type="submit"
              disabled={!chatInput.trim() || isBotTyping}
              className={`w-10 h-10 ${isDemo ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} active:scale-95 text-white rounded-full flex items-center justify-center shadow-md transition disabled:bg-slate-300 disabled:scale-100 disabled:cursor-not-allowed shrink-0 cursor-pointer`}
            >
              {isBotTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
