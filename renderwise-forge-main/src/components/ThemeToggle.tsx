import { useState, useEffect } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    setIsDark(getTheme() === "dark");
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setIsDark(next === "dark");
  };

  return (
    <button
      onClick={handleToggle}
      className="bg-transparent border border-dgat-border2 text-dgat-muted p-1.5 rounded-md cursor-pointer flex items-center justify-center transition-all duration-150 hover:text-dgat-text hover:bg-raised hover:border-dgat-subtle"
      title="Toggle theme"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
        {isDark ? (
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        ) : (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
