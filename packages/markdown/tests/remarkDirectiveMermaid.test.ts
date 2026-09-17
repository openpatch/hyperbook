import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveMermaid from "../src/remarkDirectiveMermaid";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveMermaid(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("remarkDirectiveMermaid", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
:::mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }
    class Zebra{
      +bool is_wild
      +run()
    }
:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform code", async () => {
    expect(
      toHtml(
        `
\`\`\`mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }
    class Zebra{
      +bool is_wild
      +run()
    }
\`\`\`

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
:::mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }
    class Zebra{
      +bool is_wild
      +run()
    }
:::
`,
        ctx,
      ).data.directives?.["mermaid"],
    ).toBeDefined();
  });
  it(`should render complex diagram`, async () => {
    expect(
      toHtml(
        `
\`\`\`mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal <|-- Zebra
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
    Animal: +mate()
    class Duck{
      +String beakColor
      +swim()
      +quack()
    }
    class Fish{
      -int sizeInFeet
      -canEat()
    }
    class Zebra{
      +bool isWild
      +run()
    }
\`\`\`
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should survive a round trip through data-mermaid with non-ASCII labels", async () => {
    // The diagram is stored base64-encoded in data-mermaid and decoded again by
    // assets/directive-mermaid/client.js. Buffer.from() encodes UTF-8 *bytes*,
    // so the client has to decode them as UTF-8 -- a bare atob() hands back one
    // character per byte and turns "Überwachtes" into "Ãberwachtes".
    const diagram = [
      "flowchart TD",
      '    A["Trainingsdaten"] --> B{"Gibt es Labels?"}',
      '    B -->|"Ja"| C["Überwachtes Lernen"]',
      '    B -->|"Nein"| D["Bestärkendes Lernen"]',
      '    D --> E["Maß für die Güte"]',
    ].join("\n");

    const html = String(toHtml("```mermaid\n" + diagram + "\n```\n", ctx).value);
    const encoded = html.match(/data-mermaid="([^"]*)"/)?.[1];
    expect(encoded).toBeDefined();

    // exactly what client.js does
    const bytes = Uint8Array.from(atob(encoded!), (c) => c.charCodeAt(0));
    expect(new TextDecoder().decode(bytes)).toBe(diagram);

    // and why it has to: the shortcut turns every non-ASCII character into its
    // UTF-8 bytes read one by one -- "ä" (C3 A4) becomes "Ã¤", "Ü" (C3 9C)
    // becomes "Ã" plus an invisible C1 control character.
    expect(atob(encoded!)).not.toBe(diagram);
    expect(atob(encoded!)).toContain("BestÃ¤rkendes");
    expect(atob(encoded!)).toContain("\u00c3\u009cberwachtes");
  });
});
