import path from "path";
import fs from "fs/promises";
import { makeDir } from "./make-dir";

export async function generateFavicons(
  logoPath: string,
  outputDir: string,
): Promise<void> {
  // Dynamic import to avoid bundling issues with sharp
  const { favicons } = await import("favicons");
  
  const config = {
    path: "/",
    icons: {
      android: false,
      appleIcon: false,
      appleStartup: false,
      favicons: true,
      windows: false,
      yandex: false,
    },
  };

  const response = await favicons(logoPath, config);

  // Create output directory if it doesn't exist
  await makeDir(outputDir, { recursive: true });

  // Write favicon files
  for (const file of response.images) {
    await fs.writeFile(path.join(outputDir, file.name), file.contents);
  }

  // Write HTML files (manifest, browserconfig, etc.) if needed
  for (const file of response.files) {
    await fs.writeFile(path.join(outputDir, file.name), file.contents);
  }
}
