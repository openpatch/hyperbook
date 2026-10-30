import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Check, Field, Section } from "./form-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { extension, loadFile } from "./files";
import { LANGUAGES } from "./frontmatter";

type Json = Record<string, unknown>;

/** [key, message key, Hyperbook's default] */
const SWITCHES = [
  ["search", "editor.bookSettings.search", false],
  ["toc", "editor.bookSettings.toc", true],
  ["qrcode", "editor.bookSettings.qrcode", false],
  ["trailingSlash", "editor.bookSettings.trailingSlash", false],
  ["allowDangerousHtml", "editor.bookSettings.allowDangerousHtml", false],
  ["importExport", "editor.bookSettings.importExport", false],
] as const;
const IMAGES = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const LOGO_ACCEPT = Array.from(IMAGES, (e) => `.${e}`).join(",");

type Form = {
  name: string;
  description: string;
  language: string;
  authorName: string;
  authorUrl: string;
  license: string;
  logo: string;
  brand: string;
  brandDark: string;
  brandText: string;
  inverted: boolean;
  /** Comma-separated links. */
  scripts: string;
  styles: string;
  breadcrumb: boolean;
  breadcrumbHome: string;
  breadcrumbSeparator: string;
  switches: Record<(typeof SWITCHES)[number][0], boolean>;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map((e) => str(e)).join(", ") : str(v));

