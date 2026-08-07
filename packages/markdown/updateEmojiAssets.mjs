// Builds the manifest of Twemoji SVG assets that ship with @hyperbook/markdown.
//
// rehypeEmoji only replaces an emoji with an image when the matching file is
// listed here, so the manifest is the single source of truth for what the
// "twemoji" emoji style covers. Run `pnpm emojis:update` after bumping
// @twemoji/svg.
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const twemojiDir = path.dirname(require.resolve("@twemoji/svg/package.json"));

const files = fs
  .readdirSync(twemojiDir)
  .filter((file) => file.endsWith(".svg"))
  .map((file) => file.slice(0, -4))
  .sort();

const outputPath = path.join("src", "emoji-assets.json");
fs.writeFileSync(outputPath, JSON.stringify(files, null, 2) + "\n", "utf8");

console.log(`✅ Saved ${files.length} emoji assets to ${outputPath}`);
