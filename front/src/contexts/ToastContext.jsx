import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = (message, duration) => addToast(message, 'success', duration);
  const error = (message, duration) => addToast(message, 'error', duration);
  const info = (message, duration) => addToast(message, 'info', duration);

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      {/* Contenedor de Toasts (Z-index altísimo para superponerse a los modales) */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div 
      className={`
        pointer-events-auto flex items-start gap-3 p-4 rounded-2xl shadow-xl border w-80
        animate-in slide-in-from-right-8 fade-in duration-300
        ${isError ? 'bg-red-50/95 border-red-200 text-red-800' : 
          isSuccess ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' : 
          'bg-slate-800/95 border-slate-700 text-white backdrop-blur-md'}
      `}
    >
      <div className="shrink-0 mt-0.5">
        {isError && <AlertCircle className="h-5 w-5 text-red-500" />}
        {isSuccess && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
        {!isError && !isSuccess && <Info className="h-5 w-5 text-brand-400" />}
      </div>
      <div className="flex-1 text-sm font-medium leading-tight">
        {toast.message}
      </div>
      <button 
        onClick={onRemove}
        className={`shrink-0 p-1 rounded-full transition-colors ${
          isError ? 'hover:bg-red-100 text-red-400' : 
          isSuccess ? 'hover:bg-emerald-100 text-emerald-400' : 
          'hover:bg-slate-700 text-slate-400'
        }`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser usado dentro de un ToastProvider');
  }
  return context;
};
