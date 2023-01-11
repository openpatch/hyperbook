//@ts-ignore
import handlebars from "handlebars/dist/cjs/handlebars";
import { findUpSync, Options } from "find-up";
import { lookup } from "mime-types";
import fs from "fs";
import path from "path";
import { extractLines } from "./vfile";

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

handlebars.registerHelper("times", (n: number, block: any) => {
  let accum = "";
  for (let i = 0; i < n; ++i) accum += block.fn(i);
  return accum;
});

handlebars.registerHelper("concat", (s1: string, s2: string) => {
  return s1 + s2;
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
  let gitRoot = findUpSync(".git");
  if (!gitRoot) {
    gitRoot = findUpSync(".git", { type: "directory" } as Options);
    if (!gitRoot) {
      return "Outside is only applicable in git projects.";
    }
  }
  let p = path.join(path.dirname(gitRoot), src);
  const fileDataBase64 = fs.readFileSync(p, "base64");
  const mime = lookup(p);
  return `data:${mime};base64,${fileDataBase64}`;
});

handlebars.registerHelper(
  "rfile",
  (src: string, lines?: string, ellipsis?: string) => {
    if (!src) {
      throw Error("file needs a path to a file");
    }
    let gitRoot = findUpSync(".git");
    if (!gitRoot) {
      gitRoot = findUpSync(".git", { type: "directory" } as Options);
      if (!gitRoot) {
        return "Outside is only applicable in git projects.";
      }
    }
    let p = path.join(path.dirname(gitRoot), src);
    const content = fs.readFileSync(p, "utf8");
    return extractLines(content, lines, ellipsis);
  }
);

export { handlebars };
