import handlebars from "handlebars";
import { findUpSync, Options } from "find-up";
import { lookup } from "mime-types";
import fs from "fs";
import path from "path";
import { extractLines, VFileBase } from "./vfile";

declare global {
  var workspaceRoot: string;
}

const isString = (s: any): s is string => {
  return typeof s === "string";
};

const chop = (str: string): string => {
  if (!isString(str)) return "";
  var re = /^[-_.\W\s]+|[-_.\W\s]+$/g;
  return str.trim().replace(re, "");
};

const changecase = (str: string, fn: (s: string) => string): string => {
  if (!isString(str)) return "";
  if (str.length === 1) {
    return str.toLowerCase();
  }

  str = chop(str).toLowerCase();

  var re = /[-_.\W\s]+(\w|$)/g;
  return str.replace(re, function (_, ch) {
    return fn(ch);
  });
};

const registerHelpers = (handlebars: any, options?: { file: VFileBase }) => {
  const cwd = options?.file.root ?? process.cwd();
  handlebars.registerHelper("times", (n: number, block: any) => {
    let accum = "";
    for (let i = 0; i < n; ++i) accum += block.fn(i);
    return accum;
  });

  handlebars.registerHelper("concat", (...s: string[]) => {
    return s.filter(s => typeof s !== "object").join("");
  });

  handlebars.registerHelper("camelcase", (s: string) => {
    if (!isString(s)) return "";
    return changecase(s, (c) => c.toUpperCase());
  });

  handlebars.registerHelper("dashcase", (s: string) => {
    if (!isString(s)) return "";
    return changecase(s, (c) => "-" + c);
  });

  handlebars.registerHelper("lowercase", (s: string) => {
    if (!isString(s)) return "";
    return s.toLowerCase();
  });

  handlebars.registerHelper("uppercase", (s: string) => {
    if (!isString(s)) return "";
    return s.toUpperCase();
  });

  handlebars.registerHelper("pascalcase", (s: string) => {
    if (!isString(s)) return "";
    s = changecase(s, (c) => c.toUpperCase());
    return s.charAt(0).toUpperCase() + s.slice(1);
  });

  handlebars.registerHelper("replaceAll", (s: string, a: string, b: string) => {
    if (!isString(s)) return "";
    if (!isString(a)) return s;
    if (!isString(b)) b = "";
    return s.replaceAll(a, b);
  });

  handlebars.registerHelper("replace", (s: string, a: string, b: string) => {
    if (!isString(s)) return "";
    if (!isString(a)) return s;
    if (!isString(b)) b = "";
    return s.replace(a, b);
  });

  handlebars.registerHelper("replace", (s: string, a: string, b: string) => {
    if (!isString(s)) return "";
    if (!isString(a)) return s;
    if (!isString(b)) b = "";
    return s.replace(a, b);
  });

  handlebars.registerHelper("rbase64", (src: string) => {
    let gitRoot = findUpSync(".git", { type: "file", cwd: cwd } as Options);
    if (!gitRoot) {
      gitRoot = findUpSync(".git", { type: "directory", cwd: cwd } as Options);
      if (!gitRoot) {
        return `rbase64 is only applicable in git projects. No .git was found in ${cwd} and above.`;
      }
    }
    let p = path.join(path.dirname(gitRoot), src);
    try {
      const fileDataBase64 = fs.readFileSync(p, "base64");
      const mime = lookup(p);
      return `data:${mime};base64,${fileDataBase64}`;
    } catch (e) {
      return `File at ${src} is missing.`;
    }
  });

  handlebars.registerHelper(
    "rfile",
    (src: string, lines?: string, ellipsis?: string) => {
      if (!src) {
        throw Error("file needs a path to a file");
      }
      let gitRoot = findUpSync(".git", { type: "file", cwd: cwd } as Options);
      if (!gitRoot) {
        gitRoot = findUpSync(".git", {
          type: "directory",
          cwd: cwd,
        } as Options);
        if (!gitRoot) {
          return `rfile is only applicable in git projects. No .git was found in ${cwd} and above`;
        }
      }
      let p = path.join(path.dirname(gitRoot), src);
      try {
        const content = fs.readFileSync(p, "utf8");
        return extractLines(content, lines, ellipsis);
      } catch (e) {
        return `File ${src} is missing.`;
      }
    },
  );

  handlebars.registerHelper("base64", (src: string) => {
    let p = path.join(cwd, src);
    const fileDataBase64 = fs.readFileSync(p, "base64");
    const mime = lookup(p);
    return `data:${mime};base64,${fileDataBase64}`;
  });

  handlebars.registerHelper(
    "file",
    (src: string, lines?: string, ellipsis?: string) => {
      if (!src) {
        throw Error("file needs a path to a file");
      }
      let p = path.join(cwd, src);
      const content = fs.readFileSync(p, "utf8");
      return extractLines(content, lines, ellipsis);
    },
  );

  handlebars.registerHelper(
    "truncate",
    (str: string, limit: number, suffix: string) => {
      if (!isString(str)) return "";
      if (typeof limit !== "number") limit = 100;
      if (!isString(suffix)) suffix = "...";
      if (str.length <= limit) return str;
      return str.slice(0, limit) + suffix;
    },
  );

  handlebars.registerHelper(
    "truncateWords",
    (str: string, limit: number, suffix: string) => {
      if (!isString(str)) return "";
      if (typeof limit !== "number") limit = 10;
      if (!isString(suffix)) suffix = "...";
      const words = str.split(/\s+/);
      if (words.length <= limit) return str;
      return words.slice(0, limit).join(" ") + suffix;
    },
  );

  handlebars.registerHelper(
    "dateformat",
    (date: string | Date, format: string) => {
      const d = date instanceof Date ? date : new Date(date);
      if (isNaN(d.getTime())) return "";
      if (!isString(format)) format = "YYYY-MM-DD";

      const pad = (n: number, len = 2) => String(n).padStart(len, "0");
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const seconds = d.getSeconds();

      return format
        .replace(/YYYY/g, String(year))
        .replace(/YY/g, String(year).slice(-2))
        .replace(/MM/g, pad(month))
        .replace(/M/g, String(month))
        .replace(/DD/g, pad(day))
        .replace(/D/g, String(day))
        .replace(/HH/g, pad(hours))
        .replace(/H/g, String(hours))
        .replace(/mm/g, pad(minutes))
        .replace(/m/g, String(minutes))
        .replace(/ss/g, pad(seconds))
        .replace(/s/g, String(seconds));
    },
  );
};

export { registerHelpers, handlebars };
