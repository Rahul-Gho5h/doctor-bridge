import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const options = [
  { value: "light", Icon: Sun,  label: "Light" },
  { value: "dark",  Icon: Moon, label: "Dark"  },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center rounded-full border bg-muted/50 p-0.5 gap-0.5">
      {options.map(({ value, Icon, label }) => (
        <button
          key={value}
          title={label}
          onClick={() => setTheme()}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-all",
            theme === value
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
