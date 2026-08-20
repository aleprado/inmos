import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { functions, db } from '../firebase';
import { QRCodeSVG } from 'qrcode.react';

export default function DoorManager({ units, doors, buildings, onBack }) {
  const [tab,        setTab]        = useState(units.length ? 'units' : (buildings.length ? 'buildings' : 'units'));
  const [view,       setView]       = useState('list');
  const [selected,   setSelected]   = useState(null);
  const [unitSel,    setUnitSel]    = useState(units[0]?.unitId || '');
  const [doorLabel,  setDoorLabel]  = useState('');
  const [phone,      setPhone]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [msg,        setMsg]        = useState('');

  // Building state
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0] || null);
  const [buildingUnits,    setBuildingUnits]    = useState([]);
  const [buildingDoors,    setBuildingDoors]    = useState([]);
  const [buildingName,     setBuildingName]     = useState('');
  const [buildingAddress,  setBuildingAddress]  = useState('');
  const [newUnitName,      setNewUnitName]      = useState('');
  const [newBldDoorLabel,  setNewBldDoorLabel]  = useState('');

  const adminFn     = httpsCallable(functions, 'adminConfig');
  const appDomain   = import.meta.env.VITE_APP_DOMAIN || 'https://timbre-qr-visitor.web.app';

  // Load units + doors for selected building
  useEffect(() => {
    if (!selectedBuilding) return;
    const bid = selectedBuilding.buildingId || selectedBuilding.id;
    const uQ = query(collection(db, 'units'), where('buildingId', '==', bid));
    const dQ = query(collection(db, 'doors'), where('buildingId', '==', bid));
    const u$ = onSnapshot(uQ, s => setBuildingUnits(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const d$ = onSnapshot(dQ, s => setBuildingDoors(s.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.status !== 'deleted')));
    return () => { u$(); d$(); };
  }, [selectedBuilding]);

  const call = async (action, payload, cb) => {
    setLoading(true); setMsg('');
    try { const r = await adminFn({ action, payload }); cb?.(r.data); }
    catch (e) { setMsg('❌ ' + e.message); }
    setLoading(false);
  };

  const createDoor = () => {
    if (!doorLabel.trim()) return;
    call('createDoor', { unitId: unitSel, label: doorLabel.trim() }, () => {
      setMsg('✅ Puerta creada.'); setDoorLabel('');
    });
  };

  const addPhone = () => {
    if (!phone.trim()) return;
    call('addWhatsappPhone', { unitId: unitSel, phone: phone.trim() }, () => {
      setMsg('✅ Numero agregado.'); setPhone('');
    });
  };

  const deleteDoor = (doorId) => {
    if (!confirm('Eliminar esta puerta? Los QRs dejaran de funcionar.')) return;
    call('deleteDoor', { doorId }, () => setMsg('✅ Puerta eliminada.'));
  };

  const toggleAbsence = (unitId, current) =>
    call('setAbsenceMode', { unitId, enabled: !current }, () => {});

  const createBuilding = () => {
    if (!buildingName.trim()) return;
    call('createBuilding', { name: buildingName.trim(), address: buildingAddress.trim() }, (data) => {
      setMsg('✅ Edificio creado.'); setBuildingName(''); setBuildingAddress('');
    });
  };

  const createBuildingUnit = () => {
    if (!newUnitName.trim() || !selectedBuilding) return;
    const bid = selectedBuilding.buildingId || selectedBuilding.id;
    call('createBuildingUnit', { buildingId: bid, name: newUnitName.trim() }, (data) => {
      setMsg(`✅ Departamento creado. Codigo de invitacion: ${data.inviteCode}`);
      setNewUnitName('');
    });
  };

  const createBuildingDoor = () => {
    if (!selectedBuilding) return;
    const bid = selectedBuilding.buildingId || selectedBuilding.id;
    const label = newBldDoorLabel.trim() || 'Entrada Principal';
    call('createBuildingDoor', { buildingId: bid, label }, () => {
      setMsg('✅ QR de entrada creado.'); setNewBldDoorLabel('');
    });
  };

  const shareInvite = (inviteCode) => {
    const url = `${appDomain}?join=${inviteCode}`;
    if (navigator.share) {
      navigator.share({ title: 'Timbre QR — Invitacion', text: `Tu codigo de acceso: ${inviteCode}`, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(inviteCode).then(() => setMsg('✅ Codigo copiado: ' + inviteCode));
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-6 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-100 text-xl">←</button>
        <h1 className="text-xl font-bold">Puertas y configuracion</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 mb-5">
        <button
          onClick={() => setTab('units')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'units' ? 'bg-sky-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
        >Mis puertas</button>
        <button
          onClick={() => setTab('buildings')}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === 'buildings' ? 'bg-sky-400 text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
        >Edificios</button>
      </div>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${msg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {msg}
        </div>
      )}

      {/* QR modal (shared between tabs) */}
      {view === 'qr' && selected && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-6 gap-6">
          <h2 className="text-xl font-bold">{selected.label}</h2>
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG value={`${appDomain}/v/${selected.doorId}`} size={240} level="H" />
          </div>
          <p className="text-slate-400 text-sm text-center">
            Imprimilo y colocalos en la puerta.<br />
            <span className="text-sky-400 break-all text-xs">{appDomain}/v/{selected.doorId}</span>
          </p>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => navigator.share?.({ url: `${appDomain}/v/${selected.doorId}`, title: selected.label }).catch(() => {})}
              className="flex-1 bg-sky-400 text-slate-900 font-semibold rounded-xl py-3 text-sm"
            >Compartir link</button>
            <button onClick={() => setView('list')} className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-3 text-sm">Cerrar</button>
          </div>
        </div>
      )}

      {/* ── TAB: Mis puertas ─────────────────────────────────────────────── */}
      {tab === 'units' && (
        <div className="space-y-4">
          {units.length > 1 && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Unidad</label>
              <select value={unitSel} onChange={e => setUnitSel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
              >
                {units.map(u => <option key={u.unitId} value={u.unitId}>{u.name}</option>)}
              </select>
            </div>
          )}

          {/* Absence toggle per unit */}
          {units.map(u => (
            <div key={u.unitId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-100">{u.name}</p>
                <p className="text-xs text-slate-400">{u.address}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{u.absenceMode ? 'IA activa' : 'Normal'}</span>
                <button onClick={() => toggleAbsence(u.unitId, u.absenceMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${u.absenceMode ? 'bg-sky-400' : 'bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${u.absenceMode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          ))}

          {/* Doors list */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Puertas registradas</h2>
            {doors.filter(d => d.unitId === unitSel).length === 0 && (
              <p className="text-slate-500 text-sm">Todavia no hay puertas.</p>
            )}
            {doors.filter(d => d.unitId === unitSel).map(door => (
              <div key={door.doorId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <p className="font-semibold text-slate-100">{door.label}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${door.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {door.status === 'active' ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setSelected(door); setView('qr'); }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl py-2 text-sm font-medium">Ver QR</button>
                  <button onClick={() => deleteDoor(door.doorId)} disabled={loading}
                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl px-4 py-2 text-sm">Eliminar</button>
                </div>
              </div>
            ))}
          </div>

          {/* Add door */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-100 text-sm">Agregar puerta</h3>
            <input value={doorLabel} onChange={e => setDoorLabel(e.target.value)}
              placeholder="Nombre (ej: Puerta Principal, Porton Cochera)"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
            />
            <button onClick={createDoor} disabled={loading || !doorLabel.trim()}
              className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
              {loading ? 'Creando...' : 'Crear puerta'}
            </button>
          </div>

          {/* WhatsApp phones */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-100 text-sm">Numeros WhatsApp</h3>
            {units.find(u => u.unitId === unitSel)?.whatsappPhones?.map(p => (
              <div key={p} className="flex items-center justify-between text-sm">
                <span className="text-slate-300 font-mono">+{p}</span>
                <button onClick={() => call('removeWhatsappPhone', { unitId: unitSel, phone: p }, () => {})}
                  className="text-red-400 hover:text-red-300 text-xs">Quitar</button>
              </div>
            ))}
            <div className="flex gap-2">
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="Ej: 1112345678"
                className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400"
              />
              <button onClick={addPhone} disabled={loading || !phone.trim()}
                className="bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl px-4 py-2 text-sm">Agregar</button>
            </div>
            <p className="text-xs text-slate-500">Numero argentino sin el +54 ni el 0. Ej: 1112345678</p>
          </div>
        </div>
      )}

      {/* ── TAB: Edificios ───────────────────────────────────────────────── */}
      {tab === 'buildings' && (
        <div className="space-y-4">

          {/* Building selector */}
          {buildings.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wide mb-1 block">Edificio</label>
              <select
                value={selectedBuilding?.buildingId || selectedBuilding?.id || ''}
                onChange={e => setSelectedBuilding(buildings.find(b => (b.buildingId || b.id) === e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
              >
                {buildings.map(b => <option key={b.buildingId || b.id} value={b.buildingId || b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {/* Building entrance QR */}
          {selectedBuilding && (
            <>
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">QR de entrada del edificio</h2>
                {buildingDoors.length === 0 && (
                  <p className="text-slate-500 text-sm">No hay QR de entrada todavia.</p>
                )}
                {buildingDoors.map(door => (
                  <div key={door.doorId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-slate-100">{door.label}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Activo</span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => { setSelected(door); setView('qr'); }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-xl py-2 text-sm font-medium">Ver QR</button>
                      <button onClick={() => deleteDoor(door.doorId)} disabled={loading}
                        className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl px-4 py-2 text-sm">Eliminar</button>
                    </div>
                  </div>
                ))}
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                  <input value={newBldDoorLabel} onChange={e => setNewBldDoorLabel(e.target.value)}
                    placeholder="Nombre de la entrada (ej: Puerta Principal)"
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
                  />
                  <button onClick={createBuildingDoor} disabled={loading}
                    className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
                    Crear QR de entrada
                  </button>
                </div>
              </div>

              {/* Building units */}
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Departamentos</h2>
                {buildingUnits.length === 0 && (
                  <p className="text-slate-500 text-sm">No hay departamentos todavia.</p>
                )}
                {buildingUnits.map(unit => (
                  <div key={unit.unitId} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-slate-100">{unit.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {unit.memberUids?.length
                            ? `${unit.memberUids.length} residente(s)`
                            : 'Sin reclamar'}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${unit.memberUids?.length ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                        {unit.memberUids?.length ? 'Activo' : 'Pendiente'}
                      </span>
                    </div>
                    {unit.inviteCode && !unit.memberUids?.length && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex-1 bg-slate-900 text-sky-400 font-mono text-sm px-3 py-2 rounded-lg border border-slate-700 text-center tracking-widest">
                          {unit.inviteCode}
                        </span>
                        <button onClick={() => shareInvite(unit.inviteCode)}
                          className="bg-sky-400 text-slate-900 font-semibold rounded-lg px-3 py-2 text-sm">
                          Compartir
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
                  <h3 className="font-semibold text-slate-100 text-sm">Agregar departamento</h3>
                  <input value={newUnitName} onChange={e => setNewUnitName(e.target.value)}
                    placeholder="Ej: Dpto 3B, Piso 4 Of. 2"
                    className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
                  />
                  <button onClick={createBuildingUnit} disabled={loading || !newUnitName.trim()}
                    className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
                    {loading ? 'Creando...' : 'Crear departamento'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Create new building */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
            <h3 className="font-semibold text-slate-100 text-sm">
              {buildings.length ? 'Crear otro edificio' : 'Crear edificio'}
            </h3>
            <input value={buildingName} onChange={e => setBuildingName(e.target.value)}
              placeholder="Nombre del edificio"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
            />
            <input value={buildingAddress} onChange={e => setBuildingAddress(e.target.value)}
              placeholder="Direccion (opcional)"
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
            />
            <button onClick={createBuilding} disabled={loading || !buildingName.trim()}
              className="w-full bg-sky-400 hover:bg-sky-300 disabled:opacity-50 text-slate-900 font-semibold rounded-xl py-2.5 text-sm">
              {loading ? 'Creando...' : 'Crear edificio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
