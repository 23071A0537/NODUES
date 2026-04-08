import { create } from "zustand";
import type { ThemeName } from "../constants";

const FALLBACK_THEME: ThemeName = "light";

const safeLocalStorage = {
  get(key: string): ThemeName {
    try {
      const value = localStorage.getItem(key);
      return (value as ThemeName) || FALLBACK_THEME;
    } catch (err) {
      return FALLBACK_THEME;
    }
  },
  set(key: string, value: ThemeName) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      // ignore storage failures
    }
  },
};

type ThemeStore = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: safeLocalStorage.get("preferred-theme"),
  setTheme: (theme: ThemeName) => {
    safeLocalStorage.set("preferred-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    set({ theme });
  },
}));
