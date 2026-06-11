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
  InstalledPluginSummary,
  ManagedFileContent,
  NamespaceSummary,
  PageContent,
  SearchContentResult,
} from "../api/tauriCommands";
import { HomePage } from "./HomePage";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../api/tauriCommands", () => ({
  createFolder: vi.fn(),
  createNamespace: vi.fn(),
  deleteFile: vi.fn(),
  deleteFolder: vi.fn(),
  deletePage: vi.fn(),
  installPluginFromFolder: vi.fn(),
  listDeletedContent: vi.fn(),
  listFavoriteContent: vi.fn(),
  listFileHistory: vi.fn(),
  listPageHistory: vi.fn(),
  listPlugins: vi.fn(),
  listNamespaces: vi.fn(),
  openInitialLocation: vi.fn(),
  openLocation: vi.fn(),
  readPage: vi.fn(),
  readPluginDocumentation: vi.fn(),
  readDeletedFile: vi.fn(),
  readDeletedPage: vi.fn(),
  readPageHistorySnapshot: vi.fn(),
  removePlugin: vi.fn(),
  resolvePluginMain: vi.fn(),
  resolveMarkdownLink: vi.fn(),
  resolveMarkdownImage: vi.fn(),
  resolveMarkdownLinkStatus: vi.fn(),
  restoreDeletedContent: vi.fn(),
  savePage: vi.fn(),
  searchContent: vi.fn(),
  setFavoriteContent: vi.fn(),
  setPluginEnabled: vi.fn(),
  uploadFile: vi.fn(),
  writeFileNote: vi.fn(),
}));

const api = await import("../api/tauriCommands");

const workNamespace = namespace("ns-work", "Work");
const contentTree: ContentTree = {
  folders: [],
  pages: [
    {
      file_id: "file-main",
      path: "Main.md",
      title: "Main",
      location: "Work:Main.md",
      display_path: ["Main"],
      is_favorite: false,
    },
    {
      file_id: "file-guide",
      path: "Guide/Intro.md",
      title: "Intro",
      location: "Work:Guide/Intro.md",
      display_path: ["Guide", "Intro"],
      is_favorite: true,
    },
    {
      file_id: "file-aaa",
      path: "aaa.md",
      title: "aaa",
      location: "Work:aaa.md",
      display_path: ["aaa"],
      is_favorite: false,
    },
    {
      file_id: "file-aaa-bbb",
      path: "aaa/bbb.md",
      title: "bbb",
      location: "Work:aaa/bbb.md",
      display_path: ["aaa", "bbb"],
      is_favorite: false,
    },
  ],
  files: [
    {
      file_id: "file-logo",
      path: "images/logo.png",
      title: "logo.png",
      location: "Work:images/logo.png",
      display_path: ["images", "logo.png"],
      is_favorite: false,
    },
    {
      file_id: "file-readme",
      path: "notes/readme.txt",
      title: "readme.txt",
      location: "Work:notes/readme.txt",
      display_path: ["notes", "readme.txt"],
      is_favorite: false,
    },
  ],
};

