import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // One Rainy Day palette — cream paper, chocolate type, cognac accent,
        // forest green for healthy state, teal for info, warm taupe for borders.
        bg: {
          base: "#A8C2BA",     // muted greenish-blue — the page itself
          surface: "#FFFCF5",  // near-white cream — cards/panels (warm contrast)
          surfaceAlt: "#F6EED8", // soft cream — table stripes, group headers
        },
        border: {
          DEFAULT: "#DDCEAF",
          strong: "#BCA47C",
        },
        text: {
          primary: "#3A2A1C",   // chocolate
          secondary: "#6B5640", // taupe
          muted: "#9C8A6E",
        },
        accent: {
          DEFAULT: "#A86F3D",   // cognac
          hover: "#8C5A2E",
          soft: "#EBDBC0",
        },
        success: "#506B45",     // forest green
        warning: "#C8893A",
        error: "#A85540",
        info: "#2D575E",        // teal — used sparingly
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ['"General Sans"', '"Switzer"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.5" }],
        sm: ["13px", { lineHeight: "1.5", letterSpacing: "0.01em" }],
        base: ["15px", { lineHeight: "1.55" }],
        lg: ["17px", { lineHeight: "1.5" }],
        xl: ["20px", { lineHeight: "1.4" }],
        "2xl": ["26px", { lineHeight: "1.25" }],
        "3xl": ["34px", { lineHeight: "1.2" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(42, 38, 32, 0.04), 0 0 0 1px rgba(42, 38, 32, 0.02)",
        card: "0 1px 3px rgba(42, 38, 32, 0.06), 0 0 0 1px rgba(42, 38, 32, 0.03)",
        modal: "0 12px 32px rgba(42, 38, 32, 0.16), 0 0 0 1px rgba(42, 38, 32, 0.04)",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
