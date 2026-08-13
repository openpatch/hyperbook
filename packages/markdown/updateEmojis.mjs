// Builds the shortcode map used by :emoji: syntax, and the cheat sheet in the
// docs.
//
// The source is `gemoji`, the same shortcode set GitHub uses, rather than
// GitHub's own emoji API. The API answers with image URLs like
// `unicode/1f1e6-1f1eb.png`, and those filenames drop the ZWJ and the
// variation selectors — so `1f9d1-1f3a8` (artist, which needs a ZWJ) and
// `1f1e6-1f1eb` (a flag, which must not have one) are indistinguishable. There
// is no way to turn those names back into correct sequences, which is why
// flags, keycaps and text-presentation emoji used to fall back to the reader's
// system font instead of rendering as Twemoji.
//
// Run `pnpm emojis:update` to refresh.
import fs from "fs";
import path from "path";
import { gemoji } from "gemoji";

const assets = new Set(
  JSON.parse(fs.readFileSync(path.join("src", "emoji-assets.json"), "utf8")),
);

/**
 * Twemoji file names for an emoji, best first.
 *
 * Twemoji keeps the variation selector in some sequences and drops it in
 * others, so both spellings are offered and the caller takes the one that
 * exists. Mirrors toEmojiIds in src/rehypeEmoji.ts.
 */
const emojiIds = (emoji) => {
  const codePoints = Array.from(emoji).map((c) => c.codePointAt(0));
  const hex = (c) => c.toString(16);
  const full = codePoints.map(hex).join("-");
  const withoutVariants = codePoints
    .filter((c) => c !== 0xfe0f)
    .map(hex)
    .join("-");
  return full === withoutVariants ? [full] : [full, withoutVariants];
};

function buildEmojiJson() {
  const emojiMap = {};
  const uncovered = [];

  for (const entry of gemoji) {
    const covered = emojiIds(entry.emoji).some((id) => assets.has(id));
    for (const name of entry.names) {
      emojiMap[name] = entry.emoji;
      if (!covered) uncovered.push(`:${name}: (${emojiIds(entry.emoji)[0]})`);
    }
  }

  const sorted = Object.fromEntries(
    Object.entries(emojiMap).sort(([a], [b]) => a.localeCompare(b)),
  );

  const outputPath = path.join("src", "github-emojis.json");
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2) + "\n", "utf8");
  console.log(`✅ Saved ${Object.keys(sorted).length} emojis to ${outputPath}`);

  // Every shortcode should render as an image when the twemoji style is on.
  // A gap here means @twemoji/svg and gemoji have drifted apart and the
  // affected shortcodes will fall back to the reader's system font.
  if (uncovered.length > 0) {
    console.warn(
      `⚠️  ${uncovered.length} shortcode(s) have no Twemoji asset:\n   ` +
        uncovered.join("\n   "),
    );
  } else {
    console.log("✅ Every shortcode has a Twemoji asset");
  }

  return sorted;
}

function updateDocs(emojiMap) {
  const enBase = `---
name: Emoji
permaid: emoji
---

# Emoji

Just like in most chat apps you can insert an emoji by using its name.

\`\`\`md
:smiley: :apple: :penguin:
\`\`\`

:smiley: :apple: :penguin:

## Consistent Emojis

Emojis are drawn by the operating system of your reader, so the same emoji looks
different on Windows, macOS, Android and Linux. Set \`elements.emoji.style\` to
\`twemoji\` to replace them with [Twemoji](https://github.com/jdecked/twemoji)
images, which look the same everywhere.

\`\`\`json
{
  "elements": {
    "emoji": {
      "style": "twemoji"
    }
  }
}
\`\`\`

This covers emojis in your content as well as the icons you configure, for
example for links. Emojis in code blocks are never replaced, and only the emojis
you actually use are copied into your build.

Every shortcode below has a Twemoji image, so none of them fall back to your
reader's system font.

Twemoji graphics are licensed CC-BY 4.0 by Twitter, Inc and other contributors.
`;

  const deBase = `---
name: Emoji
permaid: emoji
---

# Emoji

Wie in den meisten Chat-Apps kannst du Emojis durch Eingabe ihres Namens einfügen.

\`\`\`md
:smiley: :apple: :penguin:
\`\`\`

:smiley: :apple: :penguin:

## Einheitliche Emojis

Emojis werden vom Betriebssystem deiner Leser gezeichnet, dasselbe Emoji sieht
daher unter Windows, macOS, Android und Linux unterschiedlich aus. Setze
\`elements.emoji.style\` auf \`twemoji\`, um sie durch
[Twemoji](https://github.com/jdecked/twemoji)-Bilder zu ersetzen, die überall
gleich aussehen.

\`\`\`json
{
  "elements": {
    "emoji": {
      "style": "twemoji"
    }
  }
}
\`\`\`

Das gilt für Emojis in deinen Inhalten und für die Icons, die du konfigurierst,
zum Beispiel für Links. Emojis in Codeblöcken werden nie ersetzt und es werden
nur die Emojis in deinen Build kopiert, die du tatsächlich verwendest.

Für jedes Kürzel unten gibt es ein Twemoji-Bild. Keines fällt also auf die
Schrift des Betriebssystems zurück.

Twemoji-Grafiken stehen unter der CC-BY-4.0-Lizenz von Twitter, Inc und weiteren
Mitwirkenden.
`;

  const enHeader = `# GitHub Emoji Cheat Sheet

This file lists all supported GitHub-style emoji shortcodes and their corresponding Unicode characters.

| Emoji | Shortcode |
|:------|:----------|
`;

  const deHeader = `# GitHub Emoji Cheat Sheet
Diese Datei listet alle unterstützten GitHub-Emoji-Kürzel und ihre entsprechenden Unicode-Zeichen auf.

| Emoji | Shortcode |
|:------|:----------|
`;

  const rows = Object.entries(emojiMap)
    .map(([name, emoji]) => `| ${emoji} | \`:${name}:\` |`)
    .join("\n");

  for (const [lang, base, header] of [
    ["en", enBase, enHeader],
    ["de", deBase, deHeader],
  ]) {
    fs.writeFileSync(
      path.join(
        process.cwd(),
        "..",
        "..",
        "website",
        lang,
        "book",
        "elements",
        "emoji.md",
      ),
      base + "\n" + header + rows + "\n",
      "utf8",
    );
  }
  console.log("✅ Updated the cheat sheet in website/en and website/de");
}

updateDocs(buildEmojiJson());