describe("HomePage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(api.createFolder).mockReset();
    vi.mocked(api.deleteFile).mockReset();
    vi.mocked(api.deleteFolder).mockReset();
    vi.mocked(api.deletePage).mockReset();
    vi.mocked(api.installPluginFromFolder).mockReset();
    vi.mocked(api.listDeletedContent).mockReset();
    vi.mocked(api.listFavoriteContent).mockReset();
    vi.mocked(api.listPlugins).mockReset();
    vi.mocked(api.listNamespaces).mockReset();
    vi.mocked(api.listFileHistory).mockReset();
    vi.mocked(api.listPageHistory).mockReset();
    vi.mocked(api.openInitialLocation).mockReset();
    vi.mocked(api.openLocation).mockReset();
    vi.mocked(api.readPluginDocumentation).mockReset();
    vi.mocked(api.readDeletedFile).mockReset();
    vi.mocked(api.readDeletedPage).mockReset();
    vi.mocked(api.readPageHistorySnapshot).mockReset();
    vi.mocked(api.removePlugin).mockReset();
    vi.mocked(api.resolvePluginMain).mockReset();
    vi.mocked(api.resolveMarkdownLink).mockReset();
    vi.mocked(api.resolveMarkdownImage).mockReset();
    vi.mocked(api.resolveMarkdownLinkStatus).mockReset();
    vi.mocked(api.restoreDeletedContent).mockReset();
    vi.mocked(api.savePage).mockReset();
    vi.mocked(api.searchContent).mockReset();
    vi.mocked(api.setFavoriteContent).mockReset();
    vi.mocked(api.setPluginEnabled).mockReset();
    vi.mocked(api.uploadFile).mockReset();
    vi.mocked(api.writeFileNote).mockReset();

    vi.mocked(api.listNamespaces).mockResolvedValue([workNamespace]);
    vi.mocked(api.listDeletedContent).mockResolvedValue(deletedContentItems());
    vi.mocked(api.listFavoriteContent).mockResolvedValue(favoriteContentItems());
    vi.mocked(api.listPlugins).mockResolvedValue(pluginItems());
    vi.mocked(api.listFileHistory).mockResolvedValue(fileHistoryEntries());
    vi.mocked(api.listPageHistory).mockResolvedValue(historyEntries());
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.readPluginDocumentation).mockResolvedValue({
      plugin_id: "com.example.calendar",
      path: "/tmp/calendar-plugin/README.md",
      markdown: "# Calendar Plugin\n\nUse `daibase.view: calendar`.",
    });
    vi.mocked(api.removePlugin).mockResolvedValue(undefined);
    vi.mocked(api.readPageHistorySnapshot).mockResolvedValue({
      entry: historyEntries()[0],
      previous_content: "# Main\n\nBefore\n",
      content: "# Main\n\nAfter\n",
      diff_sections: [],
    });
    vi.mocked(api.readDeletedPage).mockResolvedValue({
      ...page("Old.md", "# Old\n\n削除済み本文"),
      file_id: "file-old-page",
      latest_revision_id: "rev_deleted_page",
      is_virtual: true,
    });
    vi.mocked(api.readDeletedFile).mockResolvedValue({
      ...managedFile("images/old-logo.png", ""),
      file_id: "file-old-logo",
      latest_revision_id: "rev_deleted_file",
      is_virtual: true,
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
    vi.mocked(api.searchContent).mockResolvedValue(searchResults());
    vi.mocked(api.setFavoriteContent).mockImplementation(
      async (_namespaceId, path, isFavorite) => ({
        namespace: workNamespace,
        content: favoriteContentTree(path, isFavorite),
      }),
    );
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
    vi.mocked(api.createFolder).mockImplementation(async (_namespaceId, path) => ({
      namespace: workNamespace,
      content: {
        ...contentTree,
        folders: [
          ...contentTree.folders,
          {
            path,
            title: lastPathPart(path),
            display_path: path.split("/"),
          },
        ],
      },
    }));
    vi.mocked(api.deletePage).mockImplementation(async (_namespaceId, path) => ({
      namespace: workNamespace,
      content: {
        ...contentTree,
        pages: contentTree.pages.filter((page) => page.path !== path),
      },
    }));
    vi.mocked(api.deleteFile).mockImplementation(async (_namespaceId, path) => ({
      namespace: workNamespace,
      content: {
        ...contentTree,
        files: contentTree.files.filter((file) => file.path !== path),
      },
    }));
    vi.mocked(api.deleteFolder).mockImplementation(async (_namespaceId, path) => ({
      namespace: workNamespace,
      content: {
        ...contentTree,
        pages: contentTree.pages.filter((page) => !page.path.startsWith(`${path}/`)),
        files: contentTree.files.filter((file) => !file.path.startsWith(`${path}/`)),
      },
    }));
    vi.mocked(api.restoreDeletedContent).mockResolvedValue({
      namespace: workNamespace,
      content: {
        ...contentTree,
        pages: [
          ...contentTree.pages,
          {
            file_id: "file-old-page",
            path: "Old.md",
            title: "Old",
            location: "Work:Old.md",
            display_path: ["Old"],
            is_favorite: false,
          },
        ],
      },
    });
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
              title: "Help",
              description: "Daibase のドキュメントを表示します。",
              location: "Special:Help",
            },
            {
              title: "Pages",
              description: "namespace 内の全ページを表示します。",
              location: "Work:Special:Pages",
            },
            {
              title: "Deleted Pages",
              description: "削除済みのページとファイルを表示します。",
              location: "Work:Special:DeletedPages",
            },
            {
              title: "Favorites",
              description: "お気に入りのページとファイルを表示します。",
              location: "Work:Special:Favorites",
            },
            {
              title: "Categories",
              description: "カテゴリ別にページを表示します。",
              location: "Work:Special:Categories",
            },
            {
              title: "Plugins",
              description: "登録済みプラグインの確認と有効化を行います。",
              location: "Work:Special:Plugins",
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
      if (location === "Special:Help") {
        return {
          kind: "specialHelp",
          location: "Special:Help",
          documents: [
            {
              path: "content-app-design.md",
              title: "コンテンツ管理アプリ設計",
              location: "Special:Help/content-app-design.md",
            },
            {
              path: "plugin-development.md",
              title: "Plugin Development",
              location: "Special:Help/plugin-development.md",
            },
          ],
          document: null,
        };
      }
      if (location === "Special:Help/plugin-development.md") {
        return {
          kind: "specialHelp",
          location,
          documents: [
            {
              path: "content-app-design.md",
              title: "コンテンツ管理アプリ設計",
              location: "Special:Help/content-app-design.md",
            },
            {
              path: "plugin-development.md",
              title: "Plugin Development",
              location,
            },
          ],
          document: {
            path: "plugin-development.md",
            title: "Plugin Development",
            location,
            markdown: "# Plugin Development\n\n[設計](content-app-design.md)\n\n- pageView\n",
          },
        };
      }
      if (location === "Special:DeletedPages" || location === "Work:Special:DeletedPages") {
        return {
          kind: "specialDeletedPages",
          namespace,
          location: "Work:Special:DeletedPages",
          content: contentTree,
          items: deletedContentItems(),
        };
      }
      if (location === "Special:Favorites" || location === "Work:Special:Favorites") {
        return {
          kind: "specialFavorites",
          namespace,
          location: "Work:Special:Favorites",
          content: contentTree,
          items: favoriteContentItems(),
        };
      }
      if (location === "Special:Categories" || location === "Work:Special:Categories") {
        return {
          kind: "specialCategories",
          namespace,
          location: "Work:Special:Categories",
          content: contentTree,
          categories: [
            {
              name: "Work",
              pages: [
                {
                  file_id: "file-main",
                  path: "Main.md",
                  title: "Main",
                  location: "Work:Main.md",
                },
              ],
            },
          ],
          uncategorized_pages: [
            {
              file_id: "file-guide",
              path: "Guide/Intro.md",
              title: "Intro",
              location: "Work:Guide/Intro.md",
            },
          ],
        };
      }
      if (location === "Special:Plugins" || location === "Work:Special:Plugins") {
        return {
          kind: "specialPlugins",
          namespace,
          location: "Work:Special:Plugins",
          content: contentTree,
          plugins: pluginItems(),
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
      if (path === "Guide/Intro.md") {
        return {
          kind: "page",
          namespace,
          location: "Work:Guide/Intro.md",
          content: contentTree,
          page: page(path, "# Intro", [
            {
              path: "Main.md",
              title: "Main",
              location: "Work:Main.md",
            },
          ]),
        };
      }
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
                categories: [],
                backlinks: [],
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

  it("初期表示では Main ページを表示し、ヘッダーにはロケーション入力欄を表示しない", async () => {
    renderHomePage();

    await screen.findByRole("treeitem", { name: "Main" });
    expect(screen.queryByRole("textbox", { name: "現在のロケーション" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "開く" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "進む" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
    expect(screen.getByRole("button", { name: "Milkdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Markdown" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "履歴" })).toBeInTheDocument();
    expect(screen.queryByLabelText("未保存")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Markdown" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "編集" })).not.toBeInTheDocument();
  });

  it("全体検索ボタンで入力欄を表示して検索結果からページを開く", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("treeitem", { name: "Main" });
    await user.click(screen.getByRole("button", { name: "全体検索" }));
    expect(screen.getByRole("dialog", { name: "検索パネル" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "検索またはコマンド" });
    expect(input).toHaveFocus();

    await user.type(input, "intro");

    await waitFor(() => expect(api.searchContent).toHaveBeenCalledWith(workNamespace.id, "intro"));
    const results = await screen.findByRole("list", { name: "検索結果" });
    const resultButton = within(results).getByRole("button", { name: /Intro/ });
    expect(resultButton).toHaveTextContent("Guide/Intro.md");
    expect(resultButton).toHaveTextContent("本文の Intro");
    expect(within(results).getAllByText("Intro", { selector: "mark" })).toHaveLength(3);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "検索パネル" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "全体検索" }));
    const reopenedInput = screen.getByRole("textbox", { name: "検索またはコマンド" });
    expect(reopenedInput).toHaveValue("");
    await user.type(reopenedInput, "intro");

    const reopenedResults = await screen.findByRole("list", { name: "検索結果" });
    await user.click(within(reopenedResults).getByRole("button", { name: /Intro/ }));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue("# Intro");
  });

  it("ページ内検索バーで現在のページ本文を検索できる", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("treeitem", { name: "Main" });
    await user.click(screen.getByRole("button", { name: "ページ内検索" }));

    const searchRegion = screen.getByRole("search", { name: "ページ内検索" });
    expect(searchRegion).toHaveStyle({ position: "absolute", right: "16px", top: "48px" });
    const input = within(searchRegion).getByRole("textbox", { name: "ページ内検索キーワード" });
    expect(input).toHaveFocus();

    await user.type(input, "main");

    expect(within(searchRegion).getByLabelText("ページ内検索の一致数")).toHaveTextContent("1/1");
    expect(within(searchRegion).getByRole("button", { name: "前の一致" })).toBeEnabled();
    expect(within(searchRegion).getByRole("button", { name: "次の一致" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Markdown" }));
    const lineNumbers = screen.getByTestId("markdown-editor-line-numbers");
    expect(lineNumbers).toHaveTextContent("1");
    expect(lineNumbers).toHaveTextContent("5");
    const highlights = screen.getByTestId("markdown-editor-highlights");
    expect(highlights.querySelectorAll("mark")).toHaveLength(1);
    expect(highlights.querySelector("mark")).toHaveAttribute("data-active-search-match", "true");

    await user.click(within(searchRegion).getByRole("button", { name: "ページ内検索を閉じる" }));
    expect(screen.queryByRole("search", { name: "ページ内検索" })).not.toBeInTheDocument();
  });

  it("Markdown ソース表示で本文を編集できる", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("treeitem", { name: "Main" });
    await user.click(screen.getByRole("button", { name: "Markdown" }));
    const rawEditor = screen.getByRole("textbox", { name: "Markdownソース" });
    expect(rawEditor).toHaveValue("# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)");

    await user.clear(rawEditor);
    await user.type(rawEditor, "# Raw");

    expect(screen.getByLabelText("未保存")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Milkdown" }));

    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue("# Raw");
  });

  it("有効な page view plugin が frontmatter に一致すると Plugin Host view を表示する", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([pluginItems({ enabled: true })[0]]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page(
        "Calendar.md",
        "---\ndaibase.view: calendar\n---\n# Calendar\n\n- 2026-06-04 Review",
      ),
    });

    renderHomePage();

    const frame = await screen.findByTitle("Calendar");
    expect(frame.getAttribute("srcdoc")).toContain('window, "daibase"');
    expect(frame.getAttribute("srcdoc")).not.toContain("readCurrentPage");
    expect(frame.getAttribute("srcdoc")).not.toContain("writeCurrentPage");
    expect(frame.getAttribute("srcdoc")).toContain("<body>Calendar</body>");
    expect(frame).toHaveAttribute("scrolling", "no");
    expect(api.resolvePluginMain).toHaveBeenCalledWith("com.example.calendar");
    expect(screen.queryByRole("textbox", { name: "Markdown" })).not.toBeInTheDocument();
  });

  it("page-write 権限を持つプラグインは現在のページを書き込める", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({ enabled: true, permissions: ["page-read", "page-write"] })[0],
    ]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page(
        "Calendar.md",
        "---\ndaibase.view: calendar\n---\n# Calendar\n\n- 2026-06-04 Review",
      ),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.savePage).mockResolvedValue({
      location: "Work:Calendar.md",
      namespace: workNamespace,
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Updated"),
      save: saveResult("file-calendar"),
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-write-1",
        method: "page.writeCurrent",
        params: {
          content: "---\ndaibase.view: calendar\n---\n# Updated",
        },
      });
      expect(api.savePage).toHaveBeenCalledWith(
        "ns-work",
        "Calendar.md",
        "---\ndaibase.view: calendar\n---\n# Updated",
      );
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            page: expect.objectContaining({
              content: "---\ndaibase.view: calendar\n---\n# Updated",
            }),
          }),
          type: "daibase:render",
        }),
        "*",
      ),
    );
    expect(screen.queryByLabelText("未保存")).not.toBeInTheDocument();
  });

  it("page-read 権限を持つプラグインは現在のページを API から読める", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([pluginItems({ enabled: true })[0]]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page(
        "Calendar.md",
        "---\ndaibase.view: calendar\ncalendar:\n  month: 2026-06\n---\n# Calendar",
      ),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-read-1",
        method: "page.readCurrent",
      });
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "daibase:api-response",
          requestId: "plugin-read-1",
          ok: true,
          result: {
            namespaceId: "ns-work",
            path: "Calendar.md",
            location: "Work:Calendar.md",
            title: "Calendar",
            content: "---\ndaibase.view: calendar\ncalendar:\n  month: 2026-06\n---\n# Calendar",
            frontmatter: {
              "daibase.view": "calendar",
              calendar: {
                month: "2026-06",
              },
            },
            body: "# Calendar",
            isDirty: false,
            isReadOnly: false,
          },
        },
        "*",
      );
    });
  });

  it("page.read は任意ページを読める", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([pluginItems({ enabled: true })[0]]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.readPage).mockResolvedValue(page("Guide/Intro.md", "# Intro"));

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-page-read-1",
        method: "page.read",
        params: {
          ref: { namespaceId: "ns-work", path: "Guide/Intro.md" },
        },
      });
      expect(api.readPage).toHaveBeenCalledWith("ns-work", "Guide/Intro.md");
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "daibase:api-response",
          requestId: "plugin-page-read-1",
          ok: true,
          result: expect.objectContaining({
            location: "Work:Guide/Intro.md",
            content: "# Intro",
            body: "# Intro",
          }),
        }),
        "*",
      ),
    );
  });

  it("page.write は任意ページを書き込める", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({ enabled: true, permissions: ["page-read", "page-write"] })[0],
    ]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.savePage).mockResolvedValue({
      location: "Work:Guide/Intro.md",
      namespace: workNamespace,
      content: contentTree,
      page: page("Guide/Intro.md", "# Updated intro"),
      save: saveResult("file-guide"),
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-page-write-1",
        method: "page.write",
        params: {
          ref: { namespaceId: "ns-work", path: "Guide/Intro.md" },
          content: "# Updated intro",
        },
      });
      expect(api.savePage).toHaveBeenCalledWith("ns-work", "Guide/Intro.md", "# Updated intro");
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "daibase:api-response",
          requestId: "plugin-page-write-1",
          ok: true,
          result: expect.objectContaining({
            location: "Work:Guide/Intro.md",
            content: "# Updated intro",
          }),
        }),
        "*",
      ),
    );
  });

  it("page.create は既存ページへの作成を拒否する", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({ enabled: true, permissions: ["page-read", "page-create"] })[0],
    ]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.readPage).mockResolvedValue(page("Guide/Intro.md", "# Intro"));

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-page-create-1",
        method: "page.create",
        params: {
          ref: { namespaceId: "ns-work", path: "Guide/Intro.md" },
          content: "# New",
        },
      });
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "daibase:api-response",
          requestId: "plugin-page-create-1",
          ok: false,
          error: "指定したページは既に存在します。",
        },
        "*",
      );
    });
    expect(api.savePage).not.toHaveBeenCalled();
  });

  it("page.create は未作成ページを作成できる", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({ enabled: true, permissions: ["page-read", "page-create"] })[0],
    ]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.readPage).mockResolvedValue({
      ...page("Daily/2026-06-06.md", ""),
      is_virtual: true,
    });
    vi.mocked(api.savePage).mockResolvedValue({
      location: "Work:Daily/2026-06-06.md",
      namespace: workNamespace,
      content: contentTree,
      page: page("Daily/2026-06-06.md", "# 2026-06-06"),
      save: saveResult("file-daily"),
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-page-create-2",
        method: "page.create",
        params: {
          ref: { namespaceId: "ns-work", path: "Daily/2026-06-06.md" },
          content: "# 2026-06-06",
        },
      });
      expect(api.savePage).toHaveBeenCalledWith("ns-work", "Daily/2026-06-06.md", "# 2026-06-06");
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "daibase:api-response",
          requestId: "plugin-page-create-2",
          ok: true,
          result: expect.objectContaining({
            location: "Work:Daily/2026-06-06.md",
            content: "# 2026-06-06",
          }),
        }),
        "*",
      ),
    );
  });

  it("page.delete は page-delete 権限を要求する", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({ enabled: true, permissions: ["page-read", "page-write"] })[0],
    ]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-page-delete-1",
        method: "page.delete",
        params: {
          ref: { namespaceId: "ns-work", path: "Guide/Intro.md" },
        },
      });
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "daibase:api-response",
          requestId: "plugin-page-delete-1",
          ok: false,
          error: "page-delete permission が必要です。",
        },
        "*",
      );
    });
    expect(api.deletePage).not.toHaveBeenCalled();
  });

  it("location.open は権限があれば Daibase の表示 location を開く", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([pluginItems({ enabled: true })[0]]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });
    vi.mocked(api.openLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Guide/Intro.md",
      content: contentTree,
      page: page("Guide/Intro.md", "# Intro"),
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-location-open-1",
        method: "location.open",
        params: {
          location: "Work:Guide/Intro.md",
        },
      });
      expect(api.openLocation).toHaveBeenCalledWith("Work:Guide/Intro.md", "ns-work");
    });
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "daibase:api-response",
          requestId: "plugin-location-open-1",
          ok: true,
        },
        "*",
      ),
    );
  });

  it("page-write 権限のないプラグインからの書き込みを拒否する", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([pluginItems({ enabled: true })[0]]);
    vi.mocked(api.openInitialLocation).mockResolvedValue({
      kind: "page",
      namespace: workNamespace,
      location: "Work:Calendar.md",
      content: contentTree,
      page: page("Calendar.md", "---\ndaibase.view: calendar\n---\n# Calendar"),
    });
    vi.mocked(api.resolvePluginMain).mockResolvedValue({
      path: "/tmp/calendar-plugin/dist/index.html",
      html: "<!doctype html><html><body>Calendar</body></html>",
    });

    renderHomePage();
    const frame = (await screen.findByTitle("Calendar")) as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    await waitFor(() => {
      dispatchPluginApiRequest(frame, {
        type: "daibase:api-request",
        requestId: "plugin-write-2",
        method: "page.writeCurrent",
        params: {
          content: "# Rejected",
        },
      });
      expect(postMessage).toHaveBeenCalledWith(
        {
          type: "daibase:api-response",
          requestId: "plugin-write-2",
          ok: false,
          error: "page-write permission が必要です。",
        },
        "*",
      );
    });
    expect(api.savePage).not.toHaveBeenCalled();
  });

  it("ページ下部にこのページへリンクしているページを表示して開ける", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("Intro"));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue("# Intro");
    expect(screen.getByRole("heading", { name: "このページへのリンク" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Main/ }));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
  });

  it("サイドバーにページを階層構造で表示してクリックで遷移する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    expect(pageList).toHaveTextContent("Main");
    expect(pageList).toHaveTextContent("Guide");
    expect(pageList).toHaveTextContent("Intro");
    expect(within(pageList).getAllByText("aaa")).toHaveLength(2);
    expect(pageList).toHaveTextContent("bbb");
    expect(pageList).toHaveTextContent("logo.png");

    const aaaItem = screen.getByRole("treeitem", { name: "aaa bbb" });
    await user.click(within(aaaItem).getByTestId("TreeViewCollapseIconIcon"));
    await waitForElementToBeRemoved(() => within(pageList).queryByText("bbb"));
    await user.click(within(aaaItem).getByTestId("TreeViewExpandIconIcon"));
    expect(within(pageList).getByText("bbb")).toBeInTheDocument();

    await user.click(within(pageList).getByText("Intro"));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue("# Intro");

    await user.click(within(pageList).getByText("logo.png"));

    expect(await screen.findByRole("heading", { name: "logo.png" })).toBeInTheDocument();
  });

  it("File ロケーションでファイル詳細を表示して説明を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("logo.png"));

    expect(await screen.findByRole("heading", { name: "logo.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ファイル" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "履歴" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "ファイル" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "履歴" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "履歴" }));
    expect(await screen.findByRole("heading", { name: "ファイル履歴" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ファイル" }));
    expect(await screen.findByRole("heading", { name: "logo.png" })).toBeInTheDocument();

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

  it("File ページ下部にこのファイルへリンクしているページを表示して開ける", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("logo.png"));

    expect(await screen.findByRole("heading", { name: "logo.png" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "このファイルへのリンク" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Main" }));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
  });

  it("File ページからアップロードする", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.open).mockResolvedValue("/tmp/logo.png");
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("logo.png"));
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
        backlinks: [],
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

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("readme.txt"));

    expect(await screen.findByRole("heading", { name: "readme.txt" })).toBeInTheDocument();
    expect(screen.getByText("内容")).toBeInTheDocument();
    expect(screen.getByText(/hello\s+world/)).toBeInTheDocument();
  });

  it("サイドバーに操作ボタンを表示して Contents ラベルは表示しない", async () => {
    renderHomePage();

    await screen.findByRole("tree", { name: "ページ一覧" });

    expect(screen.queryByText("Contents")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "新規作成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ファイル作成" })).not.toBeInTheDocument();
    for (const label of ["フォルダー作成", "ページ作成", "ソート"]) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
  });

  it("サイドバーの削除ボタンからページを削除する", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    const introItems = within(pageList).getAllByRole("treeitem", { name: /Intro/ });
    const introItem = introItems[introItems.length - 1];
    await user.click(within(introItem).getByRole("button", { name: "削除" }));

    await waitFor(() =>
      expect(api.deletePage).toHaveBeenCalledWith(workNamespace.id, "Guide/Intro.md"),
    );
    expect(within(pageList).queryByText("Intro")).not.toBeInTheDocument();
    expect(screen.getByText("削除しました")).toBeInTheDocument();
  });

  it("サイドバーの削除ボタンからファイルを削除する", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    const fileItems = within(pageList).getAllByRole("treeitem", { name: /logo\.png/ });
    const fileItem = fileItems[fileItems.length - 1];
    await user.click(within(fileItem).getByRole("button", { name: "削除" }));

    await waitFor(() =>
      expect(api.deleteFile).toHaveBeenCalledWith(workNamespace.id, "images/logo.png"),
    );
    expect(within(pageList).queryByText("logo.png")).not.toBeInTheDocument();
  });

  it("サイドバーの削除ボタンからフォルダーを削除する", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    const guideItem = within(pageList).getByRole("treeitem", { name: "Guide Intro" });
    await user.click(within(guideItem).getAllByRole("button", { name: "削除" })[0]);

    await waitFor(() => expect(api.deleteFolder).toHaveBeenCalledWith(workNamespace.id, "Guide"));
    expect(within(pageList).queryByText("Guide")).not.toBeInTheDocument();
    expect(within(pageList).queryByText("Intro")).not.toBeInTheDocument();
  });

  it("サイドバーからページ名を入力してページを作成する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(screen.getByRole("button", { name: "ページ作成" }));
    const pageName = await screen.findByRole("textbox", { name: "ページ名" });
    await user.clear(pageName);
    await user.type(pageName, "Draft");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Draft.md", "");
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "ページ作成" }));
    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue("");
  });

  it("選択中フォルダーの中にページを作成する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("Guide"));
    await user.click(screen.getByRole("button", { name: "ページ作成" }));
    const pageName = await screen.findByRole("textbox", { name: "ページ名" });
    await user.clear(pageName);
    await user.type(pageName, "Draft.md");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Guide/Draft.md", "");
    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue("");
  });

  it("選択中フォルダーの中にフォルダーを作成して一覧に表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    await user.click(within(pageList).getByText("Guide"));
    await user.click(screen.getByRole("button", { name: "フォルダー作成" }));
    const folderName = await screen.findByRole("textbox", { name: "フォルダー名" });
    await user.clear(folderName);
    await user.type(folderName, "Daily");
    await user.click(screen.getByRole("button", { name: "作成" }));

    expect(api.createFolder).toHaveBeenCalledWith(workNamespace.id, "Guide/Daily");
    expect(within(pageList).getByText("Daily")).toBeInTheDocument();
  });

  it("サイドバーのソート順を切り替える", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    expect(textOrder(pageList.textContent ?? "", "aaa", "Guide")).toBeLessThan(0);

    await user.click(screen.getByRole("button", { name: "ソート" }));

    expect(screen.getByRole("button", { name: "ソート" })).toHaveAttribute("aria-pressed", "true");
    expect(textOrder(pageList.textContent ?? "", "Guide", "aaa")).toBeLessThan(0);
  });

  it("サイドバーのフォルダークリックではページとして開かない", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const pageList = await screen.findByRole("tree", { name: "ページ一覧" });
    const guideItem = screen.getByRole("treeitem", { name: "Guide Intro" });

    await user.click(within(guideItem).getByText("Guide"));

    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue(
      "# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
    expect(screen.queryByText("このページはまだ作成されていません。")).not.toBeInTheDocument();
    expect(pageList).toHaveTextContent("Intro");
  });

  it("サイドバーから Special:Favorites を開く", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("tree", { name: "ページ一覧" });
    expect(screen.queryByText("お気に入り")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Favorites" }));

    expect(await screen.findByRole("heading", { name: "Favorites" })).toBeInTheDocument();
  });

  it("サイドバーからヘルプを開き docs の Markdown を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "ヘルプ" }));

    expect(await screen.findByRole("heading", { name: "Help" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Plugin Development/ }));
    expect(await screen.findByRole("heading", { name: "Plugin Development" })).toBeInTheDocument();
    expect(screen.getByText("pageView")).toBeInTheDocument();
    expect(
      getComputedStyle(screen.getByRole("list", { name: "ヘルプドキュメント一覧" })).overflowY,
    ).toBe("auto");
    expect(
      getComputedStyle(screen.getByRole("article", { name: "ヘルプドキュメント本文" })).overflowY,
    ).toBe("auto");
    expect(api.openLocation).toHaveBeenCalledWith("Special:Help/plugin-development.md", "ns-work");
  });

  it("サイドバーの星ボタンでページをお気に入りに追加する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const mainItem = await screen.findByRole("treeitem", { name: /Main/ });
    await user.click(within(mainItem).getByRole("button", { name: "お気に入り" }));

    await waitFor(() =>
      expect(api.setFavoriteContent).toHaveBeenCalledWith(workNamespace.id, "Main.md", true),
    );
    expect(screen.getByText("お気に入りに追加しました")).toBeInTheDocument();
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

    await openSpecialPage(user, "Pages");

    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "進む" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ターミナル" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全体検索" })).toBeInTheDocument();
    expect(screen.getByText("Work:Guide/Intro.md")).toBeInTheDocument();
  });

  it("Special ページのコンテンツ領域をスクロール可能にする", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Pages");

    await screen.findByRole("heading", { name: "Pages" });
    expect(screen.getByTestId("special-page-scroll")).toHaveStyle({
      minHeight: "0px",
      overflow: "auto",
    });
  });

  it("Special:SpecialPages で全ての Special ページを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Special Pages");

    expect(await screen.findByRole("heading", { name: "Special Pages" })).toBeInTheDocument();
    expect(screen.getByText(/全ての Special ページを表示します。/)).toBeInTheDocument();
    expect(screen.getByText(/登録済み namespace の確認と新規作成を行います。/)).toBeInTheDocument();
    expect(screen.getAllByText("Pages").length).toBeGreaterThan(0);
    expect(screen.getByText("namespace 内の全ページを表示します。")).toBeInTheDocument();
    expect(screen.getByText("Deleted Pages")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
    expect(screen.getByText("お気に入りのページとファイルを表示します。")).toBeInTheDocument();
    expect(screen.getByText("Categories")).toBeInTheDocument();
    expect(screen.getByText("カテゴリ別にページを表示します。")).toBeInTheDocument();
    expect(screen.getByText("Plugins")).toBeInTheDocument();
    expect(screen.getByText("登録済みプラグインの確認と有効化を行います。")).toBeInTheDocument();
    expect(screen.queryByText(/Work namespace/)).not.toBeInTheDocument();
  });

  it("Special:Plugins で登録済みプラグインを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Plugins");

    expect(await screen.findByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("page-read")).toBeInTheDocument();
    expect(screen.getByText("location-open")).toBeInTheDocument();
  });

  it("Special:Plugins で壊れたプラグインをエラー表示する", async () => {
    vi.mocked(api.listPlugins).mockResolvedValue([
      pluginItems({
        loadError: "manifest.json が見つからないか読み込めません。",
      })[0],
    ]);
    vi.mocked(api.openLocation).mockImplementation(async (location) => {
      if (location === "Special:SpecialPages" || location === "Work:Special:SpecialPages") {
        return {
          kind: "specialPages",
          namespace: workNamespace,
          location: "Work:Special:SpecialPages",
          content: contentTree,
          pages: [
            {
              title: "Plugins",
              description: "登録済みプラグインの確認と有効化を行います。",
              location: "Work:Special:Plugins",
            },
          ],
        };
      }
      if (location === "Special:Plugins" || location === "Work:Special:Plugins") {
        return {
          kind: "specialPlugins",
          namespace: workNamespace,
          location: "Work:Special:Plugins",
          title: "Plugins",
          content: contentTree,
          plugins: pluginItems({
            loadError: "manifest.json が見つからないか読み込めません。",
          }),
        };
      }
      return {
        kind: "page",
        namespace: workNamespace,
        location: `Work:${location}`,
        content: contentTree,
        page: page(location, "# Main"),
      };
    });
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Plugins");

    expect(await screen.findByRole("heading", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("読み込みエラー")).toBeInTheDocument();
    expect(screen.getByText("manifest.json が見つからないか読み込めません。")).toBeInTheDocument();
  });

  it("Special:Plugins でプラグインの README を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Plugins");

    await user.click(await screen.findByRole("button", { name: "Calendar のドキュメントを表示" }));

    expect(api.readPluginDocumentation).toHaveBeenCalledWith("com.example.calendar");
    expect(await screen.findByRole("dialog", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendar Plugin" })).toBeInTheDocument();
    expect(screen.getByText(/daibase\.view: calendar/)).toBeInTheDocument();
  });

  it("Special:Plugins でプラグイン登録を削除する", async () => {
    vi.mocked(api.listPlugins)
      .mockResolvedValueOnce(pluginItems())
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Plugins");

    await user.click(await screen.findByRole("button", { name: "Calendar を削除" }));
    expect(await screen.findByRole("dialog", { name: "プラグインを削除" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "削除" }));

    expect(api.removePlugin).toHaveBeenCalledWith("com.example.calendar");
    expect(await screen.findByText("登録済みプラグインはありません。")).toBeInTheDocument();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it("Special:Categories でカテゴリ別にページを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Categories");

    expect(await screen.findByRole("heading", { name: "Categories" })).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("未分類")).toBeInTheDocument();
    expect(screen.getByText("Work:Guide/Intro.md")).toBeInTheDocument();
  });

  it("Special:Favorites でお気に入りページとファイルを表示して開ける", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Favorites");

    expect(await screen.findByRole("heading", { name: "Favorites" })).toBeInTheDocument();
    expect(screen.getAllByText("Intro").length).toBeGreaterThan(0);
    expect(screen.getByText(/Page \/ Guide\/Intro.md/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Intro.*Page/ }));

    expect(await screen.findByRole("textbox", { name: "Markdown" })).toHaveValue("# Intro");
  });

  it("Special:DeletedPages で削除済みページとファイルを表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Deleted Pages");

    expect(await screen.findByRole("heading", { name: "Deleted Pages" })).toBeInTheDocument();
    expect(screen.getByText("Old")).toBeInTheDocument();
    expect(screen.getByText(/Page \/ Old.md/)).toBeInTheDocument();
    expect(screen.getByText("old-logo.png")).toBeInTheDocument();
    expect(screen.getByText(/File \/ images\/old-logo.png/)).toBeInTheDocument();
  });

  it("削除済みページをクリックすると削除時点の内容を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Deleted Pages");
    await user.click(await screen.findByRole("button", { name: /Old.*Page/ }));

    expect(api.readDeletedPage).toHaveBeenCalledWith(workNamespace.id, "file-old-page");
    expect(screen.getByText("削除済みページの内容を表示しています。")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Markdown" })).toHaveValue("# Old\n\n削除済み本文");
  });

  it("削除済みリストからページを復活する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await openSpecialPage(user, "Deleted Pages");
    await user.click(await screen.findByRole("button", { name: "Old を復活" }));

    await waitFor(() =>
      expect(api.restoreDeletedContent).toHaveBeenCalledWith(workNamespace.id, "file-old-page"),
    );
    expect(screen.getByText("復活しました")).toBeInTheDocument();
  });

  it("サイドバーから Special:SpecialPages を開く", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("tree", { name: "ページ一覧" });
    const specialPagesLink = screen.getByRole("button", { name: "Special Pages" });

    await user.click(specialPagesLink);

    expect(await screen.findByRole("heading", { name: "Special Pages" })).toBeInTheDocument();
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

    await screen.findByRole("treeitem", { name: "Main" });
    await user.click(screen.getByRole("button", { name: "Markdown" }));
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

  it("カテゴリ入力を Markdown frontmatter として保存する", async () => {
    renderHomePage();

    const categoryInput = await screen.findByRole("combobox", { name: "カテゴリ" });
    vi.useFakeTimers();
    fireEvent.change(categoryInput, { target: { value: "Work, Research" } });
    fireEvent.blur(categoryInput);

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(api.savePage).toHaveBeenCalledWith(
      workNamespace.id,
      "Main.md",
      "---\ncategories:\n  - Work\n  - Research\n---\n# Main\n\n[Draft](Draft.md)\n\n[Intro](Guide/Intro.md)",
    );
  });

  it("Markdown ソースで frontmatter を直接編集するとカテゴリ UI に反映する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await screen.findByRole("treeitem", { name: "Main" });
    await user.click(screen.getByRole("button", { name: "Markdown" }));
    const editor = screen.getByRole("textbox", { name: "Markdownソース" });

    fireEvent.change(editor, {
      target: {
        value: "---\ncategories:\n  - Research\n  - Memo\n---\n# Main\n",
      },
    });

    expect(await screen.findByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Memo")).toBeInTheDocument();
  });

  it("画面遷移前に未保存の編集を保存する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    const editor = await screen.findByRole("textbox", { name: "Markdown" });
    await user.clear(editor);
    await user.type(editor, "# Moving");
    await openSpecialPage(user, "Pages");

    await waitFor(() =>
      expect(api.savePage).toHaveBeenCalledWith(workNamespace.id, "Main.md", "# Moving"),
    );
    expect(await screen.findByRole("heading", { name: "Pages" })).toBeInTheDocument();
  });

  it("ページの編集履歴を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "履歴" }));

    expect(api.listPageHistory).toHaveBeenCalledWith(workNamespace.id, "Main.md");
    expect(await screen.findByRole("heading", { name: "編集履歴" })).toBeInTheDocument();
    expect(screen.queryByText("rev_02")).not.toBeInTheDocument();
    expect(screen.queryByText("sha256:second")).not.toBeInTheDocument();
    expect(screen.getByText("1234567890ab")).toHaveAttribute("title", "sha256:1234567890abcdef");
    expect(screen.getAllByText("modified / Main.md")).toHaveLength(2);
  });

  it("履歴行を選択するとタブ下のコンテンツで履歴詳細を表示する", async () => {
    const user = userEvent.setup();
    renderHomePage();

    await user.click(await screen.findByRole("button", { name: "履歴" }));
    await user.click(await screen.findByRole("button", { name: /2026\/01\/02.*modified/ }));

    await waitFor(() =>
      expect(api.readPageHistorySnapshot).toHaveBeenCalledWith("ns-work", "Main.md", "rev_02"),
    );
    expect(await screen.findByText("差分はありません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "一覧へ戻る" })).toBeInTheDocument();
    expect(screen.getByTestId("current-route")).toHaveTextContent("/");
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

async function openSpecialPage(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole("button", { name: "Special Pages" }));
  if (title !== "Special Pages") {
    const specialPagesList = await screen.findByRole("list", { name: "Special ページ一覧" });
    await user.click(
      within(specialPagesList).getByRole("button", {
        name: new RegExp(`^${escapeRegExp(title)}\\b`),
      }),
    );
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function page(
  path: string,
  content: string,
  backlinks: PageContent["backlinks"] = [],
): PageContent {
  return {
    namespace_id: workNamespace.id,
    file_id: `file-${path}`,
    path,
    title: lastPathPart(path.replace(/\.md$/, "")),
    location: `Work:${path}`,
    content,
    categories: [],
    backlinks,
    latest_revision_id: "rev_01",
    is_virtual: false,
    is_favorite: path === "Guide/Intro.md",
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

function deletedContentItems() {
  return [
    {
      file_id: "file-old-page",
      path: "Old.md",
      title: "Old",
      location: "Work:Old.md",
      content_kind: "page",
      deleted_at: "2026-01-04T00:00:00Z",
      latest_revision_id: "rev_deleted_page",
    },
    {
      file_id: "file-old-logo",
      path: "images/old-logo.png",
      title: "old-logo.png",
      location: "Work:images/old-logo.png",
      content_kind: "file",
      deleted_at: "2026-01-03T00:00:00Z",
      latest_revision_id: "rev_deleted_file",
    },
  ];
}

function managedFile(
  path: string,
  note: string,
  backlinks: ManagedFileContent["backlinks"] = [
    {
      path: "Main.md",
      title: "Main",
      location: "Work:Main.md",
    },
  ],
): ManagedFileContent {
  return {
    namespace_id: workNamespace.id,
    file_id: "file-logo",
    path,
    title: lastPathPart(path),
    location: `Work:${path}`,
    note,
    backlinks,
    content_type: "image/png",
    text_content: null,
    data_url: "data:image/png;base64,aW1hZ2U=",
    size: 1234,
    latest_revision_id: "rev_file_01",
    is_virtual: false,
    is_favorite: false,
  };
}

function favoriteContentItems() {
  return [
    {
      file_id: "file-guide",
      path: "Guide/Intro.md",
      title: "Intro",
      location: "Work:Guide/Intro.md",
      content_kind: "page",
    },
  ];
}

function searchResults(): SearchContentResult[] {
  return [
    {
      content_kind: "page",
      path: "Guide/Intro.md",
      title: "Intro",
      location: "Work:Guide/Intro.md",
      snippet: "本文の Intro に一致しました。",
    },
  ];
}

function pluginItems({
  enabled = false,
  loadError = null,
  permissions = ["page-read", "location-open"],
}: {
  enabled?: boolean;
  loadError?: string | null;
  permissions?: InstalledPluginSummary["manifest"]["permissions"];
} = {}): InstalledPluginSummary[] {
  return [
    {
      id: "com.example.calendar",
      name: "Calendar",
      version: "0.1.0",
      description: "Calendar view",
      enabled,
      load_error: loadError,
      source: {
        kind: "localFolder",
        path: "/tmp/calendar-plugin",
      },
      manifest: {
        schemaVersion: 1,
        id: "com.example.calendar",
        name: "Calendar",
        version: "0.1.0",
        description: "Calendar view",
        main: "dist/index.html",
        contributions: [
          {
            kind: "pageView",
            id: "calendar",
            name: "Calendar",
            slot: "main",
            match: {
              frontmatter: {
                "daibase.view": "calendar",
              },
            },
            view: {
              kind: "custom",
            },
            activation: {
              autoOpen: true,
            },
          },
        ],
        permissions,
      },
    },
  ];
}

function saveResult(fileId: string) {
  return {
    namespace_id: workNamespace.id,
    file_id: fileId,
    path: "Calendar.md",
    revision_id: "rev-plugin-write",
    object_id: "obj-plugin-write",
    saved_at: "2026-06-06T00:00:00Z",
  };
}

function dispatchPluginApiRequest(
  frame: HTMLIFrameElement,
  message: {
    type: "daibase:api-request";
    requestId: string;
    method: string;
    params?: unknown;
  },
) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: message,
        source: frame.contentWindow,
      }),
    );
  });
}

function favoriteContentTree(path: string, isFavorite: boolean): ContentTree {
  return {
    ...contentTree,
    pages: contentTree.pages.map((page) =>
      page.path === path ? { ...page, is_favorite: isFavorite } : page,
    ),
    files: contentTree.files.map((file) =>
      file.path === path ? { ...file, is_favorite: isFavorite } : file,
    ),
  };
}

function lastPathPart(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function textOrder(text: string, left: string, right: string) {
  return text.indexOf(left) - text.indexOf(right);
}
