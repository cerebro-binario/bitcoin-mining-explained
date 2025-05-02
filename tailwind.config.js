const plugin = require("tailwindcss/plugin");

// tailwind.config.js
module.exports = {
  content: ["./public/index.html", "./src/**/*.{html,js,ts,scss}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--p-accent-text-color)",
          hover: "var(--p-accent-hover-color)",
          active: "var(--p-accent-active-color)",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-primeui"),
    plugin(function ({ addUtilities }) {
      addUtilities({
        ".text-accent": { color: "var(--p-accent-text-color)" },
        ".text-accent-hover:hover": { color: "var(--p-accent-hover-color)" },
        ".text-accent-active:active": { color: "var(--p-accent-active-color)" },
      });
    }),
  ],
};
