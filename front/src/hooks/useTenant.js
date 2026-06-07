import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useTenant(tenantId) {
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        const docRef = doc(db, 'tenants', tenantId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setTenantData({ id: docSnap.id, ...docSnap.data() });
        } else {
          // Fallback genérico si no existe
          console.warn(`Tenant no encontrado: ${tenantId}. Usando fallback.`);
          setTenantData({
            id: tenantId,
            name: tenantId.toUpperCase(),
            whatsappNumber: '5491100000000',
            primaryColor: '#0b57d0',
            logoUrl: null
          });
        }
      } catch (error) {
        console.error("Error al cargar tenant:", error);
        setTenantData({
          id: tenantId,
          name: tenantId.toUpperCase(),
          whatsappNumber: '5491100000000',
          primaryColor: '#0b57d0',
          logoUrl: null
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTenant();
  }, [tenantId]);

  return { tenantData, loading };
}
