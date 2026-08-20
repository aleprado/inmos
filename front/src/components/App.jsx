import React, { useState, useEffect } from 'react';
import { signOut }           from 'firebase/auth';
import { httpsCallable }     from 'firebase/functions';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { auth, db, functions } from '../firebase';
import { useUnits }          from '../hooks/useUnits';
import IncomingRing          from './IncomingRing';
import DoorManager           from './DoorManager';

export default function App({ user }) {
  const { units, doors, buildings, loading } = useUnits(user.uid);
  const [view,          setView]          = useState('dashboard'); // dashboard | doors
  const [activeSession, setActiveSession] = useState(null);
  const [activeSessionDoor, setActiveSessionDoor] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);

  // ── Listen for incoming rings on all user units ───────────────────────────
  useEffect(() => {
    if (!units.length) return;
    const unitIds = units.map(u => u.unitId || u.id);
    const q = query(
      collection(db, 'sessions'),
      where('unitId', 'in', unitIds),
      where('status', '==', 'ringing'),
      orderBy('createdAt', 'desc'),
      limit(1),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const s = snap.docs[0].data();
        const door = doors.find(d => d.doorId === s.doorId) || null;
        setActiveSession(s);
        setActiveSessionDoor(door);
      }
    });
    return unsub;
  }, [units, doors]);

  // ── Recent session history ────────────────────────────────────────────────
  useEffect(() => {
    if (!units.length) return;
    const unitIds = units.map(u => u.unitId || u.id);
    const q = query(
      collection(db, 'sessions'),
      where('unitId', 'in', unitIds),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [units]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
    </div>
  );

  if (!units.length && !buildings.length) return <SetupPrompt user={user} />;

  if (view === 'doors') return (
    <DoorManager units={units} doors={doors} buildings={buildings} onBack={() => setView('dashboard')} />
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Incoming ring overlay */}
      {activeSession && (
        <IncomingRing
          session={activeSession}
          door={activeSessionDoor}
          onDismiss={() => setActiveSession(null)}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div>
          <span className="text-xl font-extrabold text-sky-400">timbre</span>
          <span className="text-xl font-extrabold text-slate-100">QR</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden sm:block">{user.email}</span>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3 py-1.5 rounded-lg"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* Unit summary cards */}
        <div className="space-y-3">
          {units.map(unit => {
            const unitDoors = doors.filter(d => d.unitId === (unit.unitId || unit.id));
            return (
              <div key={unit.unitId || unit.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-slate-100">{unit.name}</h2>
                    {unit.address && <p className="text-xs text-slate-400">{unit.address}</p>}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${unit.absenceMode ? 'bg-sky-400/10 text-sky-400' : 'bg-green-500/10 text-green-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${unit.absenceMode ? 'bg-sky-400' : 'bg-green-400'}`} />
                    {unit.absenceMode ? 'IA activa' : 'En casa'}
                  </div>
                </div>

                {/* Doors */}
                <div className="flex gap-2 flex-wrap">
                  {unitDoors.map(door => (
                    <div key={door.doorId}
                      className="flex items-center gap-1.5 bg-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                    >
                      🚪 {door.label}
                    </div>
                  ))}
                  {unitDoors.length === 0 && (
                    <span className="text-xs text-slate-500">Sin puertas configuradas</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick action */}
        <button
          onClick={() => setView('doors')}
          className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed rounded-2xl py-4 text-sm text-slate-400 flex items-center justify-center gap-2 transition-colors"
        >
          ⚙️ Configurar puertas y notificaciones
        </button>

        {/* Recent activity */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Actividad reciente</h3>
          {recentSessions.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-8">
              Todavía no hubo timbrazos. Cuando alguien toque la puerta aparecerá acá.
            </p>
          )}
          <div className="space-y-2">
            {recentSessions.map(s => {
              const door = doors.find(d => d.doorId === s.doorId);
              return (
                <div key={s.sessionId || s.id}
                  className="bg-slate-800 border border-slate-700/50 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  {/* Status icon */}
                  <span className="text-xl">
                    {s.status === 'answered'  ? '📹' :
                     s.status === 'replied'   ? '💬' :
                     s.status === 'ai_mode'   ? '🤖' :
                     s.status === 'missed'    ? '⚠️'  :
                     s.status === 'ended'     ? '✅'  : '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {door?.label || 'Puerta'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTime(s.createdAt)} · {statusLabel(s.status)}
                    </p>
                  </div>
                  {s.clipUrl && (
                    <a href={s.clipUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sky-400 text-xs font-semibold shrink-0"
                    >
                      🎥 Ver clip
                    </a>
                  )}
                  {s.visitorPhoto && !s.clipUrl && (
                    <img src={s.visitorPhoto} alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-slate-600 shrink-0"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function SetupPrompt({ user }) {
  const [mode,    setMode]    = useState('choose');  // choose | create | join
  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');

  const adminFn = httpsCallable(functions, 'adminConfig');

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await adminFn({ action: 'createUnit', payload: { name: name.trim(), address: address.trim() } });
      setMsg('✅ Unidad creada. Recargá la página.');
    } catch (e) { setMsg('❌ ' + e.message); }
    setLoading(false);
  };

  const join = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await adminFn({ action: 'claimUnit', payload: { inviteCode: code.trim() } });
      setMsg(`✅ Te uniste a ${res.data.unitName}. Recargá la página.`);
    } catch (e) { setMsg('❌ ' + e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <span className="text-4xl font-extrabold text-sky-400">timbre</span>
          <span className="text-4xl font-extrabold text-slate-100">QR</span>
          <p className="mt-2 text-sm text-slate-400">Bienvenido. ¿Cómo querés empezar?</p>
        </div>

        {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{msg}</p>}

        {mode === 'choose' && (
          <div className="space-y-3">
            <button onClick={() => setMode('create')}
              className="w-full bg-sky-400 hover:bg-sky-300 text-slate-900 font-semibold rounded-xl py-4 text-sm flex flex-col items-center gap-1">
              <span className="text-base">🏠 Configurar mi timbre</span>
              <span className="font-normal text-xs opacity-70">Soy el dueño o inquilino, quiero recibir timbrazos</span>
            </button>
            <button onClick={() => setMode('join')}
              className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold rounded-xl py-4 text-sm flex flex-col items-center gap-1">
              <span className="text-base">🔑 Unirme con código</span>
              <span className="font-normal text-xs text-slate-400">Tengo un código de invitación de mi edificio</span>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <button onClick={() => setMode('choose')} className="text-xs text-slate-400 hover:text-slate-200">← Volver</button>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre (ej: Dpto 4B, Casa)"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-400"
            />
            <input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Dirección (opcional)"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-400"
            />
            <button onClick={create} disabled={loading || !name.trim()}
              className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-3 text-sm">
              {loading ? 'Creando...' : 'Crear mi unidad'}
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/50 space-y-4">
            <button onClick={() => setMode('choose')} className="text-xs text-slate-400 hover:text-slate-200">← Volver</button>
            <p className="text-sm text-slate-400">Ingresá el código que te envió el administrador de tu edificio.</p>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: A1B2C3D4"
              maxLength={8}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-sky-400"
            />
            <button onClick={join} disabled={loading || code.length < 6}
              className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-3 text-sm">
              {loading ? 'Verificando...' : 'Unirme'}
            </button>
          </div>
        )}

        <button onClick={() => signOut(auth)} className="text-xs text-slate-500 w-full text-center">Salir</button>
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60000) return 'hace un momento';
  if (diffMs < 3600000) return `hace ${Math.floor(diffMs / 60000)} min`;
  if (diffMs < 86400000) return `hace ${Math.floor(diffMs / 3600000)} h`;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(s) {
  const m = {
    ringing:  'Timbrando',
    answered: 'Llamada atendida',
    replied:  'Respondido',
    ai_mode:  'Atendido por IA',
    missed:   'Sin respuesta',
    ended:    'Finalizado',
  };
  return m[s] || s;
}
