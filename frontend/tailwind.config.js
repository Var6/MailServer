/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        gmail: {
          bg:      "#f6f8fc",
          primary: "#1a73e8",
          surface: "#ffffff",
          border:  "#dadce0",
          text:    "#202124",
          muted:   "#5f6368",
          hover:   "#f1f3f4",
          active:  "#d3e3fd",
          chip:    "#c2e7ff",
        },
      },
      animation: {
        "in": "fadeIn 150ms ease-out",
        "slide-in-from-bottom-4": "slideInBottom 200ms ease-out",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideInBottom: { from: { opacity: 0, transform: "translateY(1rem)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
