import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentTree,
  FileHistoryEntry,
  ManagedFileContent,
  NamespaceSummary,
  PageContent,
} from "../api/tauriCommands";
import { HomePage } from "./HomePage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../api/tauriCommands", () => ({
  createNamespace: vi.fn(),
  listFileHistory: vi.fn(),
  listPageHistory: vi.fn(),
  listNamespaces: vi.fn(),
  openInitialLocation: vi.fn(),
  openLocation: vi.fn(),
  readPageHistorySnapshot: vi.fn(),
  resolveMarkdownLink: vi.fn(),
  resolveMarkdownLinkStatus: vi.fn(),
  savePage: vi.fn(),
  uploadFile: vi.fn(),
  writeFileNote: vi.fn(),
}));

const api = await import("../api/tauriCommands");

const workNamespace = namespace("ns-work", "Work");
const contentTree: ContentTree = {
  folders: [
    {
      path: "Pages/Guide.md",
      title: "Guide",
      location: "Work:Page:Guide",
      display_path: ["Guide"],
    },
    {
      path: "Pages/aaa.md",
      title: "aaa",
      location: "Work:Page:aaa",
      display_path: ["aaa"],
    },
  ],
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
  files: [
    {
      file_id: "file-logo",
      path: "Files/images/logo.png",
      title: "logo.png",
      location: "Work:File:images/logo.png",
      display_path: ["images", "logo.png"],
    },
  ],
};

