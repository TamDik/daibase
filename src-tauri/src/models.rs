use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

pub const DEFAULT_PAGE_PATH: &str = "Main.md";
pub const DEFAULT_MAIN_CONTENT: &str = "# Main\n\nここからコンテンツを作成します。\n";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct NamespaceSummary {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub default_page: String,
    #[serde(default)]
    pub default_location: String,
    #[serde(default)]
    pub pages_location: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamespaceRegistry {
    pub schema_version: u32,
    pub last_active_namespace_id: Option<String>,
    pub namespaces: Vec<NamespaceSummary>,
}

impl Default for NamespaceRegistry {
    fn default() -> Self {
        Self {
            schema_version: 1,
            last_active_namespace_id: None,
            namespaces: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamespaceMetadata {
    pub schema_version: u32,
    pub namespace_id: String,
    pub name: String,
    pub default_page: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NamespaceDetail {
    pub namespace: NamespaceSummary,
    pub content: ContentTree,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PageContent {
    pub namespace_id: String,
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub content: String,
    pub latest_revision_id: Option<String>,
    pub is_virtual: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ManagedFileContent {
    pub namespace_id: String,
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub note: String,
    pub content_type: String,
    pub text_content: Option<String>,
    pub data_url: Option<String>,
    pub size: u64,
    pub latest_revision_id: Option<String>,
    pub is_virtual: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveResult {
    pub namespace_id: String,
    pub file_id: String,
    pub path: String,
    pub revision_id: String,
    pub object_id: String,
    pub saved_at: String,
}

#[derive(Debug, Serialize)]
pub struct SavePageResult {
    pub location: String,
    pub namespace: NamespaceSummary,
    pub content: ContentTree,
    pub page: PageContent,
    pub save: SaveResult,
}

#[derive(Debug, Serialize)]
pub struct SaveFileResult {
    pub location: String,
    pub namespace: NamespaceSummary,
    pub content: ContentTree,
    pub file: ManagedFileContent,
    pub save: SaveResult,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentTree {
    #[serde(default)]
    pub folders: Vec<FolderSummary>,
    pub pages: Vec<FileSummary>,
    #[serde(default)]
    pub files: Vec<FileSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FolderSummary {
    pub path: String,
    pub title: String,
    pub display_path: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSummary {
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub display_path: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct SpecialPageSummary {
    pub title: String,
    pub description: String,
    pub location: String,
}

#[derive(Debug, Serialize)]
pub struct MarkdownLinkStatus {
    pub location: String,
    pub exists: bool,
    pub is_internal: bool,
}

#[derive(Debug, Serialize)]
pub struct MarkdownImageResolution {
    pub location: String,
    pub exists: bool,
    pub is_internal: bool,
    pub is_image: bool,
    pub content_type: Option<String>,
    pub data_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum OpenLocationResult {
    Page {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        page: PageContent,
    },
    File {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        file: ManagedFileContent,
    },
    SpecialNamespaces {
        location: String,
        namespaces: Vec<NamespaceSummary>,
    },
    SpecialPages {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        pages: Vec<SpecialPageSummary>,
    },
    SpecialPagesList {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathIndex {
    pub schema_version: u32,
    pub entries: BTreeMap<String, String>,
}

impl Default for PathIndex {
    fn default() -> Self {
        Self {
            schema_version: 1,
            entries: BTreeMap::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileHistoryIndex {
    pub schema_version: u32,
    pub file_id: String,
    pub current_path: String,
    pub revisions: Vec<FileHistoryEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileHistoryEntry {
    pub revision_id: String,
    pub object_id: String,
    pub created_at: String,
    pub kind: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct PageHistorySnapshot {
    pub entry: FileHistoryEntry,
    pub content: String,
    pub previous_content: Option<String>,
    pub diff_sections: Vec<SideBySideDiffSection>,
}

#[derive(Debug, Serialize)]
pub struct SideBySideDiffSection {
    pub kind: String,
    pub id: String,
    pub rows: Vec<SideBySideDiffRow>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SideBySideDiffRow {
    pub kind: String,
    pub old_line_number: Option<usize>,
    pub old_text: Option<String>,
    pub new_line_number: Option<usize>,
    pub new_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Revision {
    pub schema_version: u32,
    pub revision_id: String,
    pub created_at: String,
    pub device_id: String,
    pub parent_revision_ids: Vec<String>,
    pub message: String,
    pub changes: Vec<RevisionChange>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RevisionChange {
    pub file_id: String,
    pub path: String,
    pub kind: String,
    pub content_type: String,
    pub object_id: String,
    pub size: u64,
}
