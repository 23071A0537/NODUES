import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { useThemeStore } from "../store/useThemeStore";

function ThemeSelector() {
  const { theme, setTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-sm rounded-full border border-base-300 bg-base-100/80 px-3 hover:bg-base-200"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <span className="hidden sm:inline text-xs font-semibold tracking-wide">
        {theme === "light" ? "Dark" : "Light"}
      </span>
      {theme === "light" ? (
        <Moon className="size-5" />
      ) : (
        <Sun className="size-5" />
      )}
    </button>
  );
}

export default ThemeSelector;
