import type { Config } from 'tailwindcss'


const config: Config = {
  darkMode: 'class', // <--- IF THIS IS MISSING, THE TOGGLE WILL NEVER WORK
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1d4ed8',
        'primary-dark': '#1e3a8a',
        'primary-light': '#3b82f6',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(90deg, rgba(37,99,235,.12), rgba(14,165,233,.08))',
        'gradient-kpi': 'linear-gradient(180deg, #1e3a8a 0%, #1d4ed8 100%)',
      },
    },
  },
  plugins: [],
}

export default config
