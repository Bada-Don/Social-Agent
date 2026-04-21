import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#171717",
        primary: "#3b82f6", // Royal blue accent
      },
    },
  },
  plugins: [],
};
export default config;
