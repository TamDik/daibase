import { describe, expect, it } from "vitest";

import {
  categoriesFromMarkdown,
  markdownBodyFromMarkdown,
  updateMarkdownBodyPreservingFrontmatter,
  updateMarkdownCategories,
} from "./pageCategories";

describe("pageCategories", () => {
  it("frontmatter のカテゴリ配列を読む", () => {
    expect(
      categoriesFromMarkdown("---\ncategories:\n  - Work\n  - Research\n---\n# Main\n"),
    ).toEqual(["Work", "Research"]);
  });

  it("comma 区切りのカテゴリを読む", () => {
    expect(categoriesFromMarkdown("---\ncategories: Work, Research\n---\n# Main\n")).toEqual([
      "Work",
      "Research",
    ]);
  });

  it("カテゴリを frontmatter に書き込む", () => {
    expect(updateMarkdownCategories("# Main\n", ["Work", "Research"])).toBe(
      "---\ncategories:\n  - Work\n  - Research\n---\n# Main\n",
    );
  });

  it("既存カテゴリだけを置き換える", () => {
    expect(
      updateMarkdownCategories("---\ntitle: Main\ncategories: Old\n---\n# Main\n", ["New"]),
    ).toBe("---\ntitle: Main\ncategories:\n  - New\n---\n# Main\n");
  });

  it("カテゴリが空ならカテゴリ行を削除する", () => {
    expect(updateMarkdownCategories("---\ncategories: Old\n---\n# Main\n", [])).toBe("# Main\n");
  });

  it("WYSIWYG 用に frontmatter を本文から分離する", () => {
    expect(markdownBodyFromMarkdown("---\ncategories:\n  - Work\n---\n# Main\n")).toBe("# Main\n");
  });

  it("WYSIWYG の本文変更を既存 frontmatter と合成する", () => {
    expect(
      updateMarkdownBodyPreservingFrontmatter(
        "---\ncategories:\n  - Work\n---\n# Main\n",
        "# Updated\n",
      ),
    ).toBe("---\ncategories:\n  - Work\n---\n# Updated\n");
  });
});
