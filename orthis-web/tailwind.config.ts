import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: "#E85D4C",
          light: "#FF7A6B",
          dark: "#C94A3A",
        },
        cream: {
          DEFAULT: "#FBF7F4",
          dark: "#F5EDE7",
        },
        sage: {
          DEFAULT: "#A8B5A0",
          light: "#C4CFBD",
        },
        clarity: "#1A1A1A",
        charcoal: "#2D2D2D",
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "sans-serif"],
        display: ["var(--font-playfair)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
