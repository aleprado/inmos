import React, { useState, useEffect, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, functions } from '../firebase';

const QUICK_REPLIES = [
  { label: '🏃 Ya bajo',            text: '🏃 Ya bajo' },
  { label: '🕐 En 5 minutos',        text: '🕐 En 5 minutos' },
  { label: '📦 Dejalo en el buzón',  text: '📦 Dejalo en el buzón' },
  { label: '🔒 No abrir',           text: '🔒 No abrir. Gracias.' },
  { label: '❌ No esperado',         text: '❌ No esperado. Por favor retirarse.' },
];

export default function IncomingRing({ session, door, onDismiss }) {
  const [phase,     setPhase]     = useState('ring');   // ring | call | replied
  const [sent,      setSent]      = useState('');
  const [custom,    setCustom]    = useState('');
  const [calling,   setCalling]   = useState(false);

  // WebRTC
  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const [muted,   setMuted]   = useState(false);
  const [camOff,  setCamOff]  = useState(false);

  // Ring sound
  useEffect(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let stop = false;
    const ring = async () => {
      for (let i = 0; i < 3 && !stop; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
        await new Promise(r => setTimeout(r, 600));
      }
    };
    ring();
    return () => { stop = true; ctx.close(); };
  }, []);

  // Listen for visitor ICE candidates when call is active
  useEffect(() => {
    if (phase !== 'call' || !pcRef.current) return;
    const unsub = onSnapshot(collection(db, 'sessions', session.sessionId, 'ice'), (snap) => {
      snap.docChanges().forEach(async (ch) => {
        if (ch.type === 'added' && ch.doc.data().from === 'visitor') {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(JSON.parse(ch.doc.data().candidate))); }
          catch (_) {}
        }
      });
    });
    return unsub;
  }, [phase, session.sessionId]);

  const sendReply = async (text) => {
    try {
      const fn = httpsCallable(functions, 'quickAction');
      await fn({ sessionId: session.sessionId, message: text });
      setSent(text);
      setPhase('replied');
    } catch (err) {
      alert('Error al enviar: ' + err.message);
    }
  };

  const startCall = async () => {
    setCalling(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      localStreamRef.current = stream;
      document.getElementById('local-vid').srcObject = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        document.getElementById('remote-vid').srcObject = e.streams[0];
      };
      pc.onicecandidate = async ({ candidate }) => {
        if (candidate) {
          await addDoc(collection(db, 'sessions', session.sessionId, 'ice'), {
            from: 'resident', candidate: JSON.stringify(candidate.toJSON()), createdAt: serverTimestamp(),
          });
        }
      };

      if (session.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(session.offer)));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateDoc(doc(db, 'sessions', session.sessionId), {
          answer: JSON.stringify(answer), status: 'answered',
        });
      } else {
        await updateDoc(doc(db, 'sessions', session.sessionId), { status: 'answered' });
      }
      setPhase('call');
    } catch (err) {
      alert('Error al conectar: ' + err.message);
    } finally {
      setCalling(false);
    }
  };

  const hangup = () => {
    pcRef.current?.close(); pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    updateDoc(doc(db, 'sessions', session.sessionId), { status: 'ended' }).catch(() => {});
    onDismiss();
  };

  const activateAI = async () => {
    await updateDoc(doc(db, 'sessions', session.sessionId), { status: 'ai_mode', aiActive: true });
    onDismiss();
  };

  const openDoor = async () => {
    if (!door?.webhookUrl) return;
    try { await fetch(door.webhookUrl, { method: 'POST', mode: 'no-cors' }); }
    catch (_) {}
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Timbre</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-100">{door?.label || 'Puerta Principal'}</h2>
          <p className="text-sm text-slate-400">Hay alguien esperando en la puerta</p>
        </div>

        {/* Visitor visual */}
        {phase !== 'call' && (
          <div className="relative rounded-2xl overflow-hidden bg-slate-800 border border-slate-700">
            {session.visitorPhoto
              ? <img src={session.visitorPhoto} alt="Visitante" className="w-full object-cover" style={{ aspectRatio: '4/3' }} />
              : <div className="w-full flex items-center justify-center text-6xl" style={{ aspectRatio: '4/3' }}>👤</div>
            }
            {session.clipUrl && (
              <div className="absolute bottom-2 right-2 bg-slate-900/80 text-sky-400 text-xs font-bold px-2 py-1 rounded-md backdrop-blur">
                🎥 Clip disponible
              </div>
            )}
          </div>
        )}

        {/* Call screen */}
        {phase === 'call' && (
          <div className="relative rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '3/4' }}>
            <video id="remote-vid" autoPlay playsInline className="w-full h-full object-cover" />
            <video id="local-vid"  autoPlay playsInline muted
              className="absolute bottom-2 right-2 w-20 h-28 object-cover rounded-lg border-2 border-sky-400" />
          </div>
        )}

        {/* Replied confirmation */}
        {phase === 'replied' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
            <p className="text-green-400 font-semibold">✓ Mensaje enviado</p>
            <p className="text-slate-300 text-sm mt-1">"{sent}"</p>
          </div>
        )}

        {/* Actions — ring phase */}
        {phase === 'ring' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_REPLIES.map(r => (
                <button key={r.text}
                  onClick={() => sendReply(r.text)}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 text-slate-100 rounded-xl px-3 py-3.5 text-sm font-medium text-left transition-all"
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={custom}
                onChange={e => setCustom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && custom.trim() && sendReply(custom.trim())}
                placeholder="Escribí un mensaje..."
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-sky-400"
              />
              <button
                onClick={() => custom.trim() && sendReply(custom.trim())}
                className="bg-sky-400 text-slate-900 font-bold rounded-xl px-3 py-2.5 text-base"
              >➤</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startCall}
                disabled={calling}
                className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm flex items-center justify-center gap-1.5"
              >
                {calling ? '...' : '📹 Videollamar'}
              </button>
              <button
                onClick={activateAI}
                className="bg-sky-400/10 hover:bg-sky-400/20 border border-sky-400/30 text-sky-400 font-semibold rounded-xl py-3 text-sm"
              >
                🤖 Modo IA
              </button>
            </div>

            {door?.webhookUrl && (
              <button onClick={openDoor}
                className="w-full bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 font-semibold rounded-xl py-3 text-sm"
              >
                🔓 Abrir puerta
              </button>
            )}

            <button onClick={onDismiss}
              className="w-full text-slate-500 hover:text-slate-400 text-sm py-2"
            >
              Ignorar
            </button>
          </div>
        )}

        {/* Actions — call phase */}
        {phase === 'call' && (
          <div className="space-y-3">
            <div className="flex justify-center gap-4">
              <button onClick={() => { setMuted(m => !m); localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); }}
                className="w-14 h-14 rounded-full bg-slate-700 text-2xl flex items-center justify-center">
                {muted ? '🔇' : '🎤'}
              </button>
              <button onClick={hangup}
                className="w-14 h-14 rounded-full bg-red-500 text-2xl flex items-center justify-center">
                📵
              </button>
              <button onClick={() => { setCamOff(c => !c); localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; }); }}
                className="w-14 h-14 rounded-full bg-slate-700 text-2xl flex items-center justify-center">
                {camOff ? '🚫' : '📷'}
              </button>
            </div>
            {door?.webhookUrl && (
              <button onClick={openDoor}
                className="w-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold rounded-xl py-2.5 text-sm"
              >🔓 Abrir puerta</button>
            )}
          </div>
        )}

        {/* Actions — replied phase */}
        {phase === 'replied' && (
          <div className="space-y-2">
            {door?.webhookUrl && (
              <button onClick={openDoor}
                className="w-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-semibold rounded-xl py-3 text-sm"
              >🔓 Abrir puerta de todas formas</button>
            )}
            <button onClick={onDismiss}
              className="w-full bg-slate-800 text-slate-300 font-medium rounded-xl py-3 text-sm"
            >Cerrar</button>
          </div>
        )}
      </div>
    </div>
  );
}
