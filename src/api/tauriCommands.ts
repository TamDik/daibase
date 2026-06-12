import { invoke } from "@tauri-apps/api/core";

export type NamespaceSummary = {
  id: string;
  name: string;
  root_path: string;
  default_page: string;
  default_location: string;
  pages_location: string;
  created_at: string;
  updated_at: string;
};

export type FileSummary = {
  file_id: string;
  path: string;
  title: string;
  location: string;
  display_path: string[];
  is_favorite: boolean;
};

export type SearchContentResult = {
  content_kind: "page" | "file" | "special" | string;
  path: string;
  title: string;
  location: string;
  snippet: string | null;
  title_match_indices: number[];
  path_match_indices: number[];
};

export type FolderSummary = {
  path: string;
  title: string;
  display_path: string[];
};

export type ContentTree = {
  folders: FolderSummary[];
  pages: FileSummary[];
  files: FileSummary[];
};

export type NamespaceDetail = {
  namespace: NamespaceSummary;
  content: ContentTree;
};

export type McpServerStatus = {
  enabled: boolean;
  transport: string;
  url: string;
};

export type TerminalSessionSummary = {
  id: string;
  shell: string;
};

export type TerminalOutputEvent = {
  session_id: string;
  stream: "stdout" | "stderr" | "system" | string;
  text: string;
};

export type TerminalExitEvent = {
  session_id: string;
};

export type PageContent = {
  namespace_id: string;
  file_id: string;
  path: string;
  title: string;
  location: string;
  content: string;
  categories: string[];
  backlinks: BacklinkSummary[];
  latest_revision_id: string | null;
  is_virtual?: boolean;
  is_favorite?: boolean;
};

export type BacklinkSummary = {
  path: string;
  title: string;
  location: string;
};

export type SaveResult = {
  namespace_id: string;
  file_id: string;
  path: string;
  revision_id: string;
  object_id: string;
  saved_at: string;
};

export type SavePageResult = {
  location: string;
  namespace: NamespaceSummary;
  content: ContentTree;
  page: PageContent;
  save: SaveResult;
};

export type ManagedFileContent = {
  namespace_id: string;
  file_id: string;
  path: string;
  title: string;
  location: string;
  note: string;
  backlinks: BacklinkSummary[];
  content_type: string;
  text_content: string | null;
  data_url: string | null;
  size: number;
  latest_revision_id: string | null;
  is_virtual?: boolean;
  is_favorite?: boolean;
};

export type SaveFileResult = {
  location: string;
  namespace: NamespaceSummary;
  content: ContentTree;
  file: ManagedFileContent;
  save: SaveResult;
};

export type FileHistoryEntry = {
  revision_id: string;
  object_id: string;
  created_at: string;
  kind: string;
  path: string;
};

export type PageHistorySnapshot = {
  entry: FileHistoryEntry;
  content: string;
  previous_content: string | null;
  diff_sections: SideBySideDiffSection[];
};

export type SideBySideDiffSection = {
  kind: "unchanged" | "changed";
  id: string;
  rows: SideBySideDiffRow[];
};

export type SideBySideDiffRow = {
  kind: "unchanged" | "removed" | "added" | "modified";
  old_line_number: number | null;
  old_text: string | null;
  new_line_number: number | null;
  new_text: string | null;
};

export type SpecialPageSummary = {
  title: string;
  description: string;
  location: string;
};

export type DeletedContentSummary = {
  file_id: string;
  path: string;
  title: string;
  location: string;
  content_kind: "page" | "file" | string;
  deleted_at: string;
  latest_revision_id: string;
};

export type FavoriteContentSummary = {
  file_id: string;
  path: string;
  title: string;
  location: string;
  content_kind: "page" | "file" | string;
};

export type CategoryPageSummary = {
  file_id: string;
  path: string;
  title: string;
  location: string;
};

export type CategoryGroupSummary = {
  name: string;
  pages: CategoryPageSummary[];
};

export type PluginInstallSource = {
  kind: "localFolder";
  path: string;
};

export type PluginManifest = {
  schemaVersion: number;
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  contributions: PluginContribution[];
  permissions: PluginPermission[];
};

export type PluginContribution = {
  kind: "pageView";
  id: string;
  name: string;
  slot?: PluginViewSlot;
  match?: PluginContributionMatch;
  view: PluginViewContribution;
  activation?: PluginActivation;
};

export type PluginViewSlot =
  | "main"
  | "sidebarSection"
  | "rightPanel"
  | "bottomPanel"
  | "toolbar"
  | "statusBar";

export type PluginContributionMatch = {
  frontmatter?: unknown;
};

export type PluginViewContribution = {
  kind: "custom";
};

export type PluginActivation = {
  autoOpen?: boolean;
};

