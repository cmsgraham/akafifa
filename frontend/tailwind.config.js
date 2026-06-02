/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        xs: "320px",
      },
      animation: {
        ticker: "ticker 40s linear infinite",
        "rz-kick": "rz-kick 0.8s ease-in infinite",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "rz-kick": {
          "0%": { transform: "scale(1.3)", opacity: "1" },
          "80%": { transform: "scale(0.5)", opacity: "0.4" },
          "100%": { transform: "scale(1.3)", opacity: "1" },
        },
      },
      colors: {
        rz: {
          red: "#E11D2E",
          "red-hover": "#BE123C",
          "red-dark": "#7F1D1D",
          bg: "var(--rz-bg)",
          surface: "var(--rz-surface)",
          "surface-2": "var(--rz-surface-2)",
          text: "var(--rz-text)",
          "text-secondary": "var(--rz-text-secondary)",
          "text-muted": "var(--rz-text-muted)",
          border: "var(--rz-border)",
          "border-strong": "var(--rz-border-strong)",
          success: "#22C55E",
          warning: "#F59E0B",
        },
      },
    },
  },
  plugins: [],
};
