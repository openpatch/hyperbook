import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAGE_DOCS } from "./directives";
import { isSectionIndex } from "./files";
import { LANGUAGES, type PageForm, toPageForm } from "./frontmatter";

/**
 * A page's frontmatter as a form. "Apply" writes it into the page as an
 * unsaved change, like the visual editors do.
 */
export function PageSettingsDialog({
  text,
  path,
  pages,
  onApply,
  onClose,
}: {
  /** The page being edited, or null when closed. */
  text: string | null;
  /** The page's file, to know whether it is a section's index. */
  path: string | null;
  /** Addresses of the book's pages, for previous and next. */
  pages: string[];
  onApply: (form: PageForm) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PageForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (text === null) return;
    try {
      setForm(toPageForm(text));
      setError(null);
    } catch (err) {
      setForm(null);
      setError(
        t("editor.pageSettings.fixYaml", {
          message: err instanceof Error ? err.message : "",
        }),
      );
    }
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<PageForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const section = path !== null && isSectionIndex(path);
  const apply = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form) return;
    onApply(form);
    onClose();
  };

  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={apply} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("editor.pageSettings.title")}</DialogTitle>
            <DialogDescription>
              {t("editor.pageSettings.description")}{" "}
              <a href={PAGE_DOCS} target="_blank" rel="noreferrer" className="text-primary underline">
                {t("editor.pageSettings.allSettings")}
              </a>
            </DialogDescription>
          </DialogHeader>
          {form && (
            <>
              <Section title={t("editor.pageSettings.general")}>
                <Field id="p-name" label={t("editor.pageSettings.name")} hint={t("editor.pageSettings.nameHint")}>
                  <Input id="p-name" value={form.name} onChange={(e) => update({ name: e.target.value })} />
                </Field>
                <Field
                  id="p-description"
                  label={t("editor.pageSettings.descriptionField")}
                  hint={t("editor.pageSettings.descriptionHint")}
                  full
                >
                  <Textarea id="p-description" rows={2} value={form.description} onChange={(e) => update({ description: e.target.value })} />
                </Field>
                <Field
                  id="p-keywords"
                  label={t("editor.pageSettings.keywords")}
                  hint={t("editor.pageSettings.keywordsHint")}
                >
                  <Input id="p-keywords" value={form.keywords} onChange={(e) => update({ keywords: e.target.value })} />
                </Field>
                <Field id="p-lang" label={t("editor.pageSettings.language")}>
                  <Select value={form.lang || "book"} onValueChange={(lang) => update({ lang: lang === "book" ? "" : lang })}>
                    <SelectTrigger id="p-lang" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">{t("editor.pageSettings.asBook")}</SelectItem>
                      {Object.entries(LANGUAGES).map(([code, name]) => (
                        <SelectItem key={code} value={code}>
                          {name}
                        </SelectItem>
                      ))}
                      {form.lang && form.lang !== "book" && !(form.lang in LANGUAGES) && <SelectItem value={form.lang}>{form.lang}</SelectItem>}
                    </SelectContent>
                  </Select>
                </Field>
              </Section>
              <Section title={t("editor.pageSettings.navigation")}>
                <Field
                  id="p-index"
                  label={t("editor.pageSettings.position")}
                  hint={t("editor.pageSettings.positionHint")}
                >
                  <Input id="p-index" inputMode="numeric" value={form.index} onChange={(e) => update({ index: e.target.value })} />
                </Field>
                <Field
                  id="p-permaid"
                  label={t("editor.pageSettings.permaid")}
                  hint={
                    form.permaid
                      ? t("editor.pageSettings.permaidAlso", { permaid: form.permaid })
                      : t("editor.pageSettings.permaidHint")
                  }
                >
                  <Input id="p-permaid" value={form.permaid} onChange={(e) => update({ permaid: e.target.value.replace(/[^\w-]/g, "") })} />
                </Field>
                <Field id="p-navigation" label={t("editor.pageSettings.showInNavigation")}>
                  <Select
                    value={form.navigation || "default"}
                    onValueChange={(v) => update({ navigation: v === "default" ? "" : (v as PageForm["navigation"]) })}
                  >
                    <SelectTrigger id="p-navigation" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("editor.pageSettings.inNavigation")}</SelectItem>
                      <SelectItem value="hidden">{t("editor.pageSettings.hidden")}</SelectItem>
                      {section && (
                        <SelectItem value="virtual">{t("editor.pageSettings.pagesOnParent")}</SelectItem>
                      )}
                      {section && (
                        <SelectItem value="page">{t("editor.pageSettings.singlePage")}</SelectItem>
                      )}
                      {section && (
                        <SelectItem value="expanded">{t("editor.pageSettings.expanded")}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="p-toc" label={t("editor.pageSettings.toc")}>
                  <Select value={form.toc || "book"} onValueChange={(v) => update({ toc: v === "book" ? "" : (v as PageForm["toc"]) })}>
                    <SelectTrigger id="p-toc" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">{t("editor.pageSettings.asBook")}</SelectItem>
                      <SelectItem value="on">{t("editor.pageSettings.show")}</SelectItem>
                      <SelectItem value="off">{t("editor.pageSettings.hide")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <LinkField
                  id="p-prev"
                  label={t("editor.pageSettings.previousPage")}
                  hint={t("editor.pageSettings.previousHint")}
                  value={form.prev}
                  off={form.prevOff}
                  onChange={(prev) => update({ prev })}
                  onOff={(prevOff) => update({ prevOff })}
                />
                <LinkField
                  id="p-next"
                  label={t("editor.pageSettings.nextPage")}
                  hint={t("editor.pageSettings.nextHint")}
                  value={form.next}
                  off={form.nextOff}
                  onChange={(next) => update({ next })}
                  onOff={(nextOff) => update({ nextOff })}
                />
                <datalist id="p-pages">
                  {pages.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Section>
              <Section title={t("editor.pageSettings.appearance")}>
                <Field id="p-layout" label={t("editor.pageSettings.layout")}>
                  <Select value={form.layout || "default"} onValueChange={(v) => update({ layout: v === "default" ? "" : (v as PageForm["layout"]) })}>
                    <SelectTrigger id="p-layout" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">{t("editor.pageSettings.withSidebar")}</SelectItem>
                      <SelectItem value="wide">{t("editor.pageSettings.wide")}</SelectItem>
                      <SelectItem value="standalone">
                        {t("editor.pageSettings.standalone")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="p-breadcrumb" label={t("editor.pageSettings.breadcrumb")}>
                  <Select
                    value={form.breadcrumb || "book"}
                    onValueChange={(v) => update({ breadcrumb: v === "book" ? "" : (v as PageForm["breadcrumb"]) })}
                  >
                    <SelectTrigger id="p-breadcrumb" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="book">{t("editor.pageSettings.asBook")}</SelectItem>
                      <SelectItem value="on">{t("editor.pageSettings.show")}</SelectItem>
                      <SelectItem value="off">{t("editor.pageSettings.hide")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  id="p-breadcrumb-home"
                  label={t("editor.pageSettings.breadcrumbHome")}
                  hint={t("editor.pageSettings.breadcrumbHomeHint")}
                >
                  <Input
                    id="p-breadcrumb-home"
                    disabled={form.breadcrumb !== "on"}
                    placeholder="🏠"
                    value={form.breadcrumbHome}
                    onChange={(e) => update({ breadcrumbHome: e.target.value })}
                  />
                </Field>
                <Field
                  id="p-breadcrumb-separator"
                  label={t("editor.pageSettings.breadcrumbSeparator")}
                  hint={t("editor.pageSettings.breadcrumbSeparatorHint")}
                >
                  <Input
                    id="p-breadcrumb-separator"
                    disabled={form.breadcrumb !== "on"}
                    placeholder=">"
                    value={form.breadcrumbSeparator}
                    onChange={(e) => update({ breadcrumbSeparator: e.target.value })}
                  />
                </Field>
              </Section>
              <Section title={t("editor.pageSettings.advanced")}>
                <Field
                  id="p-styles"
                  label={t("editor.bookSettings.styles")}
                  hint={t("editor.bookSettings.stylesHint")}
                  full
                >
                  <Input id="p-styles" value={form.styles} onChange={(e) => update({ styles: e.target.value })} />
                </Field>
                <Field
                  id="p-scripts"
                  label={t("editor.bookSettings.scripts")}
                  hint={t("editor.bookSettings.scriptsHint")}
                  full
                >
                  <Input id="p-scripts" value={form.scripts} onChange={(e) => update({ scripts: e.target.value })} />
                </Field>
                <Check
                  id="p-qrcode"
                  label={t("editor.bookSettings.qrcode")}
                  full
                  checked={form.qrcode}
                  onChange={(qrcode) => update({ qrcode })}
                />
              </Section>
              <Section title={t("editor.pageSettings.protect")}>
                {form.protectKey ? (
                  <Field
                    id="p-protect-key"
                    label={t("editor.pageSettings.protectKey")}
                    hint={t("editor.pageSettings.protectKeyHint")}
                    full
                  >
                    <Input id="p-protect-key" value={form.protectKey} onChange={(e) => update({ protectKey: e.target.value })} />
                  </Field>
                ) : (
                  <>
                    <Field
                      id="p-password"
                      label={t("editor.pageSettings.password")}
                      hint={t("editor.pageSettings.passwordHint")}
                    >
                      <Input id="p-password" value={form.password} onChange={(e) => update({ password: e.target.value })} />
                    </Field>
                    <Field
                      id="p-password-hint"
                      label={t("editor.pageSettings.passwordFieldHint")}
                    >
                      <Input id="p-password-hint" disabled={!form.password} value={form.passwordHint} onChange={(e) => update({ passwordHint: e.target.value })} />
                    </Field>
                  </>
                )}
              </Section>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!form}>
              {t("editor.pageSettings.apply")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A page link with a "None" next to it: no jump to that page. */
function LinkField({
  id,
  label,
  hint,
  value,
  off,
  onChange,
  onOff,
}: {
  id: string;
  label: string;
  hint?: string;
  /** The page's address, or "" for the one the book picks. */
  value: string;
  off: boolean;
  onChange: (value: string) => void;
  onOff: (off: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Field id={id} label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <Input id={id} list="p-pages" disabled={off} value={value} onChange={(e) => onChange(e.target.value)} />
        <Label htmlFor={`${id}-none`} className="flex shrink-0 cursor-pointer items-center gap-1.5 font-normal">
          <Checkbox id={`${id}-none`} checked={off} onCheckedChange={(c) => onOff(c === true)} />
          {t("editor.pageSettings.none")}
        </Label>
      </div>
    </Field>
  );
}
