/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#16161A",
        muted: "#6B6B70",
        canvas: "#FAF9F7",
        aurora: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        violetAccent: "#7c3aed",
        cyanAccent: "#06b6d4",
      },
      backgroundImage: {
        "aurora-gradient":
          "linear-gradient(120deg, #6366f1 0%, #7c3aed 45%, #06b6d4 100%)",
        "aurora-radial":
          "radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.25), transparent 60%)",
      },
      boxShadow: {
        glass: "0 8px 40px rgba(15, 23, 42, 0.12)",
        glow: "0 0 60px rgba(99, 102, 241, 0.35)",
        card: "0 1px 2px rgba(22, 22, 26, 0.04), 0 1px 3px rgba(22, 22, 26, 0.05)",
        lift: "0 4px 12px rgba(22, 22, 26, 0.07), 0 12px 32px rgba(22, 22, 26, 0.07)",
        modal: "0 24px 64px rgba(22, 22, 26, 0.18)",
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.8s ease-out forwards",
        "fade-rise-delay": "fade-rise 0.8s ease-out 0.2s forwards",
        "fade-rise-delay-2": "fade-rise 0.8s ease-out 0.4s forwards",
        "fade-in": "fade-in 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
