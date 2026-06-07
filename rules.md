# Reglas de Desarrollo del Proyecto (Inmos)

## 1. Modularidad Estricta
- **Funciones de propósito único:** Cada función debe hacer una sola cosa y hacerla bien (Single Responsibility Principle).
- **Componentes aislados:** En React, los componentes deben ser pequeños y reutilizables. Si un componente supera las 150-200 líneas, es un buen indicador de que debe dividirse en sub-componentes.
- **Lógica separada de la vista:** Extraer la lógica compleja a Hooks personalizados (`useAlgo.js`) o funciones utilitarias en carpetas dedicadas (ej. `utils/` o `services/`).

## 2. Archivos Cortos y Específicos
- **Archivos pequeños:** Evitar los archivos "monolíticos" que contienen múltiples clases, componentes o cientos de líneas de código.
- **Un componente por archivo:** Cada archivo `.jsx` o `.js` debe exportar por defecto un único componente o módulo principal.
- **Nombrado claro:** El nombre del archivo debe reflejar exactamente su contenido (ej. `PropertyCard.jsx`, `formatCurrency.js`).

## 3. Reutilización
- **No te repitas (DRY):** Si el mismo bloque de código o componente visual se usa en dos o más lugares, debe extraerse a un módulo o componente compartido.

## 4. Legibilidad
- **Código auto-explicativo:** Priorizar nombres de variables y funciones descriptivos sobre comentarios extensos. El código debe leerse como un lenguaje natural en la medida de lo posible.
