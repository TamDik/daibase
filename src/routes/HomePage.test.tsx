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
  resolveMarkdownImage: vi.fn(),
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
      path: "Guide.md",
      title: "Guide",
      location: "Work:Guide.md",
      display_path: ["Guide"],
    },
    {
      path: "aaa.md",
      title: "aaa",
      location: "Work:aaa.md",
      display_path: ["aaa"],
    },
  ],
  pages: [
    {
      file_id: "file-main",
      path: "Main.md",
      title: "Main",
      location: "Work:Main.md",
      display_path: ["Main"],
    },
    {
      file_id: "file-guide",
      path: "Guide/Intro.md",
      title: "Intro",
      location: "Work:Guide/Intro.md",
      display_path: ["Guide", "Intro"],
    },
    {
      file_id: "file-aaa",
      path: "aaa.md",
      title: "aaa",
      location: "Work:aaa.md",
      display_path: ["aaa"],
    },
    {
      file_id: "file-aaa-bbb",
      path: "aaa/bbb.md",
      title: "bbb",
      location: "Work:aaa/bbb.md",
      display_path: ["aaa", "bbb"],
    },
  ],
  files: [
    {
      file_id: "file-logo",
      path: "images/logo.png",
      title: "logo.png",
      location: "Work:images/logo.png",
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
    vi.mocked(api.resolveMarkdownImage).mockReset();
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
      location: "Work:Main.md",
      content: contentTree,
      page: page("Main.md", "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)"),
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
      const contentPath = location.replace(/^Work:/, "");
      if (!contentPath.endsWith(".md") && !contentPath.startsWith("Special:")) {
        return {
          kind: "file",
          namespace,
          location: `Work:${contentPath}`,
          content: contentTree,
          file: managedFile(contentPath, "説明"),
        };
      }
      const path = contentPath;
      const pageName = path.replace(/\.md$/, "");
      return {
        kind: "page",
        namespace,
        location: `Work:${path}`,
        content: contentTree,
        page:
          path === "Main.md"
            ? page(path, "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)")
            : {
                namespace_id: namespace.id,
                file_id: "",
                path,
                title: lastPathPart(pageName),
                location: `Work:${path}`,
                content: "",
                latest_revision_id: null,
                is_virtual: true,
              },
      };
    });
    vi.mocked(api.resolveMarkdownLink).mockImplementation(async (_namespaceId, _path, target) => {
      return `Work:${target}`;
    });
    vi.mocked(api.resolveMarkdownImage).mockResolvedValue({
      location: "Work:images/logo.png",
      exists: true,
      is_internal: true,
      is_image: true,
      content_type: "image/png",
      data_url: "data:image/png;base64,aW1hZ2U=",
    });
    vi.mocked(api.resolveMarkdownLinkStatus).mockImplementation(
      async (_namespaceId, _path, target) => {
        return {
          location: `Work:${target}`,
          exists: target === "Guide/Intro.md",
          is_internal: true,
        };
      },
    );
  });

  it("初期表示では Main ページを namespace 付きロケーションで表示する", async () => {
    renderHomePage();

    expect(await screen.findByDisplayValue("Work:Main.md")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
    expect(screen.getByRole("tab", { name: "閲覧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "WYSIWYG" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Markdownソース" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Markdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "編集" })).not.toBeInTheDocument();
  });

  it("Markdown ソース表示で本文を編集できる", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByDisplayValue("Work:Main.md");
    await user.click(screen.getByRole("button", { name: "Markdownソース" }));
    const rawEditor = screen.getByRole("textbox", { name: "Markdownソース" });
    expect(rawEditor).toHaveValue("# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)");

    await user.clear(rawEditor);
    await user.type(rawEditor, "# Raw");
    await user.click(screen.getByRole("button", { name: "WYSIWYG" }));

    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue("# Raw");
  });

  it("ロケーションバーで namespace を省略しても遷移後は完全ロケーションを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "Draft.md");
    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() => expect(locationInput).toHaveValue("Work:Draft.md"));
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
    expect(pageList).toHaveTextContent("logo.png");

    const aaaItem = screen.getByRole("treeitem", { name: "aaa bbb" });
    await user.click(within(aaaItem).getByTestId("TreeViewCollapseIconIcon"));
    await waitForElementToBeRemoved(() => within(pageList).queryByText("bbb"));
    await user.click(within(aaaItem).getByTestId("TreeViewExpandIconIcon"));
    expect(within(pageList).getByText("bbb")).toBeInTheDocument();

    await user.click(within(pageList).getByText("Intro"));

    expect(await screen.findByDisplayValue("Work:Guide/Intro.md")).toBeInTheDocument();
  });

  it("File ロケーションでファイル詳細を表示して説明を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "images/logo.png");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:images/logo.png")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "logo.png" })).toBeInTheDocument();
    const note = screen.getByRole("textbox", { name: "ファイル説明" });
    expect(note).toHaveValue("説明");

    await user.clear(note);
    await user.type(note, "新しい説明");
    await user.click(screen.getByRole("button", { name: "説明を保存" }));

    await waitFor(() =>
      expect(api.writeFileNote).toHaveBeenCalledWith(
        workNamespace.id,
        "images/logo.png",
        "新しい説明",
      ),
    );
  });

  it("File ページからアップロードする", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.open).mockResolvedValue("/tmp/logo.png");
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "images/logo.png");
    await user.click(screen.getByRole("button", { name: "開く" }));
    await user.click(await screen.findByRole("button", { name: "置き換え" }));

    await waitFor(() =>
      expect(api.uploadFile).toHaveBeenCalledWith(
        workNamespace.id,
        "images/logo.png",
        "/tmp/logo.png",
      ),
    );
  });

  it("テキストファイルの中身を File ページに表示する", async () => {
    vi.mocked(api.openLocation).mockResolvedValueOnce({
      kind: "file",
      namespace: workNamespace,
      location: "Work:notes/readme.txt",
      content: contentTree,
      file: {
        namespace_id: workNamespace.id,
        file_id: "file-readme",
        path: "notes/readme.txt",
        title: "readme.txt",
        location: "Work:notes/readme.txt",
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

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "notes/readme.txt");
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

    expect(await screen.findByDisplayValue("Work:Guide.md")).toBeInTheDocument();
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

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:Pages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    expect(await screen.findByDisplayValue("Work:Special:Pages")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByText("Work:Guide/Intro.md")).toBeInTheDocument();
  });

  it("Special:SpecialPages で全ての Special ページを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const locationInput = await screen.findByDisplayValue("Work:Main.md");
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

    expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Main.md", "# Updated");
  });

  it("Markdown ソース表示でも編集停止後に自動保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByDisplayValue("Work:Main.md");
    await user.click(screen.getByRole("button", { name: "Markdownソース" }));
    const editor = screen.getByRole("textbox", { name: "Markdownソース" });
    vi.useFakeTimers();
    fireEvent.change(editor, { target: { value: "# Raw Updated" } });

    expect(api.savePage).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Main.md", "# Raw Updated");
  });

  it("画面遷移前に未保存の編集を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const editor = await screen.findByRole("textbox", { name: "Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Moving");
    const locationInput = screen.getByDisplayValue("Work:Main.md");
    await user.clear(locationInput);
    await user.type(locationInput, "Special:Pages");
    await user.click(screen.getByRole("button", { name: "開く" }));

    await waitFor(() =>
      expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Main.md", "# Moving"),
    );
    expect(await screen.findByDisplayValue("Work:Special:Pages")).toBeInTheDocument();
  });

  it("ページの編集履歴を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("tab", { name: "履歴" }));

    expect(api.listPageHistory).toHaveBeenCalledWith(workNamespace.id, "Main.md");
    expect(await screen.findByRole("heading", { name: "編集履歴" })).toBeInTheDocument();
    expect(screen.queryByText("rev_02")).not.toBeInTheDocument();
    expect(screen.queryByText("sha256:second")).not.toBeInTheDocument();
    expect(screen.getByText("1234567890ab")).toHaveAttribute("title", "sha256:1234567890abcdef");
    expect(screen.getAllByText("modified / Main.md")).toHaveLength(2);
  });

  it("履歴行を選択すると履歴詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("tab", { name: "履歴" }));
    await user.click(await screen.findByRole("button", { name: /2026\/01\/02.*modified/ }));

    expect(await screen.findByTestId("current-route")).toHaveTextContent(
      "/history?namespaceId=ns-work&path=Main.md&revisionId=rev_02",
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
    default_page: "Main.md",
    default_location: `${name}:Main.md`,
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
    title: lastPathPart(path.replace(/\.md$/, "")),
    location: `Work:${path}`,
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
      path: "Main.md",
    },
    {
      revision_id: "rev_01",
      object_id: "sha256:first",
      created_at: "2026-01-01T00:00:00Z",
      kind: "modified",
      path: "Main.md",
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
      path: "images/logo.png",
    },
  ];
}

function managedFile(path: string, note: string): ManagedFileContent {
  return {
    namespace_id: workNamespace.id,
    file_id: "file-logo",
    path,
    title: lastPathPart(path),
    location: `Work:${path}`,
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
