/** The parts of struktolab's editor module the platform uses (it ships no types). */
declare module "struktolab/editor" {
  export type Tree = unknown;
  export type Keywords = Record<string, string>;
  export class StruktolabEditor extends HTMLElement {
    tree: Tree;
    /** The tree as JSON, as books load it from a `src` file. */
    saveJSON(): string;
    loadJSON(json: string | object): void;
    pseudocode: string;
    readonly keywords: Keywords;
  }
  export const KEYWORDS_DE: Keywords;
  export const KEYWORDS_EN: Keywords;
  export function treeToPseudocode(tree: Tree, keywords?: Keywords): string;
  export function stripInsertNodes(tree: Tree): Tree;
}