function toForm(json: Json): Form {
  const author = (json.author ?? {}) as Json;
  const colors = (json.colors ?? {}) as Json;
  const breadcrumb =
    typeof json.breadcrumb === "object" && json.breadcrumb !== null && !Array.isArray(json.breadcrumb)
      ? (json.breadcrumb as Json)
      : {};
  return {
    name: str(json.name),
    description: str(json.description),
    language: str(json.language) || "en",
    authorName: str(author.name),
    authorUrl: str(author.url),
    license: str(json.license),
    logo: str(json.logo),
    brand: str(colors.brand),
    brandDark: str(colors.brandDark),
    brandText: str(colors.brandText),
    inverted: colors.inverted === true,
    scripts: list(json.scripts),
    styles: list(json.styles),
    breadcrumb: json.breadcrumb === true || Object.keys(breadcrumb).length > 0,
    breadcrumbHome: str(breadcrumb.home),
    breadcrumbSeparator: str(breadcrumb.separator),
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
  set(colors, "brandDark", form.brandDark);
  set(colors, "brandText", form.brandText);
  set(colors, "inverted", form.inverted || undefined);
  set(out, "colors", Object.keys(colors).length > 0 ? colors : undefined);
  const entries = (s: string) => s.split(",").map((e) => e.trim()).filter(Boolean);
  const scripts = entries(form.scripts);
  set(out, "scripts", scripts.length > 0 ? scripts : undefined);
  const styles = entries(form.styles);
  set(out, "styles", styles.length > 0 ? styles : undefined);
  const home = form.breadcrumbHome.trim();
  const separator = form.breadcrumbSeparator.trim();
  set(
    out,
    "breadcrumb",
    form.breadcrumb
      ? home || separator
        ? { ...(home ? { home } : {}), ...(separator ? { separator } : {}) }
        : true
      : undefined,
  );
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
  onUpload,
  onSave,
  onEditJson,
}: {
  open: boolean;
  onClose: () => void;
  bookId: string;
  files: string[];
  /** Uploads images into the public folder; resolves to whether it worked. */
  onUpload: (files: File[]) => Promise<boolean>;
  onSave: (content: string, baseOid: string) => Promise<void>;
  onEditJson: () => void;
}) {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<{ json: Json; oid: string } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

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
      .catch((err: Error) => setError(t("editor.bookSettings.fixJson", { message: err.message })));
  }, [open, bookId]);

  const update = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  // Logos are addressed relative to the public folder.
  const images = files.filter((p) => p.startsWith("public/") && IMAGES.has(extension(p)));
  const href = (p: string) => "/" + p.slice("public/".length);

  /** Uploads one image into the public folder and makes it the logo. */
  const uploadLogo = async (file: File | undefined) => {
    if (!file || uploading) return;
    if (!IMAGES.has(extension(file.name))) {
      setError(t("editor.bookSettings.logoType", { accept: LOGO_ACCEPT }));
      return;
    }
    setUploading(true);
    try {
      if (await onUpload([file])) update({ logo: "/" + file.name });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!loaded || !form) return;
    if (!form.name.trim()) return setError(t("editor.bookSettings.needsName"));
    setBusy(true);
    try {
      await onSave(JSON.stringify(fromForm(loaded.json, form), null, 2) + "\n", loaded.oid);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("editor.bookSettings.couldNotSave"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("editor.bookSettings.title")}</DialogTitle>
            <DialogDescription>{t("editor.bookSettings.description")}</DialogDescription>
          </DialogHeader>
          {form && (
            <>
              <Section title={t("editor.bookSettings.general")}>
                <Field id="s-name" label={t("editor.bookSettings.name")}>
                  <Input id="s-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field id="s-language" label={t("editor.bookSettings.language")}>
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
                <Field id="s-description" label={t("editor.bookSettings.descriptionField")} full>
                  <Textarea id="s-description" rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
                </Field>
              </Section>
              <Section title={t("editor.bookSettings.authorLicense")}>
                <Field id="s-author" label={t("editor.bookSettings.author")}>
                  <Input id="s-author" value={form.authorName} onChange={(e) => update({ authorName: e.target.value })} />
                </Field>
                <Field id="s-author-url" label={t("editor.bookSettings.authorUrl")}>
                  <Input id="s-author-url" type="url" value={form.authorUrl} onChange={(e) => update({ authorUrl: e.target.value })} />
                </Field>
                <Field id="s-license" label={t("editor.bookSettings.license")} full>
                  <Input id="s-license" placeholder={t("editor.bookSettings.licensePlaceholder")} value={form.license} onChange={(e) => update({ license: e.target.value })} />
                </Field>
              </Section>
              <Section title={t("editor.bookSettings.branding")}>
                <Field id="s-logo" label={t("editor.bookSettings.logo")} hint={t("editor.bookSettings.logoHint")}>
                  <div className="flex gap-2">
                    <Select value={form.logo || "none"} onValueChange={(logo) => update({ logo: logo === "none" ? "" : logo })}>
                      <SelectTrigger id="s-logo" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("editor.bookSettings.noLogo")}</SelectItem>
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
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title={t("editor.bookSettings.uploadImage")}
                      aria-label={t("editor.bookSettings.uploadLogo")}
                      disabled={uploading}
                      onClick={() => logoInput.current?.click()}
                    >
                      <UploadIcon />
                    </Button>
                  </div>
                  <input
                    ref={logoInput}
                    type="file"
                    accept={LOGO_ACCEPT}
                    hidden
                    onChange={(e) => {
                      void uploadLogo(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </Field>
                <ColorField id="s-brand" label={t("editor.bookSettings.brand")} fallback="#007864" value={form.brand} onChange={(brand) => update({ brand })} />
                <ColorField id="s-brand-dark" label={t("editor.bookSettings.brandDark")} fallback="#b5e3d8" value={form.brandDark} onChange={(brandDark) => update({ brandDark })} />
                <ColorField id="s-brand-text" label={t("editor.bookSettings.headerText")} fallback="#ffffff" value={form.brandText} onChange={(brandText) => update({ brandText })} />
                <Check id="s-inverted" label={t("editor.bookSettings.invertHeader")} checked={form.inverted} onChange={(inverted) => update({ inverted })} />
              </Section>
              <Section title={t("editor.bookSettings.advanced")}>
                <Field id="s-styles" label={t("editor.bookSettings.styles")} hint={t("editor.bookSettings.stylesHint")} full>
                  <Input id="s-styles" value={form.styles} onChange={(e) => update({ styles: e.target.value })} />
                </Field>
                <Field id="s-scripts" label={t("editor.bookSettings.scripts")} hint={t("editor.bookSettings.scriptsHint")} full>
                  <Input id="s-scripts" value={form.scripts} onChange={(e) => update({ scripts: e.target.value })} />
                </Field>
              </Section>
              <Section title={t("editor.bookSettings.features")}>
                {SWITCHES.map(([key, labelKey]) => (
                  <Check
                    key={key}
                    id={`s-${key}`}
                    label={t(labelKey)}
                    checked={form.switches[key]}
                    onChange={(checked) => update({ switches: { ...form.switches, [key]: checked } })}
                  />
                ))}
                <Check id="s-breadcrumb" label={t("editor.bookSettings.breadcrumb")} full checked={form.breadcrumb} onChange={(breadcrumb) => update({ breadcrumb })} />
                {form.breadcrumb && (
                  <>
                    <Field id="s-breadcrumb-home" label={t("editor.bookSettings.home")} hint={t("editor.bookSettings.homeHint")}>
                      <Input id="s-breadcrumb-home" placeholder="🏠" value={form.breadcrumbHome} onChange={(e) => update({ breadcrumbHome: e.target.value })} />
                    </Field>
                    <Field id="s-breadcrumb-separator" label={t("editor.bookSettings.separator")} hint={t("editor.bookSettings.separatorHint")}>
                      <Input id="s-breadcrumb-separator" placeholder=">" value={form.breadcrumbSeparator} onChange={(e) => update({ breadcrumbSeparator: e.target.value })} />
                    </Field>
                  </>
                )}
              </Section>
            </>
          )}
          {!form && !error && <p className="text-muted-foreground">{t("common.loading")}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="ghost" onClick={onEditJson}>
              {t("editor.bookSettings.editAsJson")}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!form || busy}>
                {t("common.save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A color as the swatch of a color input, with a button for the default. */
function ColorField({
  id,
  label,
  fallback,
  value,
  onChange,
}: {
  id: string;
  label: string;
  fallback: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field id={id} label={label}>
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            {t("editor.bookSettings.defaultColor")}
          </Button>
        )}
      </div>
    </Field>
  );
}
