use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::PathBuf;

pub const DEFAULT_PAGE_PATH: &str = "Pages/Main.md";
pub const DEFAULT_MAIN_CONTENT: &str = "# Main\n\nここからコンテンツを作成します。\n";

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct NamespaceSummary {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub default_page: String,
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
    pub content: String,
    pub latest_revision_id: Option<String>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentTree {
    pub pages: Vec<FileSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSummary {
    pub file_id: String,
    pub path: String,
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
