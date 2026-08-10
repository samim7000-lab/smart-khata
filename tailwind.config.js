/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        khata: {
          blue: '#2563eb',
          'blue-dark': '#1d4ed8',
          red: '#dc2626',
          'red-light': '#fef2f2',
          green: '#16a34a',
          'green-light': '#f0fdf4',
          yellow: '#d97706',
          'yellow-light': '#fffbeb',
          bg: '#f8fafc'
        }
      }
    },
  },
  plugins: [],
}
