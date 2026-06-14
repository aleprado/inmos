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
      // Evitar lectura a Firestore si es el entorno de demo (ahorra costos y elimina el warning)
      if (tenantId === 'demo') {
        setTenantData({
          id: 'demo',
          name: 'Inmos Demo',
          whatsappNumber: '5492364459744',
          primaryColor: '#0b57d0',
          logoUrl: null,
          catalogLayout: 'mixed'
        });
        setLoading(false);
        return;
      }

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
            whatsappNumber: '5492364459744',
            primaryColor: '#0b57d0',
            logoUrl: null
          });
        }
      } catch (error) {
        console.error("Error al cargar tenant:", error);
        setTenantData({
          id: tenantId,
          name: tenantId.toUpperCase(),
          whatsappNumber: '5492364459744',
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
