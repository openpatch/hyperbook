import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeUnwrapImages from "rehype-unwrap-images";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import { remarkRemoveComments } from "./remarkRemoveComments";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkMath from "remark-math";
import remarkDirectiveVideo from "./remarkDirectiveVideo";
import remarkDirectiveYoutube from "./remarkDirectiveYoutube";
import remarkDirectiveTiles from "./remarkDirectiveTiles";
import remarkDirectiveTabs from "./remarkDirectiveTabs";
import remarkDirectiveSqlIde from "./remarkDirectiveSqlIde";
import { HyperbookContext } from "@hyperbook/types";
import remarkDirectiveSlideshow from "./remarkDirectiveSlideshow";
import remarkCollectHeadings from "./remarkCollectHeadings";
import rehypeTableOfContents from "./rehypeTableOfContents";
import rehypeFormat from "rehype-format";
import rehypeHtmlStructure from "./rehypeHtmlStructure";
import rehypeShell from "./rehypeShell";
import remarkHeadings from "./remarkHeadings";
import remarkDirectiveBookmarks from "./remarkDirectiveBookmarks";
import remarkImage from "./remarkImage";
import remarkCode from "./remarkCode";
import remarkDirectiveAlert from "./remarkDirectiveAlert";
import remarkDirectiveAudio from "./remarkDirectiveAudio";
import remarkDirectiveCollapsible from "./remarkDirectiveCollapsible";
import remarkDirectiveArchive from "./remarkDirectiveArchive";
import remarkDirectiveDownload from "./remarkDirectiveDownload";
import remarkDirectiveEmbed from "./remarkDirectiveEmbed";
import remarkDirectiveProtect from "./remarkDirectiveProtect";
import remarkDirectiveQr from "./remarkDirectiveQr";
import remarkDirectiveExcalidraw from "./remarkDirectiveExcalidraw";
import remarkDirectiveScratchblock from "./remarkDirectiveScratchblock";
import remarkDirectiveMermaid from "./remarkDirectiveMermaid";
import remarkDirectivePlantuml from "./remarkDirectivePlantuml";
import remarkDirectiveOnlineIde from "./remarkDirectiveOnlineIde";
import remarkDirectiveStruktog from "./remarkDirectiveStruktog";
import remarkDirectiveTerm from "./remarkDirectiveTerm";
import remarkLink from "./remarkLink";
import remarkDirectivePagelist from "./remarkDirectivePagelist";
import rehypeQrCode from "./rehypeQrCode";
import rehypeShareDialog from "./rehypeShareDialog";
import rehypeDirectiveP5 from "./rehypeDirectiveP5";
import remarkCollectSearchDocuments from "./remarkCollectSearchDocuments";
import remarkDirectiveGeogebra from "./remarkDirectiveGeogebra";
import remarkDirectiveAbcMusic from "./remarkDirectiveAbcMusic";
import remarkDirectivePyide from "./remarkDirectivePyide";
import { i18n } from "./i18n";
import remarkDirectiveWebide from "./remarkDirectiveWebide";
import remarkDirectiveH5P from "./remarkDirectiveH5P";
import remarkDirectiveJSXGraph from "./remarkDirectiveJSXGraph";
import remarkDirectiveMultievent from "./remarkDirectiveMultievent";
import remarkDirectiveUnpack from "./remarkDirectiveUnpack";
import { makeTransformerCopyButton } from "./rehypePrettyCodeCopyButton";
import { remarkGithubEmoji } from "./remarkGithubEmoji";
import remarkParse from "./remarkParse";
import remarkSubSup from "./remarkSubSup";
import remarkImageAttrs from "./remarkImageAttrs";
import remarkDirectiveLearningmap from "./remarkDirectiveLearningmap";
import remarkDirectiveTextinput from "./remarkDirectiveTextinput";
import remarkDirectiveTypst from "./remarkDirectiveTypst";

export const remark = (ctx: HyperbookContext) => {
  i18n.init(ctx.config.language || "en");
  const remarkPlugins: PluggableList = [
    remarkRemoveComments,
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTabs(ctx),
    remarkDirectiveCollapsible(ctx),
    remarkDirectivePyide(ctx),
    remarkDirectiveWebide(ctx),
    remarkDirectiveOnlineIde(ctx),
    remarkDirectivePagelist(ctx),
    remarkLink(ctx),
    remarkImageAttrs(ctx),
    remarkImage(ctx),
    remarkGfm,
    remarkSubSup,
    remarkDirectiveTerm(ctx),
    remarkDirectiveEmbed(ctx),
    remarkDirectiveArchive(ctx),
    remarkDirectiveQr(ctx),
    remarkDirectiveDownload(ctx),
    remarkDirectiveAudio(ctx),
    remarkDirectiveAlert(ctx),
    remarkDirectiveBookmarks(ctx),
    remarkDirectiveVideo(ctx),
    remarkDirectiveYoutube(ctx),
    remarkDirectiveTiles(ctx),
    remarkDirectiveSqlIde(ctx),
    remarkDirectivePlantuml(ctx),
    remarkDirectiveSlideshow(ctx),
    remarkDirectiveScratchblock(ctx),
    remarkDirectiveMermaid(ctx),
    remarkDirectiveAbcMusic(ctx),
    remarkDirectiveExcalidraw(ctx),
    remarkDirectiveStruktog(ctx),
    remarkDirectiveGeogebra(ctx),
    remarkDirectiveH5P(ctx),
    remarkDirectiveJSXGraph(ctx),
    remarkDirectiveMultievent(ctx),
    remarkDirectiveLearningmap(ctx),
    remarkDirectiveTextinput(ctx),
    remarkDirectiveTypst(ctx),
    remarkCode(ctx),
    remarkMath,
    remarkGithubEmoji,
    /* needs to be last directive */
    remarkDirectiveProtect(ctx),
    /* needs to be after all directives */
    remarkDirectiveUnpack(ctx),
    remarkHeadings(ctx),
    remarkCollectHeadings(ctx),
    remarkCollectSearchDocuments(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype, {
      allowDangerousHtml: ctx.config.allowDangerousHtml || false,
      footnoteLabel: i18n.get("footnote-label"),
      footnoteBackLabel(referenceIndex: number, rereferenceIndex: number) {
        if (rereferenceIndex > 1) {
          return i18n.get("footnote-back-label-many", {
            index: `${referenceIndex + 1}`,
          });
        }
        return i18n.get("footnote-back-label-many", {
          from: `${referenceIndex + 1}`,
          to: `${rereferenceIndex}`,
        });
      },
    });
};

export const process = (md: string, ctx: HyperbookContext) => {
  i18n.init(ctx.config.language || "en");

  const rehypePlugins: PluggableList = [
    rehypeUnwrapImages,
    rehypeTableOfContents(ctx),
    rehypeQrCode(ctx),
    rehypeShareDialog(ctx),
    rehypeKatex,
    rehypeDirectiveP5(ctx),
    [
      rehypePrettyCode,
      {
        bypassInlineCode:
          ctx.config.elements?.code?.bypassInline == undefined
            ? false
            : ctx.config.elements?.code?.bypassInline,
        transformers: [
          makeTransformerCopyButton(ctx)({
            visibility: "always",
            feedbackDuration: 3_000,
          }),
        ],
        defaultLang: "plaintext",
        theme: ctx.config.elements?.code?.theme || {
          dark: `github-dark`,
          light: `github-light`,
        },
      },
    ],
    rehypeFormat,
  ];

  return remark(ctx)
    .use(rehypePlugins)
    .use(rehypeShell(ctx))
    .use(rehypeHtmlStructure(ctx))
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .process(md);
};
