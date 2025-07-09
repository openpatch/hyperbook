import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getStructure(dir, base = dir) {
  const structure = new Set();

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(base, fullPath);
      structure.add(relativePath);

      if (entry.isDirectory()) {
        walk(fullPath);
      }
    }
  }

  walk(dir);
  return structure;
}

function compareFolders(folderA, folderB) {
  const structureA = getStructure(folderA);
  const structureB = getStructure(folderB);

  const differences = [];

  for (const entry of structureA) {
    if (!structureB.has(entry)) {
      differences.push({ type: "missing_in_b", path: entry });
    }
  }

  for (const entry of structureB) {
    if (!structureA.has(entry)) {
      differences.push({ type: "missing_in_a", path: entry });
    }
  }

  return differences;
}

// --- CLI Usage ---
const folderA = process.argv[2];
const folderB = process.argv[3];

if (!folderA || !folderB) {
  console.error("Usage: node compareStructure.mjs <folderA> <folderB>");
  process.exit(1);
}

const diffs = compareFolders(folderA, folderB);

const nameA = path.basename(path.resolve(folderA));
const nameB = path.basename(path.resolve(folderB));

if (diffs.length === 0) {
  console.log("✅ Folder structures are identical");
} else {
  console.log("❌ Differences found:");
  for (const diff of diffs) {
    const label =
      diff.type === "missing_in_a" ? `Only in ${nameB}` : `Only in ${nameA}`;
    console.log(`${label}: ${diff.path}`);
  }
}
