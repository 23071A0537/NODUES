export const THEMES = [
  {
    name: "light",
    label: "Light",
    colors: ["#f3f4f6", "#e5e7eb", "#d1d5db"],
  },
  {
    name: "dark",
    label: "Dark",
    colors: ["#0f172a", "#1e293b", "#334155"],
  },
] as const;

export type ThemeName = (typeof THEMES)[number]["name"];
