/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f6ff',
          100: '#e0edff',
          200: '#c2dbff',
          500: '#0b57d0', // Azul premium moderno (Inmos brand)
          600: '#0848b2',
          700: '#063993',
          800: '#052b74',
          900: '#031c55',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
