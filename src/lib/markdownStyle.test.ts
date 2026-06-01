import { describe, expect, it } from "vitest";

import { buildMarkdownPreviewSx, resolveMarkdownPreviewStyleConfig } from "./markdownStyle";

describe("markdownStyle", () => {
  it("Markdown 表示スタイルを部分的に上書きできる", () => {
    const style = resolveMarkdownPreviewStyleConfig({
      content: {
        maxWidth: 720,
      },
      codeBlock: {
        backgroundColor: "#101820",
      },
      syntax: {
        keyword: "#ff3366",
      },
    });

    expect(style.content.maxWidth).toBe(720);
    expect(style.content.lineHeight).toBe(1.75);
    expect(style.codeBlock.backgroundColor).toBe("#101820");
    expect(style.codeBlock.borderColor).toBe("#d8dee4");
    expect(style.syntax.keyword).toBe("#ff3366");
    expect(style.syntax.string).toBe("#0a3069");
  });

  it("設定値から Markdown 表示用 sx を組み立てる", () => {
    const style = resolveMarkdownPreviewStyleConfig({
      blockquote: {
        borderColor: "#123456",
      },
      inlineCode: {
        textColor: "#abcdef",
      },
    });

    const sx = buildMarkdownPreviewSx(style);

    expect(sx).toMatchObject({
      maxWidth: 880,
      "& blockquote": {
        borderLeft: "4px solid #123456",
      },
      "& code": {
        color: "#abcdef",
      },
    });
  });
});
