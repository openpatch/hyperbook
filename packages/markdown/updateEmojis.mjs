// scripts/build-emoji-json.ts
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

async function buildEmojiJson() {
  const res = await fetch("https://api.github.com/emojis");
  const json = await res.json();
  const emojiMap = {};

  for (const [name, url] of Object.entries(json)) {
    const match = url.match(/unicode\/([a-f0-9\-]+)\.png/);
    if (match) {
      const codepoints = match[1]
        .split("-")
        .map((cp) => String.fromCodePoint(parseInt(cp, 16)))
        .join("\u200D");
      emojiMap[name] = codepoints;
    }
  }

  const outputPath = path.join("src/github-emojis.json");
  fs.writeFileSync(outputPath, JSON.stringify(emojiMap, null, 2), "utf8");
  console.log(
    `✅ Saved ${Object.keys(emojiMap).length} emojis to ${outputPath}`,
  );

  return emojiMap;
}

async function updateDocs(emojiMap) {
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
different on Windows, macOS, Android and Linux. Set `elements.emoji.style` to
`twemoji` to replace them with [Twemoji](https://github.com/jdecked/twemoji)
images, which look the same everywhere.

```json
{
  "elements": {
    "emoji": {
      "style": "twemoji"
    }
  }
}
```

This covers emojis in your content as well as the icons you configure, for
example for links. Emojis in code blocks are never replaced, and only the emojis
you actually use are copied into your build.

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
`elements.emoji.style` auf `twemoji`, um sie durch
[Twemoji](https://github.com/jdecked/twemoji)-Bilder zu ersetzen, die überall
gleich aussehen.

```json
{
  "elements": {
    "emoji": {
      "style": "twemoji"
    }
  }
}
```

Das gilt für Emojis in deinen Inhalten und für die Icons, die du konfigurierst,
zum Beispiel für Links. Emojis in Codeblöcken werden nie ersetzt und es werden
nur die Emojis in deinen Build kopiert, die du tatsächlich verwendest.

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

| Emoji | Shortcode 
|:------|:----------|
`;

  const rows = Object.entries(emojiMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, emoji]) => `| ${emoji} | \`:${name}:\` |`)
    .join("\n");

  fs.writeFileSync(
    path.join(
      process.cwd(),
      "..",
      "..",
      "website",
      "en",
      "book",
      "elements",
      "emoji.md",
    ),
    enBase + "\n" + enHeader + rows + "\n",
    "utf8",
  );

  fs.writeFileSync(
    path.join(
      process.cwd(),
      "..",
      "..",
      "website",
      "de",
      "book",
      "elements",
      "emoji.md",
    ),
    deBase + "\n" + deHeader + rows + "\n",
    "utf8",
  );
}

buildEmojiJson()
  .catch((err) => {
    console.error("❌ Failed to fetch and build emoji map", err);
  })
  .then(updateDocs);
