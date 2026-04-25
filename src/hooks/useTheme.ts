import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    // Force light theme permanently
    document.documentElement.classList.remove("dark");
    try { localStorage.setItem("theme", "light"); } catch { /* ignore */ }
  }, []);

  // No-op setter since theme is locked
  const setTheme = () => {};

  return { theme, setTheme };
}
