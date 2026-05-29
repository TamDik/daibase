import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentTree, NamespaceSummary, PageContent } from "../api/tauriCommands";
import { HomePage } from "./HomePage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../api/tauriCommands", () => ({
  createNamespace: vi.fn(),
  listNamespaces: vi.fn(),
  openNamespace: vi.fn(),
  readPage: vi.fn(),
  writePage: vi.fn(),
}));

const api = await import("../api/tauriCommands");

const workNamespace = namespace("ns-work", "Work");
const contentTree: ContentTree = {
  pages: [
    { file_id: "file-main", path: "Pages/Main.md" },
    { file_id: "file-guide", path: "Pages/Guide/Intro.md" },
  ],
};

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.listNamespaces).mockReset();
    vi.mocked(api.openNamespace).mockReset();
    vi.mocked(api.readPage).mockReset();
    vi.mocked(api.writePage).mockReset();

    vi.mocked(api.listNamespaces).mockResolvedValue([workNamespace]);
    vi.mocked(api.openNamespace).mockResolvedValue({
      namespace: workNamespace,
      content: contentTree,
    });
    vi.mocked(api.readPage).mockImplementation(async (_namespaceId, path) => {
      if (path === "Pages/Main.md") {
        return page(path, "# Main\n\n[Draft](Draft)");
      }

      throw new Error("ページが見つかりません");
    });
  });

  it("初期表示では Main ページを namespace 付きロケーションで表示する", async () => {
    render(<HomePage />);

    expect(await screen.findByDisplayValue("Work:Page:Main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Draft" })).toBeInTheDocument();
  });

  it("ロケーションバーで namespace を省略しても遷移後は完全ロケーションを表示する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Page:Draft");
    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() => expect(locationInput).toHaveValue("Work:Page:Draft"));
    expect(screen.getByText("このページはまだ作成されていません。")).toBeInTheDocument();
  });

  it("存在しない Markdown リンクをクリックすると未作成ページとして表示する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    await user.click(await screen.findByRole("link", { name: "Draft" }));

    expect(await screen.findByDisplayValue("Work:Page:Draft")).toBeInTheDocument();
    expect(screen.getByText("このページはまだ作成されていません。")).toBeInTheDocument();
  });

  it("Special:AllPages を現在の namespace で表示する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:AllPages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:Special:AllPages")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Pages" })).toBeInTheDocument();
    expect(screen.getByText("Work:Page:Guide/Intro")).toBeInTheDocument();
  });

  it("保存完了メッセージはページ内 Alert ではなく Snackbar として表示する", async () => {
    const user = userEvent.setup();
    vi.mocked(api.writePage).mockResolvedValue({
      namespace_id: workNamespace.id,
      file_id: "file-main",
      path: "Pages/Main.md",
      revision_id: "rev_saved",
      object_id: "sha256:saved",
      saved_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(api.readPage)
      .mockResolvedValueOnce(page("Pages/Main.md", "# Main\n\n[Draft](Draft)"))
      .mockResolvedValueOnce(page("Pages/Main.md", "# Updated"));

    render(<HomePage />);

    await user.click(await screen.findByRole("button", { name: "編集" }));
    const editor = screen.getByRole("textbox", { name: "Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Updated");
    await user.click(screen.getByRole("button", { name: "保存" }));

    const snackbar = await screen.findByRole("alert");
    expect(snackbar).toHaveTextContent("保存しました");
    expect(snackbar).not.toHaveTextContent("rev_saved");
    expect(snackbar.closest(".MuiSnackbar-root")).not.toBeNull();
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

function page(path: string, content: string): PageContent {
  return {
    namespace_id: workNamespace.id,
    file_id: `file-${path}`,
    path,
    content,
    latest_revision_id: "rev_01",
  };
}
