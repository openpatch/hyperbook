import { cwd } from "process";
import { buildPackage } from "./buildPackage.mjs";

const dir = cwd();
buildPackage(dir);
