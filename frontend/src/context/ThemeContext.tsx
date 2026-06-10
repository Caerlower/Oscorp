import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { OSCORP_ACTIVATION_TOAST } from "@/constants/oscorp-theme";

export type AppTheme = "light" | "dark" | "oscorp";

const THEME_KEY = "oscorp-theme";

function readTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "oscorp") return stored;
  } catch {
    /* ignore */
  }
  return "light";
}

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.remove("dark", "oscorp");
  if (theme === "dark") {
    root.classList.add("dark");
  }
  if (theme === "oscorp") {
    root.classList.add("oscorp");
  }
}

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isDark: boolean;
  isOscorp: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState((prev) => {
      if (next === "oscorp" && prev !== "oscorp") {
        queueMicrotask(() => {
          toast.message(OSCORP_ACTIVATION_TOAST.title, {
            description: OSCORP_ACTIVATION_TOAST.description,
            duration: 4500,
          });
        });
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      isDark: theme === "dark",
      isOscorp: theme === "oscorp",
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