export type PluginPermission =
  | "page-read"
  | "page-create"
  | "page-write"
  | "page-delete"
  | "file-read"
  | "file-write"
  | "namespace-read"
  | "history-read"
  | "location-open"
  | "ui-notify";

export type InstalledPluginSummary = {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  load_error: string | null;
  source: PluginInstallSource;
  manifest: PluginManifest;
};

export type PluginMainResolution = {
  path: string;
  html: string;
};

export type PluginDocumentation = {
  plugin_id: string;
  path: string;
  markdown: string;
};

export type HelpDocumentSummary = {
  path: string;
  title: string;
  location: string;
};

export type HelpDocument = HelpDocumentSummary & {
  markdown: string;
};

export type MarkdownLinkStatus = {
  location: string;
  exists: boolean;
  is_internal: boolean;
};

export type MarkdownImageResolution = {
  location: string;
  exists: boolean;
  is_internal: boolean;
  is_image: boolean;
  content_type: string | null;
  data_url: string | null;
};

export type ResolvedLocation =
  | {
      kind: "page";
      namespace: NamespaceSummary;
      pagePath: string;
      location: string;
    }
  | {
      kind: "file";
      namespace: NamespaceSummary;
      filePath: string;
      location: string;
    }
  | {
      kind: "specialNamespaces";
      location: string;
    }
  | {
      kind: "specialHelp";
      documentPath: string | null;
      location: string;
    }
  | {
      kind: "specialShortcuts";
      location: string;
    }
  | {
      kind: "specialCommands";
      location: string;
    }
  | {
      kind: "specialPages";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialPagesList";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialDeletedPages";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialFavorites";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialCategories";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialPlugins";
      namespace: NamespaceSummary;
      location: string;
    };

export type OpenLocationResult =
  | {
      kind: "page";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      page: PageContent;
    }
  | {
      kind: "file";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      file: ManagedFileContent;
    }
  | {
      kind: "specialNamespaces";
      location: string;
      namespaces: NamespaceSummary[];
    }
  | {
      kind: "specialHelp";
      location: string;
      documents: HelpDocumentSummary[];
      document: HelpDocument | null;
    }
  | {
      kind: "specialShortcuts";
      location: string;
    }
  | {
      kind: "specialCommands";
      location: string;
    }
  | {
      kind: "specialPages";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      pages: SpecialPageSummary[];
    }
  | {
      kind: "specialPagesList";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
    }
  | {
      kind: "specialDeletedPages";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      items: DeletedContentSummary[];
    }
  | {
      kind: "specialFavorites";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      items: FavoriteContentSummary[];
    }
  | {
      kind: "specialCategories";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      categories: CategoryGroupSummary[];
    }
  | {
      kind: "specialPlugins";
      location: string;
      namespace: NamespaceSummary;
      content: ContentTree;
      plugins: InstalledPluginSummary[];
    };

export function listNamespaces() {
  return invoke<NamespaceSummary[]>("list_namespaces");
}

export function getMcpServerStatus() {
  return invoke<McpServerStatus>("get_mcp_server_status");
}

export function listPlugins() {
  return invoke<InstalledPluginSummary[]>("list_plugins");
}

export function installPluginFromFolder(sourcePath: string) {
  return invoke<InstalledPluginSummary>("install_plugin_from_folder", {
    sourcePath,
  });
}

export function setPluginEnabled(pluginId: string, enabled: boolean) {
  return invoke<InstalledPluginSummary>("set_plugin_enabled", {
    pluginId,
    enabled,
  });
}

export function removePlugin(pluginId: string) {
  return invoke<void>("remove_plugin", {
    pluginId,
  });
}

export function resolvePluginMain(pluginId: string) {
  return invoke<PluginMainResolution>("resolve_plugin_main", {
    pluginId,
  });
}

export function readPluginDocumentation(pluginId: string) {
  return invoke<PluginDocumentation>("read_plugin_documentation", {
    pluginId,
  });
}

export function startTerminal(columns?: number, rows?: number) {
  return invoke<TerminalSessionSummary>("start_terminal", {
    columns,
    rows,
  });
}

export function writeTerminal(sessionId: string, input: string) {
  return invoke<void>("write_terminal", {
    sessionId,
    input,
  });
}

export function resizeTerminal(sessionId: string, columns: number, rows: number) {
  return invoke<void>("resize_terminal", {
    sessionId,
    columns,
    rows,
  });
}

export function stopTerminal(sessionId: string) {
  return invoke<void>("stop_terminal", {
    sessionId,
  });
}

export function createNamespace(name: string, rootPath: string) {
  return invoke<NamespaceSummary>("create_namespace", {
    name,
    rootPath,
  });
}

export function openNamespace(namespaceId: string) {
  return invoke<NamespaceDetail>("open_namespace", {
    namespaceId,
  });
}

