import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Warm neutral palette — feels more fashion-editorial than the default
      // zinc/slate stacks. Semantic names so we can swap shades centrally.
      colors: {
        surface: {
          DEFAULT: "#faf8f5", // page background
          raised: "#ffffff",  // cards
          sunken: "#f3efe9",  // section / hover
        },
        ink: {
          DEFAULT: "#171513",
          muted: "#6b655d",
          subtle: "#9b958c",
        },
        line: "#e8e3da",
        accent: {
          DEFAULT: "#171513", // primary CTAs use ink — timeless
          soft: "#f3efe9",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.03), 0 1px 3px 0 rgb(0 0 0 / 0.04)",
        lift: "0 4px 14px -2px rgb(0 0 0 / 0.06), 0 2px 6px -1px rgb(0 0 0 / 0.04)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
