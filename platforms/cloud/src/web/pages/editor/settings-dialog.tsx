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
import { extension, loadFile } from "./files";

type Json = Record<string, unknown>;

const LANGUAGES = { en: "English", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano", pt: "Português", nl: "Nederlands" };
/** [key, label, Hyperbook's default] */
const SWITCHES = [
  ["search", "Search", false],
  ["toc", "Table of contents on pages", true],
  ["qrcode", "QR code of the page", false],
  ["trailingSlash", "Addresses end with /", false],
] as const;
const IMAGES = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

type Form = {
  name: string;
  description: string;
  language: string;
  authorName: string;
  authorUrl: string;
  license: string;
  logo: string;
  brand: string;
  switches: Record<(typeof SWITCHES)[number][0], boolean>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");

function toForm(json: Json): Form {
  const author = (json.author ?? {}) as Json;
  const colors = (json.colors ?? {}) as Json;
  return {
    name: str(json.name),
    description: str(json.description),
    language: str(json.language) || "en",
    authorName: str(author.name),
    authorUrl: str(author.url),
    license: str(json.license),
    logo: str(json.logo),
    brand: str(colors.brand),
    switches: Object.fromEntries(
      SWITCHES.map(([key, , fallback]) => [key, typeof json[key] === "boolean" ? json[key] : fallback]),
    ) as Form["switches"],
  };
}

/** Writes the form into `json`, keeping keys it does not know and their order. */
function fromForm(json: Json, form: Form): Json {
  const out: Json = { ...json };
  const set = (target: Json, key: string, value: unknown) => {
    if (value === "" || value === false || value === undefined) delete target[key];
    else target[key] = value;
  };
  set(out, "name", form.name.trim());
  set(out, "description", form.description.trim());
  set(out, "language", form.language);
  set(out, "license", form.license.trim());
  set(out, "logo", form.logo);
  const author: Json = { ...((json.author ?? {}) as Json) };
  set(author, "name", form.authorName.trim());
  set(author, "url", form.authorUrl.trim());
  set(out, "author", Object.keys(author).length > 0 ? author : undefined);
  const colors: Json = { ...((json.colors ?? {}) as Json) };
  set(colors, "brand", form.brand);
  set(out, "colors", Object.keys(colors).length > 0 ? colors : undefined);
  // A switch at Hyperbook's default leaves the key out.
  for (const [key, , fallback] of SWITCHES) {
    if (form.switches[key] === fallback) delete out[key];
    else out[key] = form.switches[key];
  }
  return out;
}

/**
 * hyperbook.json as a form. It saves like any other edit of the file, with
 * the version it was opened from.
 */
export function SettingsDialog({
  open,
  onClose,
  bookId,
  files,
  onSave,
  onEditJson,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
  files: string[];
  onSave: (content: string, baseOid: string) => Promise<void>;
  onEditJson: () => void;
}) {
  const [loaded, setLoaded] = useState<{ json: Json; oid: string } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoaded(null);
    setForm(null);
    setError(null);
    loadFile(bookId, "hyperbook.json")
      .then((file) => {
        if (file.kind !== "text") throw new Error("hyperbook.json is not a text file");
        const json = JSON.parse(file.text) as unknown;
        if (typeof json !== "object" || json === null || Array.isArray(json)) throw new Error("hyperbook.json is not a JSON object");
        setLoaded({ json: json as Json, oid: file.oid });
        setForm(toForm(json as Json));
      })
      .catch((err: Error) => setError(`${err.message}. Fix it as JSON first.`));
  }, [open, bookId]);

  const update = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  // Logos are addressed relative to the public folder.
  const images = files.filter((p) => p.startsWith("public/") && IMAGES.has(extension(p)));
  const href = (p: string) => "/" + p.slice("public/".length);

  const save = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loaded || !form) return;
    if (!form.name.trim()) return setError("The book needs a name");
    setBusy(true);
    try {
      await onSave(JSON.stringify(fromForm(loaded.json, form), null, 2) + "\n", loaded.oid);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Book settings</DialogTitle>
            <DialogDescription>
              Saved in hyperbook.json. Settings not shown here stay as they are.
            </DialogDescription>
          </DialogHeader>
          {form && (
            <>
              <Field id="s-name" label="Name">
                <Input id="s-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field id="s-description" label="Description">
                <Textarea id="s-description" rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="s-language" label="Language">
                  <Select value={form.language} onValueChange={(language) => update({ language })}>
                    <SelectTrigger id="s-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGES).map(([code, name]) => (
                        <SelectItem key={code} value={code}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="s-license" label="License">
                  <Input id="s-license" placeholder="e.g. CC-BY-SA 4.0" value={form.license} onChange={(e) => update({ license: e.target.value })} />
                </Field>
                <Field id="s-author" label="Author">
                  <Input id="s-author" value={form.authorName} onChange={(e) => update({ authorName: e.target.value })} />
                </Field>
                <Field id="s-author-url" label="Author's website">
                  <Input id="s-author-url" type="url" value={form.authorUrl} onChange={(e) => update({ authorUrl: e.target.value })} />
                </Field>
                <Field id="s-logo" label="Logo">
                  <Select value={form.logo || "none"} onValueChange={(logo) => update({ logo: logo === "none" ? "" : logo })}>
                    <SelectTrigger id="s-logo" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No logo</SelectItem>
                      {images.map((p) => (
                        <SelectItem key={p} value={href(p)}>
                          {p}
                        </SelectItem>
                      ))}
                      {form.logo && !images.some((p) => href(p) === form.logo) && (
                        <SelectItem value={form.logo}>{form.logo}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="s-brand" label="Brand color">
                  <div className="flex gap-2">
                    <input
                      id="s-brand"
                      type="color"
                      className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
                      value={form.brand || "#007864"}
                      onChange={(e) => update({ brand: e.target.value })}
                    />
                    {form.brand && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => update({ brand: "" })}>
                        Default
                      </Button>
                    )}
                  </div>
                </Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Features</legend>
                {SWITCHES.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`s-${key}`}
                      checked={form.switches[key]}
                      onCheckedChange={(checked) => update({ switches: { ...form.switches, [key]: checked === true } })}
                    />
                    <Label htmlFor={`s-${key}`} className="font-normal">
                      {label}
                    </Label>
                  </div>
                ))}
              </fieldset>
            </>
          )}
          {!form && !error && <p className="text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={onEditJson}>
              Edit as JSON
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form || busy}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
