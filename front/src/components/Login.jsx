import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { auth } from '../firebase';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Sesión iniciada correctamente:", userCredential.user.uid);
      if (onLoginSuccess) onLoginSuccess(userCredential.user);
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      // Mapear errores de Firebase a mensajes legibles en español
      switch (err.code) {
        case 'auth/invalid-email':
          setError('El formato del correo electrónico no es válido.');
          break;
        case 'auth/user-disabled':
          setError('Esta cuenta de operador ha sido deshabilitada.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Correo electrónico o contraseña incorrectos.');
          break;
        default:
          setError('Ocurrió un error inesperado. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      
      {/* Círculos decorativos de fondo con gradientes premium */}
      <div className="absolute top-1/4 left-1/4 h-[350px] w-[350px] bg-brand-900/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] bg-emerald-900/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Tarjeta de Login */}
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800/80 rounded-3xl p-8 md:p-10 shadow-2xl backdrop-blur-md relative z-10">
        
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mx-auto mb-4 shadow-lg shadow-brand-500/20">
            I
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Acceso Operadores
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Ingresa tus credenciales para gestionar el catálogo y las publicaciones de la inmobiliaria.
          </p>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3 text-red-400 text-xs mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
              <input
                type="email"
                placeholder="ejemplo@inmos.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 h-4.5 w-4.5" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition"
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition btn-premium shadow-lg shadow-brand-500/15 disabled:opacity-50 mt-6"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Iniciar Sesión
                <ArrowRight className="h-4.5 w-4.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Footer / Back link */}
      <div className="mt-8 text-center relative z-10">
        <a 
          href="/" 
          className="text-xs text-slate-500 hover:text-slate-400 font-semibold flex items-center gap-1.5 transition"
        >
          Volver al catálogo público
        </a>
      </div>
    </div>
  );
}
