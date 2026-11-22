import { useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

/**
 * The tab of a page, kept in `?tab=` so a reload or a shared link opens the
 * same tab. The first tab is the default and leaves the address bare.
 */
export function useTab<T extends string>(tabs: readonly T[]): [T, (tab: T) => void] {
  const [params, setParams] = useSearchParams();
  const wanted = params.get("tab");
  const tab = tabs.find((name) => name === wanted) ?? tabs[0]!;
  const setTab = (next: T) =>
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === tabs[0]) out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true },
    );
  return [tab, setTab];
}

/** An underlined row of tabs; the panels are `TabPanel`s with the same `idPrefix`. */
export function TabList<T extends string>({
  idPrefix,
  label,
  tabs,
  value,
  onChange,
}: {
  idPrefix: string;
  label: string;
  tabs: readonly { name: T; label: React.ReactNode }[];
  value: T;
  onChange: (tab: T) => void;
}) {
  // Arrow keys move between tabs, as the ARIA tabs pattern asks.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = tabs.findIndex((tab) => tab.name === value);
    const next = tabs[(index + step + tabs.length) % tabs.length]!;
    onChange(next.name);
    document.getElementById(`${idPrefix}-tab-${next.name}`)?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-6 flex gap-1 overflow-x-auto border-b"
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.name}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.name}`}
          aria-selected={value === tab.name}
          aria-controls={`${idPrefix}-panel-${tab.name}`}
          tabIndex={value === tab.name ? 0 : -1}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
            value === tab.name
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(tab.name)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  name,
  className,
  children,
}: {
  idPrefix: string;
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div id={`${idPrefix}-panel-${name}`} role="tabpanel" aria-labelledby={`${idPrefix}-tab-${name}`} className={className}>
      {children}
    </div>
  );
}
