import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

export const markdownParser = unified().use(remarkParse).use(remarkGfm).freeze();

export const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkStringify, {
    bullet: "-",
    emphasis: "*",
    strong: "*",
    fence: "`",
    fences: true,
    listItemIndent: "one",
    rule: "-",
    ruleRepetition: 3,
  })
  .freeze();