export function readPage(namespaceId: string, path: string) {
  return invoke<PageContent>("read_page", {
    namespaceId,
    path,
  });
}

export function writePage(namespaceId: string, path: string, content: string) {
  return invoke<SaveResult>("write_page", {
    namespaceId,
    path,
    content,
  });
}

export function savePage(namespaceId: string, path: string, content: string) {
  return invoke<SavePageResult>("save_page", {
    namespaceId,
    path,
    content,
  });
}

export function readFile(namespaceId: string, path: string) {
  return invoke<ManagedFileContent>("read_file", {
    namespaceId,
    path,
  });
}

export function uploadFile(namespaceId: string, path: string, sourcePath: string) {
  return invoke<SaveFileResult>("upload_file", {
    namespaceId,
    path,
    sourcePath,
  });
}

export function createFolder(namespaceId: string, path: string) {
  return invoke<NamespaceDetail>("create_folder", {
    namespaceId,
    path,
  });
}

export function deletePage(namespaceId: string, path: string) {
  return invoke<NamespaceDetail>("delete_page", {
    namespaceId,
    path,
  });
}

export function deleteFile(namespaceId: string, path: string) {
  return invoke<NamespaceDetail>("delete_file", {
    namespaceId,
    path,
  });
}

export function deleteFolder(namespaceId: string, path: string) {
  return invoke<NamespaceDetail>("delete_folder", {
    namespaceId,
    path,
  });
}

export function restoreDeletedContent(namespaceId: string, fileId: string) {
  return invoke<NamespaceDetail>("restore_deleted_content", {
    namespaceId,
    fileId,
  });
}

export function writeFileNote(namespaceId: string, path: string, note: string) {
  return invoke<ManagedFileContent>("write_file_note", {
    namespaceId,
    path,
    note,
  });
}

export function listContent(namespaceId: string) {
  return invoke<ContentTree>("list_content", {
    namespaceId,
  });
}

export function searchContent(namespaceId: string, query: string) {
  return invoke<SearchContentResult[]>("search_content", {
    namespaceId,
    query,
  });
}

export function listPageHistory(namespaceId: string, path: string) {
  return invoke<FileHistoryEntry[]>("list_page_history", {
    namespaceId,
    path,
  });
}

export function listFileHistory(namespaceId: string, path: string) {
  return invoke<FileHistoryEntry[]>("list_file_history", {
    namespaceId,
    path,
  });
}

export function listDeletedContent(namespaceId: string) {
  return invoke<DeletedContentSummary[]>("list_deleted_content", {
    namespaceId,
  });
}

export function setFavoriteContent(namespaceId: string, path: string, isFavorite: boolean) {
  return invoke<NamespaceDetail>("set_favorite_content", {
    namespaceId,
    path,
    isFavorite,
  });
}

export function listFavoriteContent(namespaceId: string) {
  return invoke<FavoriteContentSummary[]>("list_favorite_content", {
    namespaceId,
  });
}

export function readDeletedPage(namespaceId: string, fileId: string) {
  return invoke<PageContent>("read_deleted_page", {
    namespaceId,
    fileId,
  });
}

export function readDeletedFile(namespaceId: string, fileId: string) {
  return invoke<ManagedFileContent>("read_deleted_file", {
    namespaceId,
    fileId,
  });
}

export function readPageHistorySnapshot(namespaceId: string, path: string, revisionId: string) {
  return invoke<PageHistorySnapshot>("read_page_history_snapshot", {
    namespaceId,
    path,
    revisionId,
  });
}

export function openLocation(location: string, sourceNamespaceId: string | null) {
  return invoke<OpenLocationResult>("open_location", {
    location,
    sourceNamespaceId,
  });
}

export function openInitialLocation() {
  return invoke<OpenLocationResult>("open_initial_location");
}

export function resolveLocation(location: string, sourceNamespaceId: string | null) {
  return invoke<ResolvedLocation>("resolve_location", {
    location,
    sourceNamespaceId,
  });
}

export function resolveMarkdownLink(
  currentNamespaceId: string,
  currentPath: string,
  target: string,
) {
  return invoke<string>("resolve_markdown_link", {
    currentNamespaceId,
    currentPath,
    target,
  });
}

export function resolveMarkdownImage(
  currentNamespaceId: string,
  currentPath: string,
  target: string,
) {
  return invoke<MarkdownImageResolution>("resolve_markdown_image", {
    currentNamespaceId,
    currentPath,
    target,
  });
}

export function resolveMarkdownLinkStatus(
  currentNamespaceId: string,
  currentPath: string,
  target: string,
) {
  return invoke<MarkdownLinkStatus>("resolve_markdown_link_status", {
    currentNamespaceId,
    currentPath,
    target,
  });
}
