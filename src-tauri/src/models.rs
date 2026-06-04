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
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub backlinks: Vec<BacklinkSummary>,
    pub latest_revision_id: Option<String>,
    pub is_virtual: bool,
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BacklinkSummary {
    pub path: String,
    pub title: String,
    pub location: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ManagedFileContent {
    pub namespace_id: String,
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub note: String,
    #[serde(default)]
    pub backlinks: Vec<BacklinkSummary>,
    pub content_type: String,
    pub text_content: Option<String>,
    pub data_url: Option<String>,
    pub size: u64,
    pub latest_revision_id: Option<String>,
    pub is_virtual: bool,
    #[serde(default)]
    pub is_favorite: bool,
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

#[derive(Debug, Serialize)]
pub struct McpServerStatus {
    pub enabled: bool,
    pub transport: String,
    pub url: String,
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
    #[serde(default)]
    pub is_favorite: bool,
}

#[derive(Debug, Serialize)]
pub struct SpecialPageSummary {
    pub title: String,
    pub description: String,
    pub location: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct DeletedContentSummary {
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub content_kind: String,
    pub deleted_at: String,
    pub latest_revision_id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct FavoriteContentSummary {
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
    pub content_kind: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CategoryPageSummary {
    pub file_id: String,
    pub path: String,
    pub title: String,
    pub location: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CategoryGroupSummary {
    pub name: String,
    pub pages: Vec<CategoryPageSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginRegistry {
    pub schema_version: u32,
    #[serde(default)]
    pub plugins: Vec<InstalledPluginSummary>,
}

impl Default for PluginRegistry {
    fn default() -> Self {
        Self {
            schema_version: 1,
            plugins: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPluginSummary {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub enabled: bool,
    pub source: PluginInstallSource,
    pub manifest: PluginManifest,
}

#[derive(Debug, Serialize)]
pub struct PluginMainResolution {
    pub path: PathBuf,
    pub html: String,
}

#[derive(Debug, Serialize)]
pub struct PluginDocumentation {
    pub plugin_id: String,
    pub path: PathBuf,
    pub markdown: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PluginInstallSource {
    LocalFolder { path: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginManifest {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    pub main: String,
    #[serde(default)]
    pub contributions: Vec<PluginContribution>,
    #[serde(default)]
    pub permissions: Vec<PluginPermission>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum PluginContribution {
    PageView {
        id: String,
        name: String,
        #[serde(default)]
        slot: PluginViewSlot,
        #[serde(default)]
        r#match: PluginContributionMatch,
        view: PluginViewContribution,
        #[serde(default)]
        activation: PluginActivation,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum PluginViewSlot {
    #[default]
    Main,
    SidebarSection,
    RightPanel,
    BottomPanel,
    Toolbar,
    StatusBar,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PluginContributionMatch {
    #[serde(default)]
    pub frontmatter: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PluginViewContribution {
    pub kind: PluginViewKind,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PluginViewKind {
    Custom,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PluginActivation {
    #[serde(default, rename = "autoOpen")]
    pub auto_open: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum PluginPermission {
    PageRead,
    PageWrite,
    FileRead,
    FileWrite,
    NamespaceRead,
    HistoryRead,
    LocationOpen,
    UiNotify,
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
    SpecialDeletedPages {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        items: Vec<DeletedContentSummary>,
    },
    SpecialFavorites {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        items: Vec<FavoriteContentSummary>,
    },
    SpecialCategories {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        categories: Vec<CategoryGroupSummary>,
        uncategorized_pages: Vec<CategoryPageSummary>,
    },
    SpecialPlugins {
        location: String,
        namespace: NamespaceSummary,
        content: ContentTree,
        plugins: Vec<InstalledPluginSummary>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PathIndex {
    pub schema_version: u32,
    pub entries: BTreeMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FavoriteIndex {
    pub schema_version: u32,
    #[serde(default)]
    pub paths: Vec<String>,
}

impl Default for FavoriteIndex {
    fn default() -> Self {
        Self {
            schema_version: 1,
            paths: Vec::new(),
        }
    }
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
