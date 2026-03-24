import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F0F0F",
        paper: "#121212",
        foreground: "#E0E0E0",
        "muted-foreground": "#B0B0B0",
        accent: {
          DEFAULT: "#3B82F6",
          foreground: "#FFFFFF",
        },
        border: "#2A2A2A",
        "border-light": "#404040",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
