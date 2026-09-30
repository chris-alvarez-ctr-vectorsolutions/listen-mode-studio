/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#EEF1F4',   // cool studio gray, not cream
        panel: '#FFFFFF',
        ink: '#1B2430',
        muted: '#5A6573',
        rule: '#D5DBE2',
        onair: '#C9780A',   // the one accent: render / on-air
        dana: '#1F7A74',
        ray: '#3D4E9C',
        other: '#7A4E8C',
      },
      fontFamily: {
        ui: ['Figtree', 'system-ui', 'sans-serif'],
        script: ['Literata', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
