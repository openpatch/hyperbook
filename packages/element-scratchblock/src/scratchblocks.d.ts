declare module "scratchblocks" {
  export function parse(text: string, options: any): any;
  export function render(text: string, options: any): SVGElement;
  export function stringify(doc: any): string;
  export function loadLanguages(locales: any);
}
