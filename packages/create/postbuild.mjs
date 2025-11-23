import path from "path";
import { cp } from "fs/promises";

async function postbuild() {
  const templates = path.join(...["./templates"]);
  const distTemplates = path.join(...["./dist", "templates"]);
  await cp(templates, distTemplates, { recursive: true });
}
postbuild();
