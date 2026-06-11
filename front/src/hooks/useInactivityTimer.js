import { useEffect, useRef } from 'react';

/**
 * Hook personalizado para detectar inactividad del usuario.
 * @param {Object} options
 * @param {boolean} options.isEnabled - Si está en false, el timer no se activa.
 * @param {number} options.timeoutMs - Tiempo en milisegundos para considerar inactividad (por defecto 15 mins).
 * @param {Function} options.onIdle - Callback que se ejecuta al expirar el tiempo.
 */
export function useInactivityTimer({ isEnabled = true, timeoutMs = 15 * 60 * 1000, onIdle }) {
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!isEnabled) return;

    const handleActivity = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        if (onIdle) onIdle();
      }, timeoutMs);
    };

    // Configurar timer inicial
    handleActivity();

    // Eventos que reinician el timer
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    // Throttling para no saturar el CPU con eventos rápidos como mousemove
    let throttleTimeout = null;
    const throttledHandler = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          handleActivity();
          throttleTimeout = null;
        }, 1000); // 1 segundo de throttle
      }
    };

    // Adjuntar listeners
    events.forEach(event => window.addEventListener(event, throttledHandler, { passive: true }));

    // Cleanup
    return () => {
      events.forEach(event => window.removeEventListener(event, throttledHandler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isEnabled, timeoutMs, onIdle]);
}
