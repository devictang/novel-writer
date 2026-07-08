/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1a2e',
          light: '#16213e',
          muted: '#4a5568',
        },
        quill: {
          DEFAULT: '#c9a96e',
          light: '#e8d5b0',
          dark: '#a68a4e',
        },
        parchment: {
          DEFAULT: '#faf8f5',
          dark: '#f0ebe0',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
