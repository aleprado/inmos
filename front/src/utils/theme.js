// Conversión de Hexadecimal a RGB
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Conversión de RGB a Hexadecimal
function rgbToHex(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Ajuste del brillo de un color hex (positivo para aclarar, negativo para oscurecer)
function adjustBrightness(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.min(255, Math.max(0, rgb.r + Math.round(255 * percent)));
  const g = Math.min(255, Math.max(0, rgb.g + Math.round(255 * percent)));
  const b = Math.min(255, Math.max(0, rgb.b + Math.round(255 * percent)));
  
  return rgbToHex(r, g, b);
}

/**
 * Calcula y aplica las variables CSS de color de marca al elemento raíz del documento.
 * @param {string} primaryColorHex Color base en formato #hex
 */
export function applyTheme(primaryColorHex) {
  if (!primaryColorHex) return;
  
  // Generar la escala cromática para Tailwind
  const shades = {
    50: adjustBrightness(primaryColorHex, 0.9),
    100: adjustBrightness(primaryColorHex, 0.8),
    200: adjustBrightness(primaryColorHex, 0.6),
    500: primaryColorHex,
    600: adjustBrightness(primaryColorHex, -0.15),
    700: adjustBrightness(primaryColorHex, -0.25),
    800: adjustBrightness(primaryColorHex, -0.35),
    900: adjustBrightness(primaryColorHex, -0.45),
  };
  
  // Escribir las variables en el :root
  Object.entries(shades).forEach(([shade, value]) => {
    document.documentElement.style.setProperty(`--brand-${shade}`, value);
  });
}
