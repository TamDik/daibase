import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownPreview } from "./MarkdownPreview";

describe("MarkdownPreview", () => {
  it("言語付きコードブロックにハイライト用の class を付与する", () => {
    const { container } = render(
      <MarkdownPreview
        existingPageLocations={new Set()}
        markdown={"```ts\nconst value = 1;\n```"}
        onOpenLocation={vi.fn()}
        onResolveMarkdownLink={vi.fn()}
      />,
    );

    const codeBlock = container.querySelector("pre code.hljs.language-ts");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock?.querySelector(".hljs-keyword")).toHaveTextContent("const");
  });
});
