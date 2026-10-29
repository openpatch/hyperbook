import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * The building blocks of the settings dialogs: titled groups of labeled
 * fields, in two columns that stack on narrow screens.
 */

/** One titled group of settings, so the form reads in a few sweeps. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

export function Field({
  id,
  label,
  hint,
  full,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Spans both columns, for fields that need the room. */
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid content-start gap-1.5${full ? " sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Check({
  id,
  label,
  full,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  /** Spans both columns, to close a group. */
  full?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className={`flex items-center gap-2${full ? " sm:col-span-2" : ""}`}>
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
