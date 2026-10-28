import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAGE_DOCS } from "./directives";
import { type PageForm, toPageForm } from "./frontmatter";

/**
 * A page's frontmatter as a form. "Apply" writes it into the page as an
 * unsaved change, like the visual editors do.
 */
export function PageSettingsDialog({
  text,
  pages,
  onApply,
  onClose,
}: {
  /** The page being edited, or null when closed. */
  text: string | null;
  /** Addresses of the book's pages, for previous and next. */
  pages: string[];
  onApply: (form: PageForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PageForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text === null) return;
    try {
      setForm(toPageForm(text));
      setError(null);
    } catch (err) {
      setForm(null);
      setError(`${err instanceof Error ? err.message : "The page settings cannot be read"}. Fix the YAML at the top of the page first.`);
    }
  }, [text]);

  const update = (patch: Partial<PageForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const apply = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    onApply(form);
    onClose();
  };

  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={apply} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Page settings</DialogTitle>
            <DialogDescription>
              Kept at the top of the page (its frontmatter). Settings not shown here stay as they are.{" "}
              <a href={PAGE_DOCS} target="_blank" rel="noreferrer" className="text-primary underline">
                All settings
              </a>
            </DialogDescription>
          </DialogHeader>
          {form && (
            <>
              <Field id="p-name" label="Name" hint="Shown in the navigation">
                <Input id="p-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field id="p-description" label="Description" hint="For search engines and link previews">
                <Textarea id="p-description" rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
              <Field id="p-keywords" label="Keywords" hint="Comma-separated">
                <Input id="p-keywords" value={form.keywords} onChange={(e) => update({ keywords: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="p-index" label="Position" hint="Lower numbers come first">
                  <Input id="p-index" inputMode="numeric" value={form.index} onChange={(e) => update({ index: e.target.value })} />
                </Field>
                <Field id="p-permaid" label="Permanent id" hint={form.permaid ? `Also at /@/${form.permaid}` : "A short address that stays"}>
                  <Input id="p-permaid" value={form.permaid} onChange={(e) => update({ permaid: e.target.value.replace(/[^\w-]/g, "") })} />
                </Field>
                <Field id="p-layout" label="Layout">
                  <Select value={form.layout || "default"} onValueChange={(v) => update({ layout: v === "default" ? "" : (v as PageForm["layout"]) })}>
                    <SelectTrigger id="p-layout" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">With sidebar</SelectItem>
                      <SelectItem value="wide">Wide</SelectItem>
                      <SelectItem value="standalone">Content only (for embedding)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="p-toc" label="Table of contents">
                  <Select value={form.toc || "book"} onValueChange={(v) => update({ toc: v === "book" ? "" : (v as PageForm["toc"]) })}>
                    <SelectTrigger id="p-toc" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">As the book</SelectItem>
                      <SelectItem value="on">Show</SelectItem>
                      <SelectItem value="off">Hide</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="p-prev" label="Previous page" hint="Instead of the one before">
                  <Input id="p-prev" list="p-pages" value={form.prev} onChange={(e) => update({ prev: e.target.value })} />
                </Field>
                <Field id="p-next" label="Next page" hint="Instead of the one after">
                  <Input id="p-next" list="p-pages" value={form.next} onChange={(e) => update({ next: e.target.value })} />
                </Field>
                <datalist id="p-pages">
                  {pages.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-2">
                <Check id="p-hidden" label="Hide from the navigation" checked={form.hidden} onChange={(hidden) => update({ hidden })} />
                <Check id="p-qrcode" label="QR code of the page" checked={form.qrcode} onChange={(qrcode) => update({ qrcode })} />
              </div>
              <fieldset className="grid gap-3">
                <legend className="mb-1 text-sm font-medium">Protect the page</legend>
                {form.protectKey ? (
                  <Field id="p-protect-key" label="Password from the book's registry" hint="A key in passwords.json; empty to remove">
                    <Input id="p-protect-key" value={form.protectKey} onChange={(e) => update({ protectKey: e.target.value })} />
                  </Field>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="p-password" label="Password" hint="Readers need it to open the page">
                      <Input id="p-password" value={form.password} onChange={(e) => update({ password: e.target.value })} />
                    </Field>
                    <Field id="p-password-hint" label="Shown above the password field">
                      <Input id="p-password-hint" disabled={!form.password} value={form.passwordHint} onChange={(e) => update({ passwordHint: e.target.value })} />
                    </Field>
                  </div>
                )}
              </fieldset>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form}>
              Apply
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
