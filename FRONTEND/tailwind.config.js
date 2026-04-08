import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#0f3f69",
          "primary-content": "#ffffff",
          secondary: "#1f6f86",
          "secondary-content": "#ffffff",
          accent: "#b48834",
          "accent-content": "#1f1a10",
          neutral: "#1e2f46",
          "neutral-content": "#f5f7fb",
          "base-100": "#ffffff",
          "base-200": "#edf3f9",
          "base-300": "#d8e2ef",
          "base-content": "#13233a",
          info: "#275f96",
          success: "#23794e",
          warning: "#9a5c1d",
          error: "#9b2d2d",
        },
      },
      {
        dark: {
          primary: "#8cc4ff",
          "primary-content": "#08223b",
          secondary: "#62d0e8",
          "secondary-content": "#06252d",
          accent: "#e0b35d",
          "accent-content": "#2e1f00",
          neutral: "#e1e8f5",
          "neutral-content": "#08172a",
          "base-100": "#16263f",
          "base-200": "#0f1b2d",
          "base-300": "#25344d",
          "base-content": "#e6edf8",
          info: "#79b8ff",
          success: "#63d39b",
          warning: "#efbb6d",
          error: "#ef8f8f",
        },
      },
    ],
  },
}
