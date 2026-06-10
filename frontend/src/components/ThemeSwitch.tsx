import { Hexagon, Moon, Sun } from "lucide-react";
import { type AppTheme, useTheme } from "@/context/ThemeContext";

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const options: { id: AppTheme; Icon: typeof Sun; label: string }[] = [
    { id: "light", Icon: Sun, label: "Light" },
    { id: "dark", Icon: Moon, label: "Dark" },
    { id: "oscorp", Icon: Hexagon, label: "Oscorp" },
  ];

  if (compact) {
    return (
      <div className="mc-theme-switch-compact flex overflow-hidden rounded-lg border border-border">
        {options.map((opt, i) => {
          const active = theme === opt.id;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTheme(opt.id)}
              title={opt.label}
              className={`flex flex-1 items-center justify-center py-2 transition ${
                i > 0 ? "border-l border-border" : ""
              } ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
      {options.map((opt) => {
        const Icon = opt.Icon;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme(opt.id)}
            title={opt.label}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              theme === opt.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
