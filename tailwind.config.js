import plugin from "tailwindcss/plugin";

// tailwind.config.js
export const plugins = [
  require("tailwindcss-primeui"),
  plugin(function ({ addUtilities }) {
    addUtilities({
      ".text-accent": { color: "var(--p-accent-text-color)" },
      ".text-accent-hover:hover": { color: "var(--p-accent-hover-color)" },
      ".text-accent-active:active": { color: "var(--p-accent-active-color)" },
    });
  }),
];
export const content = ["./public/index.html", "./src/**/*.{html,js,ts,scss}"];
export const theme = {
  extend: {
    colors: {
      accent: {
        DEFAULT: "var(--p-accent-text-color)",
        hover: "var(--p-accent-hover-color)",
        active: "var(--p-accent-active-color)",
      },
    },
  },
};
