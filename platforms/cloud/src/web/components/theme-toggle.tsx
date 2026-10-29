import { MoonIcon, SunIcon } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** A book's dark mode toggle: the moon in light mode, the sun in dark mode. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useTheme();
  const Icon = theme === "dark" ? SunIcon : MoonIcon;
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn("flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md", className)}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <Icon className="size-6" />
    </button>
  );
}
