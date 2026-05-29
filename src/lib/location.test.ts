import { describe, expect, it } from "vitest";

import type { NamespaceSummary } from "../api/tauriCommands";
import { pageLocation, pageTitle } from "./location";

const workNamespace = namespace("ns-work", "Work");

describe("page path helpers", () => {
  it("ページパスを namespace 付きロケーションへ変換する", () => {
    expect(pageLocation("Pages/Guide/Intro.md", workNamespace)).toBe("Work:Page:Guide/Intro");
  });

  it("ページタイトルは末尾のページ名を返す", () => {
    expect(pageTitle("Pages/Guide/Intro.md")).toBe("Intro");
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
