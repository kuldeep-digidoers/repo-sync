/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        page: "#0a0a0f",
        card: "#13131a",
        "card-hover": "#1a1a24",
        border: "#26262f",
        "border-light": "#33333f",
        "text-primary": "#e8e8ec",
        "text-secondary": "#8b8b96",
        "text-muted": "#5a5a67",
        accent: {
          DEFAULT: "#5b8cff",
          hover: "#7aa3ff",
          muted: "rgba(91, 140, 255, 0.15)",
        },
        success: {
          DEFAULT: "#3ecf8e",
          muted: "rgba(62, 207, 142, 0.15)",
        },
        warning: {
          DEFAULT: "#f5a524",
          muted: "rgba(245, 165, 36, 0.15)",
        },
        danger: {
          DEFAULT: "#f25555",
          muted: "rgba(242, 85, 85, 0.15)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Consolas",
          "Monaco",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(91, 140, 255, 0.15)",
        "glow-lg": "0 0 40px rgba(91, 140, 255, 0.2)",
      },
    },
  },
  plugins: [],
};
