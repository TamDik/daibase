import {
  cleanup,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
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
  openInitialLocation: vi.fn(),
  openLocation: vi.fn(),
  resolveMarkdownLink: vi.fn(),
  savePage: vi.fn(),
}));

const api = await import("../api/tauriCommands");

const workNamespace = namespace("ns-work", "Work");
const contentTree: ContentTree = {
  pages: [
    {
      file_id: "file-main",
      path: "Pages/Main.md",
      title: "Main",
      location: "Work:Page:Main",
      display_path: ["Main"],
    },
    {
      file_id: "file-guide",
      path: "Pages/Guide/Intro.md",
      title: "Intro",
      location: "Work:Page:Guide/Intro",
      display_path: ["Guide", "Intro"],
    },
    {
      file_id: "file-aaa",
      path: "Pages/aaa.md",
      title: "aaa",
      location: "Work:Page:aaa",
      display_path: ["aaa"],
    },
    {
      file_id: "file-aaa-bbb",
      path: "Pages/aaa/bbb.md",
      title: "bbb",
      location: "Work:Page:aaa/bbb",
      display_path: ["aaa", "bbb"],
    },
  ],
};

describe("HomePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.listNamespaces).mockReset();
    vi.mocked(api.openInitialLocation).mockReset();
    vi.mocked(api.openLocation).mockReset();
    vi.mocked(api.resolveMarkdownLink).mockReset();
    vi.mocked(api.savePage).mockReset();

    vi.mocked(api.listNamespaces).mockResolvedValue([workNamespace]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Page:Main",
      content: contentTree,
      page: page("Pages/Main.md", "# Main\n\n[Draft](Draft)\n\n[Intro](Guide/Intro)"),
    });
    vi.mocked(api.openLocation).mockImplementation(async (location, sourceNamespaceId) => {
      const namespace = sourceNamespaceId === workNamespace.id ? workNamespace : workNamespace;
      if (location === "Special:Namespaces") {
        return {
          kind: "specialNamespaces",
          location: "Special:Namespaces",
          namespaces: [workNamespace],
        };
      }
      if (location === "Special:SpecialPages" || location === "Work:Special:SpecialPages") {
        return {
          kind: "specialPages",
          namespace,
          location: "Work:Special:SpecialPages",
          content: contentTree,
          pages: [
            {
              title: "Special Pages",
              description: "全ての Special ページを表示します。",
              location: "Work:Special:SpecialPages",
            },
            {
              title: "Namespaces",
              description: "登録済み namespace の確認と新規作成を行います。",
              location: "Special:Namespaces",
            },
            {
              title: "Pages",
              description: "namespace 内の全ページを表示します。",
              location: "Work:Special:Pages",
            },
          ],
        };
      }
      if (location === "Special:Pages" || location === "Work:Special:Pages") {
        return {
          kind: "specialPagesList",
          namespace,
          location: "Work:Special:Pages",
          content: contentTree,
        };
      }
      const pageName = location.replace(/^Work:/, "").replace(/^Page:/, "");
      const path = `Pages/${pageName}.md`;
      return {
        kind: "page",
        namespace,
        location: `Work:Page:${pageName}`,
        content: contentTree,
        page:
          path === "Pages/Main.md"
            ? page(path, "# Main\n\n[Draft](Draft)\n\n[Intro](Guide/Intro)")
            : {
                namespace_id: namespace.id,
                file_id: "",
                path,
                title: lastPathPart(pageName),
                location: `Work:Page:${pageName}`,
                content: "",
                latest_revision_id: null,
                is_virtual: true,
              },
      };
    });
    vi.mocked(api.resolveMarkdownLink).mockImplementation(async (_namespaceId, _path, target) => {
      return `Work:Page:${target}`;
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

  it("内部リンクが既存ページか未作成ページかを表示で区別する", async () => {
    render(<HomePage />);

    const missingLink = await screen.findByRole("link", { name: "Draft" });
    const existingLink = await screen.findByRole("link", { name: "Intro" });

    await waitFor(() => {
      expect(missingLink).toHaveAttribute("data-page-exists", "false");
      expect(existingLink).toHaveAttribute("data-page-exists", "true");
    });
    expect(missingLink).toHaveStyle({ textDecorationStyle: "dashed" });
  });

  it("サイドバーにページを階層構造で表示してクリックで遷移する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    expect(pageList).toHaveTextContent("Main");
    expect(pageList).toHaveTextContent("Guide");
    expect(pageList).toHaveTextContent("Intro");
    expect(within(pageList).getAllByText("aaa")).toHaveLength(1);
    expect(pageList).toHaveTextContent("bbb");

    const aaaItem = screen.getByRole("treeitem", { name: "aaa bbb" });
    await user.click(within(aaaItem).getByTestId("TreeViewCollapseIconIcon"));
    await waitForElementToBeRemoved(() => within(pageList).queryByText("bbb"));
    await user.click(within(aaaItem).getByTestId("TreeViewExpandIconIcon"));
    expect(within(pageList).getByText("bbb")).toBeInTheDocument();

    await user.click(within(pageList).getByText("Intro"));

    expect(await screen.findByDisplayValue("Work:Page:Guide/Intro")).toBeInTheDocument();
  });

  it("Special:Pages を現在の namespace で表示する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:Pages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:Special:Pages")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByText("Work:Page:Guide/Intro")).toBeInTheDocument();
  });

  it("Special:SpecialPages で全ての Special ページを表示する", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:SpecialPages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:Special:SpecialPages")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Special Pages" })).toBeInTheDocument();
    expect(screen.getByText(/全ての Special ページを表示します。/)).toBeInTheDocument();
    expect(screen.getByText(/登録済み namespace の確認と新規作成を行います。/)).toBeInTheDocument();
    expect(screen.getAllByText("Pages").length).toBeGreaterThan(0);
    expect(screen.getByText("namespace 内の全ページを表示します。")).toBeInTheDocument();
    expect(screen.queryByText(/Work namespace/)).not.toBeInTheDocument();
  });

  it("保存完了メッセージはページ内 Alert ではなく Snackbar として表示する", async () => {
    const user = userEvent.setup();
    vi.mocked(api.savePage).mockResolvedValue({
      namespace: workNamespace,
      location: "Work:Page:Main",
      content: contentTree,
      page: page("Pages/Main.md", "# Updated"),
      save: {
        namespace_id: workNamespace.id,
        file_id: "file-main",
        path: "Pages/Main.md",
        revision_id: "rev_saved",
        object_id: "sha256:saved",
        saved_at: "2026-01-01T00:00:00Z",
      },
    });

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
    default_location: `${name}:Page:Main`,
    pages_location: `${name}:Special:Pages`,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function page(path: string, content: string): PageContent {
  return {
    namespace_id: workNamespace.id,
    file_id: `file-${path}`,
    path,
    title: lastPathPart(path.replace(/^Pages\//, "").replace(/\.md$/, "")),
    location: `Work:Page:${path.replace(/^Pages\//, "").replace(/\.md$/, "")}`,
    content,
    latest_revision_id: "rev_01",
    is_virtual: false,
  };
}

function lastPathPart(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}
