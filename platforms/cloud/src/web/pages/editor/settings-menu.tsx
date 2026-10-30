import {
  ListRestartIcon,
  ListTreeIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FONTS,
  FONT_SIZES,
  fontOf,
  LINE_HEIGHTS,
  type EditorSettings,
} from "@/lib/editor-settings";

/**
 * The editor's look and checks: font, font size, line height, line numbers,
 * spell check, and the book's own words (see settings-dialog.tsx for those).
 */
export function SettingsMenu({
  settings,
  update,
  /** Whether the book's language has a dictionary. */
  canSpellCheck,
  onOpenWords,
}: {
  settings: EditorSettings;
  update: (patch: Partial<EditorSettings>) => void;
  canSpellCheck: boolean;
  onOpenWords: () => void;
}) {
  const { t } = useTranslation();
  const size = FONT_SIZES.indexOf(settings.fontSize);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label={t("editor.settingsMenu.aria")}
        >
          <Settings2Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("editor.settingsMenu.label")}</DropdownMenuLabel>
        <div className="flex items-center justify-between px-2 py-1 text-sm">
          <span aria-hidden>{t("editor.settingsMenu.fontSize")}</span>
          <span className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-6"
              aria-label={t("editor.settingsMenu.smaller")}
              disabled={size <= 0}
              onClick={() => update({ fontSize: FONT_SIZES[size - 1]! })}
            >
              A−
            </Button>
            <span className="w-8 text-center text-xs tabular-nums">
              {settings.fontSize}px
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-6"
              aria-label={t("editor.settingsMenu.bigger")}
              disabled={size === FONT_SIZES.length - 1}
              onClick={() => update({ fontSize: FONT_SIZES[size + 1]! })}
            >
              A+
            </Button>
          </span>
        </div>
        <div className="flex items-center justify-between px-2 py-1 text-sm">
          <span aria-hidden>{t("editor.settingsMenu.lineHeight")}</span>
          <span className="flex items-center gap-1">
            {LINE_HEIGHTS.map((height, i) => {
              const [label, name] = [
                ["S", t("editor.settingsMenu.small")],
                ["M", t("editor.settingsMenu.medium")],
                ["L", t("editor.settingsMenu.large")],
              ][i]! as [string, string];
              const active = settings.lineHeight === height;
              return (
                <Button
                  key={height}
                  variant={active ? "secondary" : "outline"}
                  size="icon"
                  className="size-6 text-xs"
                  aria-label={t("editor.settingsMenu.lineHeightAria", { name })}
                  aria-pressed={active}
                  disabled={active}
                  onClick={() => update({ lineHeight: height })}
                >
                  {label}
                </Button>
              );
            })}
          </span>
        </div>
        {/* A row like the two above: the choice and its list both drawn in
            the chosen font, so the select shows what it picks. */}
        <div className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
          <span aria-hidden>{t("editor.settingsMenu.font")}</span>
          <Select
            value={settings.font}
            onValueChange={(font) => update({ font })}
          >
            <SelectTrigger
              size="sm"
              aria-label={t("editor.settingsMenu.font")}
              className="h-7 w-32 px-2 text-xs"
              style={{ fontFamily: fontOf(settings.font).stack }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="text-xs">
              {FONTS.map((font) => (
                <SelectItem
                  key={font.key}
                  value={font.key}
                  style={{ fontFamily: font.stack }}
                >
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DropdownMenuCheckboxItem
          checked={settings.lineNumbers}
          onCheckedChange={(checked) =>
            update({ lineNumbers: checked === true })
          }
          onSelect={(e) => e.preventDefault()}
        >
          {t("editor.settingsMenu.lineNumbers")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.spellCheck && canSpellCheck}
          disabled={!canSpellCheck}
          onCheckedChange={(checked) =>
            update({ spellCheck: checked === true })
          }
          onSelect={(e) => e.preventDefault()}
        >
          {t("editor.settingsMenu.spellCheck")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onSelect={onOpenWords}>
          <ListTreeIcon /> {t("editor.settingsMenu.customWords")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The words the book's teachers added, one "remove" button each. */
export function WordsDialog({
  open,
  words,
  onRemove,
  onClose,
}: {
  open: boolean;
  words: string[];
  onRemove: (word: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editor.settingsMenu.wordsTitle")}</DialogTitle>
          <DialogDescription>
            {t("editor.settingsMenu.wordsDescription")}
          </DialogDescription>
        </DialogHeader>
        {words.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            {t("editor.settingsMenu.wordsEmpty")}
          </p>
        ) : (
          <ul className="grid max-h-72 gap-1 overflow-auto">
            {words.map((word) => (
              <li
                key={word}
                className="flex items-center justify-between rounded-md bg-sidebar px-3 py-1.5 text-sm"
              >
                <span className="font-mono">{word}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t("editor.settingsMenu.removeWord", { word })}
                  onClick={() => onRemove(word)}
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListRestartIcon className="size-4 shrink-0" />{" "}
          {t("editor.settingsMenu.wordsApply")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
