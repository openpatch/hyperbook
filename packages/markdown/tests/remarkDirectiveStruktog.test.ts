import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveAlert from "../src/remarkDirectiveAlert";
import remarkDirectiveStruktog from "../src/remarkDirectiveStruktog";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveStruktog(ctx),
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

describe("remarkDirectiveStruktog", () => {
  it("should transform", async () => {
    expect(
      toHtml(
        `
::struktog{data="https://struktog.openpatch.org/#pako:eNqtVcuKG0kQ_Jc-T0LWu0pX433AsjZ42YvxIasycyS2LQ2jFrYx-rO97Y85ZcaWXzOM8F6aoqiKjIyKjH4_vd6xzNPq_bThaTW1mJsvrkHrtYLr3kPj4iA535CKTFfT8u5G7OTv273cLn_abdvT3Tzv3jyd5bVsl89gymGU7Bhq9gmyFoSGnoAaNS8xnMF-E-I_drubO7hF3hrK9Ot__87L5vof2Sz7LrzZXh-21_dWS46U-UQ4lQiqsYMEzDA4U4tdH0d9e5jn49U01puZz9DVe3EpAqoGsGWH5nMAdSQj5XaRKkFboSwIclJlZMNpjgx2sKKpdQZ7dlhuDsvXmvwl--Ve6NpYqXCEUYdAiGOAaBTowXOvOVzEM4Zhj4XNeMYK2M0FvfluVsCSg9Qz2BPay9cs_6bbDfX5fnCh0kNhg-waoWDI4DEPY0ou1xEueiwWpcO8PNtOq-X2IJ83Pl76VDG3EQdmBa9NIRNWCJgqpFJ9NhLfVjw1dW7oxW77gO7dY2lMA2rnAolbARQOwClbazE9Vve7Q89nGrLezSy30_F4cqNx2U-rl3flRo_RzD7MiWT-Tk6Bo5iNsldF5Idb-YXm-d5OqCZ1Lpw6cQGCjgY9mTlHtcnCkC5yUJUaGuYCPvUBhuqhOjolQRg6HH0J9p3Rn9q4U3_AQY1i6cOiaQyF5NlipmQD55obar7AQSeNP006itbavXVtbLuTCmSPC2zNY8X0E9J6CqWkEAAxM3huCMUXhpDMmL6Vy0LE5id1HpDtLmA1VV3qFbplSomU_99oVQo-mg-AQjbWQT0oi4VL6yOmx_4VfhitmD1jlwbVYhGitmFeywQdixYm_3Ojczy--vi1smvZXK_tqMd4Nb3Z8LKeVi254wfMXCkO"}
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::struktog{data="https://struktog.openpatch.org/#pako:eNqtVcuKG0kQ_Jc-T0LWu0pX433AsjZ42YvxIasycyS2LQ2jFrYx-rO97Y85ZcaWXzOM8F6aoqiKjIyKjH4_vd6xzNPq_bThaTW1mJsvrkHrtYLr3kPj4iA535CKTFfT8u5G7OTv273cLn_abdvT3Tzv3jyd5bVsl89gymGU7Bhq9gmyFoSGnoAaNS8xnMF-E-I_drubO7hF3hrK9Ot__87L5vof2Sz7LrzZXh-21_dWS46U-UQ4lQiqsYMEzDA4U4tdH0d9e5jn49U01puZz9DVe3EpAqoGsGWH5nMAdSQj5XaRKkFboSwIclJlZMNpjgx2sKKpdQZ7dlhuDsvXmvwl--Ve6NpYqXCEUYdAiGOAaBTowXOvOVzEM4Zhj4XNeMYK2M0FvfluVsCSg9Qz2BPay9cs_6bbDfX5fnCh0kNhg-waoWDI4DEPY0ou1xEueiwWpcO8PNtOq-X2IJ83Pl76VDG3EQdmBa9NIRNWCJgqpFJ9NhLfVjw1dW7oxW77gO7dY2lMA2rnAolbARQOwClbazE9Vve7Q89nGrLezSy30_F4cqNx2U-rl3flRo_RzD7MiWT-Tk6Bo5iNsldF5Idb-YXm-d5OqCZ1Lpw6cQGCjgY9mTlHtcnCkC5yUJUaGuYCPvUBhuqhOjolQRg6HH0J9p3Rn9q4U3_AQY1i6cOiaQyF5NlipmQD55obar7AQSeNP006itbavXVtbLuTCmSPC2zNY8X0E9J6CqWkEAAxM3huCMUXhpDMmL6Vy0LE5id1HpDtLmA1VV3qFbplSomU_99oVQo-mg-AQjbWQT0oi4VL6yOmx_4VfhitmD1jlwbVYhGitmFeywQdixYm_3Ojczy--vi1smvZXK_tqMd4Nb3Z8LKeVi254wfMXCkO"}
`,
        ctx,
      ).data.directives?.["struktog"],
    ).toBeDefined();
  });
});