describe("HomePage", () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.listNamespaces).mockReset();
    vi.mocked(api.listFileHistory).mockReset();
    vi.mocked(api.listPageHistory).mockReset();
    vi.mocked(api.openInitialLocation).mockReset();
    vi.mocked(api.openLocation).mockReset();
    vi.mocked(api.readPageHistorySnapshot).mockReset();
    vi.mocked(api.resolveMarkdownLink).mockReset();
    vi.mocked(api.resolveMarkdownLinkStatus).mockReset();
    vi.mocked(api.savePage).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.writeFileNote).mockReset();

    vi.mocked(api.listNamespaces).mockResolvedValue([workNamespace]);
    vi.mocked(api.listFileHistory).mockResolvedValue(fileHistoryEntries());
    vi.mocked(api.listPageHistory).mockResolvedValue(historyEntries());
    vi.mocked(api.readPageHistorySnapshot).mockResolvedValue({
      entry: historyEntries()[0],
      previous_content: "# Main\n\nBefore\n",
      content: "# Main\n\nAfter\n",
      diff_sections: [],
    });
    vi.mocked(api.savePage).mockImplementation(async (namespaceId, path, content) => ({
      namespace: workNamespace,
      location: page(path, content).location,
      content: contentTree,
      page: page(path, content),
      save: {
        namespace_id: namespaceId,
        file_id: "file-main",
        path,
        revision_id: "rev_saved",
        object_id: "sha256:saved",
        saved_at: "2026-01-01T00:00:00Z",
      },
    }));
    vi.mocked(api.uploadFile).mockImplementation(async (namespaceId, path) => ({
      namespace: workNamespace,
      location: managedFile(path, "説明").location,
      content: contentTree,
      file: managedFile(path, "説明"),
      save: {
        namespace_id: namespaceId,
        file_id: "file-logo",
        path,
        revision_id: "rev_file_saved",
        object_id: "sha256:file",
        saved_at: "2026-01-03T00:00:00Z",
      },
    }));
    vi.mocked(api.writeFileNote).mockImplementation(async (_namespaceId, path, note) =>
      managedFile(path, note),
    );
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
      if (location.startsWith("File:") || location.startsWith("Work:File:")) {
        const fileName = location.replace(/^Work:/, "").replace(/^File:/, "");
        return {
          kind: "file",
          namespace,
          location: `Work:File:${fileName}`,
          content: contentTree,
          file: managedFile(`Files/${fileName}`, "説明"),
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
    vi.mocked(api.resolveMarkdownLinkStatus).mockImplementation(
      async (_namespaceId, _path, target) => {
        return {
          location: `Work:Page:${target}`,
          exists: target === "Guide/Intro",
          is_internal: true,
        };
      },
    );
  });

  it("初期表示では Main ページを namespace 付きロケーションで表示する", async () => {
    renderHomePage();

    expect(await screen.findByDisplayValue("Work:Page:Main")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft)\n\n[Intro](Guide/Intro)",
    );
    expect(screen.getByRole("tab", { name: "閲覧" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "編集" })).not.toBeInTheDocument();
  });

  it("ロケーションバーで namespace を省略しても遷移後は完全ロケーションを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Page:Draft");
    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() => expect(locationInput).toHaveValue("Work:Page:Draft"));
    expect(screen.getByText("このページはまだ作成されていません。")).toBeInTheDocument();
  });

  it("サイドバーにページを階層構造で表示してクリックで遷移する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    expect(pageList).toHaveTextContent("Main");
    expect(pageList).toHaveTextContent("Guide");
    expect(pageList).toHaveTextContent("Intro");
    expect(within(pageList).getAllByText("aaa")).toHaveLength(1);
    expect(pageList).toHaveTextContent("bbb");
    expect(pageList).toHaveTextContent("Files");
    expect(pageList).toHaveTextContent("logo.png");

    const aaaItem = screen.getByRole("treeitem", { name: "aaa bbb" });
    await user.click(within(aaaItem).getByTestId("TreeViewCollapseIconIcon"));
    await waitForElementToBeRemoved(() => within(pageList).queryByText("bbb"));
    await user.click(within(aaaItem).getByTestId("TreeViewExpandIconIcon"));
    expect(within(pageList).getByText("bbb")).toBeInTheDocument();

    await user.click(within(pageList).getByText("Intro"));

    expect(await screen.findByDisplayValue("Work:Page:Guide/Intro")).toBeInTheDocument();
  });

  it("File ロケーションでファイル詳細を表示して説明を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "File:images/logo.png");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:File:images/logo.png")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "logo.png" })).toBeInTheDocument();
    const note = screen.getByRole("textbox", { name: "ファイル説明" });
    expect(note).toHaveValue("説明");

    await user.clear(note);
    await user.type(note, "新しい説明");
    await user.click(screen.getByRole("button", { name: "説明を保存" }));

    await waitFor(() =>
      expect(api.writeFileNote).toHaveBeenCalledWith(
        workNamespace.id,
        "Files/images/logo.png",
        "新しい説明",
      ),
    );
  });

  it("File ページからアップロードする", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.open).mockResolvedValue("/tmp/logo.png");
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "File:images/logo.png");
    await user.click(screen.getByRole("button", { name: "開く" }));
    await user.click(await screen.findByRole("button", { name: "置き換え" }));

    await waitFor(() =>
      expect(api.uploadFile).toHaveBeenCalledWith(
        workNamespace.id,
        "Files/images/logo.png",
        "/tmp/logo.png",
      ),
    );
  });

  it("テキストファイルの中身を File ページに表示する", async () => {
    vi.mocked(api.openLocation).mockResolvedValueOnce({
      kind: "file",
      namespace: workNamespace,
      location: "Work:File:notes/readme.txt",
      content: contentTree,
      file: {
        namespace_id: workNamespace.id,
        file_id: "file-readme",
        path: "Files/notes/readme.txt",
        title: "readme.txt",
        location: "Work:File:notes/readme.txt",
        note: "",
        content_type: "text/plain",
        text_content: "hello\nworld",
        data_url: null,
        size: 11,
        latest_revision_id: "rev_text_01",
        is_virtual: false,
      },
    });
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "File:notes/readme.txt");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByRole("heading", { name: "readme.txt" })).toBeInTheDocument();
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(screen.getByText(/hello\s+world/)).toBeInTheDocument();
  });

  it("サイドバーのフォルダークリックで未作成ページとして表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    const guideItem = screen.getByRole("treeitem", { name: "Guide Intro" });

    await user.click(within(guideItem).getByText("Guide"));

    expect(await screen.findByDisplayValue("Work:Page:Guide")).toBeInTheDocument();
    expect(screen.getByText("このページはまだ作成されていません。")).toBeInTheDocument();
    expect(pageList).toHaveTextContent("Intro");
  });

  it("サイドバーの幅をドラッグで変更できる", async () => {
    renderHomePage();

    await screen.findByRole("tree", { name: "ページ一覧" });
    const resizeHandle = screen.getByRole("separator", { name: "サイドバーの幅" });

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "280");

    fireEvent.pointerDown(resizeHandle, { clientX: 280 });
    fireEvent.pointerMove(window, { clientX: 360 });
    fireEvent.pointerUp(window);

    expect(resizeHandle).toHaveAttribute("aria-valuenow", "360");
  });

  it("Special:Pages を現在の namespace で表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

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
    renderHomePage();

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

  it("編集停止後に自動保存する", async () => {
    renderHomePage();

    const editor = await screen.findByRole("textbox", { name: "Markdown" });
    vi.useFakeTimers();
    fireEvent.change(editor, { target: { value: "# Updated" } });

    expect(api.savePage).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Pages/Main.md", "# Updated");
  });

  it("画面遷移前に未保存の編集を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const editor = await screen.findByRole("textbox", { name: "Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Moving");
    const locationInput = screen.getByDisplayValue("Work:Page:Main");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:Pages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() =>
      expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Pages/Main.md", "# Moving"),
    );
    expect(await screen.findByDisplayValue("Work:Special:Pages")).toBeInTheDocument();
  });

  it("ページの編集履歴を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("tab", { name: "履歴" }));

    expect(api.listPageHistory).toHaveBeenCalledWith(workNamespace.id, "Pages/Main.md");
    expect(await screen.findByRole("heading", { name: "編集履歴" })).toBeInTheDocument();
    expect(screen.queryByText("rev_02")).not.toBeInTheDocument();
    expect(screen.queryByText("sha256:second")).not.toBeInTheDocument();
    expect(screen.getByText("1234567890ab")).toHaveAttribute("title", "sha256:1234567890abcdef");
    expect(screen.getAllByText("modified / Pages/Main.md")).toHaveLength(2);
  });

  it("履歴行を選択すると履歴詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("tab", { name: "履歴" }));
    await user.click(await screen.findByRole("button", { name: /2026\/01\/02.*modified/ }));

    expect(await screen.findByTestId("current-route")).toHaveTextContent(
      "/history?namespaceId=ns-work&path=Pages%2FMain.md&revisionId=rev_02",
    );
  });
});

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
      <CurrentRoute />
    </MemoryRouter>,
  );
}

