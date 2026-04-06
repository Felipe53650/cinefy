const forms = require("@tailwindcss/forms");
const containerQueries = require("@tailwindcss/container-queries");

module.exports = {
  darkMode: "class",
  content: [
    "./public/**/*.html",
    "./public/assets/js/**/*.js",
    "./public/components/**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#e83b24",
        "primary-deep": "#9f170d",
        "background-dark": "#14090a",
        background: "#14090a",
        panel: "rgba(33, 14, 15, 0.72)",
        surface: "#200e0c",
        "surface-strong": "#462f2c",
        "surface-bright": "#4b3330",
        "surface-container": "#2e1a18",
        "surface-container-low": "#2a1614",
        "surface-container-highest": "#462f2c",
        "surface-dim": "#14090a",
        "surface-variant": "#462f2c",
        "on-background": "#ffdad5",
        "on-surface": "#ffdad5",
        "on-surface-variant": "#e9bcb6",
        "inverse-surface": "#ffdad5",
        "inverse-primary": "#9f170d",
        secondary: "#ffb4aa",
        "secondary-container": "#8f110f",
        "on-secondary-container": "#ff9a8d",
        tertiary: "#a6c8ff",
        outline: "#af8782",
        "primary-container": "#e83b24",
        "cine-red": "#df2d18",
        "cine-red-deep": "#9f170d",
        "cine-panel": "rgba(36, 17, 16, 0.78)",
        "cine-border": "rgba(255, 255, 255, 0.18)",
        "cine-text": "#fff7f5",
        "cine-muted": "#d7c1bd",
        ink: "#fff5f2"
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Outfit", "sans-serif"],
        headline: ["Sora", "sans-serif"],
        label: ["Outfit", "sans-serif"]
      },
      boxShadow: {
        glow: "0 32px 80px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: [forms, containerQueries]
};
