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
};

export type ContentTree = {
  pages: FileSummary[];
  folders: FolderSummary[];
  files: FileSummary[];
};

export type FolderSummary = {
  path: string;
  title: string;
  location: string;
  display_path: string[];
};

export type NamespaceDetail = {
  namespace: NamespaceSummary;
  content: ContentTree;
};

export type PageContent = {
  namespace_id: string;
  file_id: string;
  path: string;
  title: string;
  location: string;
  content: string;
  latest_revision_id: string | null;
  is_virtual?: boolean;
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
  content_type: string;
  text_content: string | null;
  data_url: string | null;
  size: number;
  latest_revision_id: string | null;
  is_virtual?: boolean;
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

export type MarkdownLinkStatus = {
  location: string;
  exists: boolean;
  is_internal: boolean;
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
      kind: "specialPages";
      namespace: NamespaceSummary;
      location: string;
    }
  | {
      kind: "specialPagesList";
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
    };

export function listNamespaces() {
  return invoke<NamespaceSummary[]>("list_namespaces");
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