function CurrentRoute() {
  const location = useLocation();

  return (
    <div data-testid="current-route">
      {location.pathname}
      {location.search}
    </div>
  );
}

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

function historyEntries(): FileHistoryEntry[] {
  return [
    {
      revision_id: "rev_02",
      object_id: "sha256:1234567890abcdef",
      created_at: "2026-01-02T00:00:00Z",
      kind: "modified",
      path: "Pages/Main.md",
    },
    {
      revision_id: "rev_01",
      object_id: "sha256:first",
      created_at: "2026-01-01T00:00:00Z",
      kind: "modified",
      path: "Pages/Main.md",
    },
  ];
}

function fileHistoryEntries(): FileHistoryEntry[] {
  return [
    {
      revision_id: "rev_file_01",
      object_id: "sha256:file",
      created_at: "2026-01-03T00:00:00Z",
      kind: "modified",
      path: "Files/images/logo.png",
    },
  ];
}

function managedFile(path: string, note: string): ManagedFileContent {
  return {
    namespace_id: workNamespace.id,
    file_id: "file-logo",
    path,
    title: lastPathPart(path),
    location: `Work:File:${path.replace(/^Files\//, "")}`,
    note,
    content_type: "image/png",
    text_content: null,
    data_url: "data:image/png;base64,aW1hZ2U=",
    size: 1234,
    latest_revision_id: "rev_file_01",
    is_virtual: false,
  };
}

function lastPathPart(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}
