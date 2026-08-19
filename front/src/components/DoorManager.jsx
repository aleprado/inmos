import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

export default function DoorManager({ units, doors, onBack }) {
  const [view,      setView]      = useState('list');  // list | addDoor | addPhone | qr
  const [selected,  setSelected]  = useState(null);    // door for QR view
  const [unitSel,   setUnitSel]   = useState(units[0]?.unitId || '');
  const [doorLabel, setDoorLabel] = useState('');
  const [phone,     setPhone]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState('');

  const adminFn = httpsCallable(functions, 'adminConfig');

  const createDoor = async () => {
    if (!doorLabel.trim()) return;
    setLoading(true); setMsg('');
    try {
      const res = await adminFn({ action: 'createDoor', payload: { unitId: unitSel, label: doorLabel.trim() } });
      setMsg('✅ Puerta creada. Ahora podés ver el QR.');
      setDoorLabel('');
      setView('list');
    } catch (e) { setMsg('❌ ' + e.message); }
    setLoading(false);
  };

  const addPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true); setMsg('');
    try {
      await adminFn({ action: 'addWhatsappPhone', payload: { unitId: unitSel, phone: phone.trim() } });
      setMsg('✅ Número agregado.');
      setPhone('');
    } catch (e) { setMsg('❌ ' + e.message); }
    setLoading(false);
  };

  const deleteDoor = async (doorId) => {
    if (!confirm('¿Eliminar esta puerta? Los QRs dejarán de funcionar.')) return;
    setLoading(true);
    try {
      await adminFn({ action: 'deleteDoor', payload: { doorId } });
    } catch (e) { alert(e.message); }
    setLoading(false);
  };

  const toggleAbsence = async (unitId, current) => {
    try { await adminFn({ action: 'setAbsenceMode', payload: { unitId, enabled: !current } }); }
    catch (e) { alert(e.message); }
  };

  const appDomain = import.meta.env.VITE_APP_DOMAIN || 'https://timbre-qr-visitor.web.app';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-6 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100 text-xl">←</button>
        <h1 className="text-xl font-bold">Puertas y configuración</h1>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg}
        </div>
      )}

      {/* QR Modal */}
      {view === 'qr' && selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-6 gap-6">
          <h2 className="text-xl font-bold">{selected.label}</h2>
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG
              value={`${appDomain}/v/${selected.doorId}`}
              size={240}
              level="H"
            />
          </div>
          <p className="text-slate-400 text-sm text-center">
            Imprimí este QR y colocalo en la puerta.<br />
            <span className="text-sky-400 break-all">{appDomain}/v/{selected.doorId}</span>
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => navigator.share?.({ url: `${appDomain}/v/${selected.doorId}`, title: selected.label }).catch(() => {})}
              className="flex-1 bg-sky-400 text-slate-900 font-semibold rounded-xl py-3 text-sm"
            >📤 Compartir link</button>
            <button onClick={() => setView('list')}
              className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-3 text-sm"
            >Cerrar</button>
          </div>
        </div>
      )}

      {/* Unit selector */}
      {units.length > 1 && (
        <div className="mb-4">
          <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Unidad</label>
          <select
            value={unitSel}
            onChange={e => setUnitSel(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
          >
            {units.map(u => <option key={u.unitId} value={u.unitId}>{u.name}</option>)}
          </select>
        </div>
      )}

      {/* Absence mode per unit */}
      {units.map(u => (
        <div key={u.unitId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-100">{u.name}</p>
            <p className="text-xs text-slate-400">{u.address}</p>
          </div>
          <button
            onClick={() => toggleAbsence(u.unitId, u.absenceMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${u.absenceMode ? 'bg-sky-400' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.absenceMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-xs text-slate-400 ml-2">{u.absenceMode ? 'IA activa' : 'Normal'}</span>
        </div>
      ))}

      {/* Doors list */}
      <div className="space-y-3 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Puertas registradas</h2>
        {doors.filter(d => d.unitId === unitSel).length === 0 && (
          <p className="text-slate-500 text-sm">Todavía no hay puertas. Agregá una abajo.</p>
        )}
        {doors.filter(d => d.unitId === unitSel).map(door => (
          <div key={door.doorId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-100">{door.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono break-all">{door.doorId}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${door.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                {door.status === 'active' ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setSelected(door); setView('qr'); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl py-2 text-sm font-medium"
              >Ver QR</button>
              <button
                onClick={() => deleteDoor(door.doorId)}
                disabled={loading}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl px-4 py-2 text-sm"
              >Eliminar</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add door */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-4 space-y-3">
        <h3 className="font-semibold text-slate-100 text-sm">➕ Agregar puerta</h3>
        <input
          value={doorLabel}
          onChange={e => setDoorLabel(e.target.value)}
          placeholder="Nombre (ej: Puerta Principal, Portón Cochera)"
          className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
        />
        <button
          onClick={createDoor}
          disabled={loading || !doorLabel.trim()}
          className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-2.5 text-sm"
        >
          {loading ? 'Creando...' : 'Crear puerta'}
        </button>
      </div>

      {/* WhatsApp phones */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 text-sm">📱 Números WhatsApp para notificaciones</h3>
        {units.find(u => u.unitId === unitSel)?.whatsappPhones?.map(p => (
          <div key={p} className="flex items-center justify-between text-sm">
            <span className="text-slate-300 font-mono">+{p}</span>
            <button
              onClick={async () => {
                try { await adminFn({ action: 'removeWhatsappPhone', payload: { unitId: unitSel, phone: p } }); }
                catch (e) { alert(e.message); }
              }}
              className="text-red-400 hover:text-red-300 text-xs"
            >Quitar</button>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Ej: 1112345678"
            className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400"
          />
          <button
            onClick={addPhone}
            disabled={loading || !phone.trim()}
            className="bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl px-4 py-2 text-sm"
          >Agregar</button>
        </div>
        <p className="text-xs text-slate-500">Número argentino sin el +54 ni el 0. Ej: 1112345678</p>
      </div>
    </div>
  );
}
