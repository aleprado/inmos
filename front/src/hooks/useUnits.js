import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useUnits(uid) {
  const [units,     setUnits]     = useState([]);
  const [doors,     setDoors]     = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [loading,   setLoading]   = useState(true);

  // Units where user is a member (direct residents)
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'units'), where('memberUids', 'array-contains', uid));
    const unsub = onSnapshot(q, (snap) => {
      setUnits(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  // Doors for those units
  useEffect(() => {
    if (!units.length) { setDoors([]); return; }
    const unitIds = units.map(u => u.unitId || u.id);
    const q = query(collection(db, 'doors'), where('unitId', 'in', unitIds));
    const unsub = onSnapshot(q, (snap) => {
      setDoors(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.status !== 'deleted'));
    });
    return unsub;
  }, [units]);

  // Buildings where user is admin
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'buildings'), where('adminUid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      setBuildings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [uid]);

  return { units, doors, buildings, loading };
}
