import { describe, expect, it } from "vitest";

import type { NamespaceSummary } from "../api/tauriCommands";
import {
  normalizePagePath,
  pageLocation,
  pageTitle,
  resolveLocation,
  resolveMarkdownLink,
} from "./location";

const mainNamespace = namespace("ns-main", "Main");
const workNamespace = namespace("ns-work", "Work");
const namespaces = [mainNamespace, workNamespace];

describe("resolveLocation", () => {
  it("namespace 省略の Page ロケーションを参照元 namespace で補完する", () => {
    expect(resolveLocation("Page:Notes", namespaces, workNamespace)).toEqual({
      kind: "page",
      namespace: workNamespace,
      pagePath: "Pages/Notes.md",
      location: "Work:Page:Notes",
    });
  });

  it("単独のページ名を参照元 namespace の Page として扱う", () => {
    expect(resolveLocation("Notes", namespaces, mainNamespace)).toEqual({
      kind: "page",
      namespace: mainNamespace,
      pagePath: "Pages/Notes.md",
      location: "Main:Page:Notes",
    });
  });

  it("明示された namespace を優先して完全な Page ロケーションへ正規化する", () => {
    expect(resolveLocation("Work:Page:Notes", namespaces, mainNamespace)).toEqual({
      kind: "page",
      namespace: workNamespace,
      pagePath: "Pages/Notes.md",
      location: "Work:Page:Notes",
    });
  });

  it("Special:Namespaces は namespace に依存しない特殊ページとして扱う", () => {
    expect(resolveLocation("Special:Namespaces", namespaces, workNamespace)).toEqual({
      kind: "specialNamespaces",
      location: "Special:Namespaces",
    });
  });

  it("namespace 省略の Special:SpecialPages を参照元 namespace で補完する", () => {
    expect(resolveLocation("Special:SpecialPages", namespaces, workNamespace)).toEqual({
      kind: "specialPages",
      namespace: workNamespace,
      location: "Work:Special:SpecialPages",
    });
  });

  it("namespace 省略の Special:Pages を参照元 namespace で補完する", () => {
    expect(resolveLocation("Special:Pages", namespaces, workNamespace)).toEqual({
      kind: "specialPagesList",
      namespace: workNamespace,
      location: "Work:Special:Pages",
    });
  });

  it("存在しない namespace はエラーにする", () => {
    expect(() => resolveLocation("Unknown:Page:Main", namespaces, mainNamespace)).toThrow(
      "ネームスペースが見つかりません: Unknown",
    );
  });

  it("補完元 namespace がない場合はエラーにする", () => {
    expect(() => resolveLocation("Page:Main", namespaces, null)).toThrow(
      "ネームスペースを選択してください。",
    );
  });
});

describe("page path helpers", () => {
  it("Pages 配下の Markdown パスへ正規化する", () => {
    expect(normalizePagePath("Page:Guide/Intro.md")).toBe("Pages/Guide/Intro.md");
  });

  it("ページパスを namespace 付きロケーションへ変換する", () => {
    expect(pageLocation("Pages/Guide/Intro.md", workNamespace)).toBe("Work:Page:Guide/Intro");
  });

  it("ページタイトルは末尾のページ名を返す", () => {
    expect(pageTitle("Pages/Guide/Intro.md")).toBe("Intro");
  });
});

describe("resolveMarkdownLink", () => {
  it("通常の Markdown リンクを同じ namespace の完全ロケーションへ変換する", () => {
    expect(resolveMarkdownLink(workNamespace, "Pages/Guide/Intro.md", "Install")).toBe(
      "Work:Page:Guide/Install",
    );
  });

  it("相対パスの . と .. を解決する", () => {
    expect(resolveMarkdownLink(workNamespace, "Pages/Guide/Intro/Start.md", "../Install")).toBe(
      "Work:Page:Guide/Install",
    );
  });

  it("fragment と query はページ解決時に取り除く", () => {
    expect(
      resolveMarkdownLink(workNamespace, "Pages/Guide/Intro.md", "Install?tab=mac#setup"),
    ).toBe("Work:Page:Guide/Install");
  });

  it("Page/Special 形式のリンクは navigate 側で解決できるようそのまま返す", () => {
    expect(resolveMarkdownLink(workNamespace, "Pages/Guide/Intro.md", "Page:Main")).toBe(
      "Page:Main",
    );
    expect(
      resolveMarkdownLink(workNamespace, "Pages/Guide/Intro.md", "Main:Special:Pages"),
    ).toBe("Main:Special:Pages");
  });
});

function namespace(id: string, name: string): NamespaceSummary {
  return {
    id,
    name,
    root_path: `/tmp/${name}`,
    default_page: "Pages/Main.md",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}
