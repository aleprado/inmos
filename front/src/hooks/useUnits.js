import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Returns all units where the current user is a member,
 * plus their associated doors.
 */
export function useUnits(uid) {
  const [units,   setUnits]   = useState([]);
  const [doors,   setDoors]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const q = query(collection(db, 'units'), where('memberUids', 'array-contains', uid));
    const unsub = onSnapshot(q, (snap) => {
      const u = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUnits(u);
      setLoading(false);
    });

    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!units.length) { setDoors([]); return; }
    const unitIds = units.map(u => u.unitId || u.id);
    const q = query(collection(db, 'doors'), where('unitId', 'in', unitIds));
    const unsub = onSnapshot(q, (snap) => {
      setDoors(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.status !== 'deleted'));
    });
    return unsub;
  }, [units]);

  return { units, doors, loading };
}
