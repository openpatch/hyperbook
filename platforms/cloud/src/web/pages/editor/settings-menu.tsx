import {
  ListRestartIcon,
  ListTreeIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";
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
  FONT_SIZES,
  LINE_HEIGHTS,
  type EditorSettings,
} from "@/lib/editor-settings";

/**
 * The editor's look and checks: font size, line height, line numbers, spell
 * check, and the book's own words (see settings-dialog.tsx for those).
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
  const size = FONT_SIZES.indexOf(settings.fontSize);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Editor settings"
        >
          <Settings2Icon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Editor</DropdownMenuLabel>
        <div className="flex items-center justify-between px-2 py-1 text-sm">
          <span aria-hidden>Font size</span>
          <span className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-6"
              aria-label="Smaller text"
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
              aria-label="Bigger text"
              disabled={size === FONT_SIZES.length - 1}
              onClick={() => update({ fontSize: FONT_SIZES[size + 1]! })}
            >
              A+
            </Button>
          </span>
        </div>
        <div className="flex items-center justify-between px-2 py-1 text-sm">
          <span aria-hidden>Line height</span>
          <span className="flex items-center gap-1">
            {LINE_HEIGHTS.map((height, i) => {
              const [label, name] = [
                ["S", "Small"],
                ["M", "Medium"],
                ["L", "Large"],
              ][i]!;
              const active = settings.lineHeight === height;
              return (
                <Button
                  key={height}
                  variant={active ? "secondary" : "outline"}
                  size="icon"
                  className="size-6 text-xs"
                  aria-label={`${name} line height`}
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
        <DropdownMenuCheckboxItem
          checked={settings.lineNumbers}
          onCheckedChange={(checked) =>
            update({ lineNumbers: checked === true })
          }
          onSelect={(e) => e.preventDefault()}
        >
          Line numbers
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.spellCheck && canSpellCheck}
          disabled={!canSpellCheck}
          onCheckedChange={(checked) =>
            update({ spellCheck: checked === true })
          }
          onSelect={(e) => e.preventDefault()}
        >
          Spell check
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenWords}>
          <ListTreeIcon /> Custom words…
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
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom words</DialogTitle>
          <DialogDescription>
            Words the book's teachers added to its spell-check dictionary.
            Right-click an underlined word on a page to add another one.
          </DialogDescription>
        </DialogHeader>
        {words.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No custom words yet.
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
                  aria-label={`Remove ${word}`}
                  onClick={() => onRemove(word)}
                >
                  <XIcon className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListRestartIcon className="size-4 shrink-0" /> The words apply to the
          whole book, on every device.
        </p>
      </DialogContent>
    </Dialog>
  );
}
