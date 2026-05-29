use crate::models::{
    ContentTree, FileSummary, NamespaceDetail, NamespaceMetadata, NamespaceRegistry,
    NamespaceSummary, DEFAULT_MAIN_CONTENT, DEFAULT_PAGE_PATH,
};
use crate::paths::resolve_namespace_path;
use crate::versioning::{
    ensure_version_dirs, file_id_for_path, latest_revision_id, read_path_index,
    record_file_revision,
};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const REGISTRY_FILE_NAME: &str = "namespaces.json";

pub fn list_namespaces(app: &AppHandle) -> Result<Vec<NamespaceSummary>, String> {
    Ok(read_registry(app)?.namespaces)
}

pub fn create_namespace(
    app: &AppHandle,
    name: String,
    root_path: PathBuf,
) -> Result<NamespaceSummary, String> {
    if name.trim().is_empty() {
        return Err("ネームスペース名を入力してください。".to_string());
    }

    fs::create_dir_all(&root_path).map_err(to_error)?;
    ensure_version_dirs(&root_path)?;

    let now = Utc::now().to_rfc3339();
    let namespace = NamespaceSummary {
        id: Uuid::new_v4().to_string(),
        name: name.trim().to_string(),
        root_path,
        default_page: DEFAULT_PAGE_PATH.to_string(),
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    let metadata = NamespaceMetadata {
        schema_version: 1,
        namespace_id: namespace.id.clone(),
        name: namespace.name.clone(),
        default_page: namespace.default_page.clone(),
        created_at: namespace.created_at.clone(),
    };

    fs::create_dir_all(namespace.root_path.join(".daibase")).map_err(to_error)?;
    write_json_atomic(
        &namespace.root_path.join(".daibase/namespace.json"),
        &metadata,
    )?;

    let main_path = resolve_namespace_path(&namespace.root_path, DEFAULT_PAGE_PATH)?;
    if let Some(parent) = main_path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    if !main_path.exists() {
        fs::write(&main_path, DEFAULT_MAIN_CONTENT).map_err(to_error)?;
    }

    let main_content = fs::read(&main_path).map_err(to_error)?;
    record_file_revision(
        &namespace.root_path,
        &namespace.id,
        DEFAULT_PAGE_PATH,
        &main_content,
        "Create namespace",
    )?;

    let mut registry = read_registry(app)?;
    registry.namespaces.retain(|item| item.id != namespace.id);
    registry.last_active_namespace_id = Some(namespace.id.clone());
    registry.namespaces.push(namespace.clone());
    write_registry(app, &registry)?;

    Ok(namespace)
}

pub fn open_namespace(app: &AppHandle, namespace_id: String) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    ensure_namespace_ready(&namespace)?;
    mark_last_active_namespace(app, &namespace.id)?;

    Ok(NamespaceDetail {
        content: list_content_for_namespace(&namespace)?,
        namespace,
    })
}

pub fn read_page(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<crate::models::PageContent, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_page_path(&path)?;
    let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;

    if !resolved_path.exists() {
        return Err("ページが見つかりません。".to_string());
    }

    let content = fs::read_to_string(&resolved_path).map_err(to_error)?;
    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?
        .ok_or_else(|| "ページの履歴 ID が見つかりません。".to_string())?;
    let latest_revision_id = latest_revision_id(&namespace.root_path, &file_id)?;

    Ok(crate::models::PageContent {
        namespace_id,
        file_id,
        path: normalized_path,
        content,
        latest_revision_id,
        is_virtual: false,
    })
}

pub fn write_page(
    app: &AppHandle,
    namespace_id: String,
    path: String,
    content: String,
) -> Result<crate::models::SaveResult, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_page_path(&path)?;
    let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;
    if let Some(parent) = resolved_path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }

    fs::write(&resolved_path, content.as_bytes()).map_err(to_error)?;
    record_file_revision(
        &namespace.root_path,
        &namespace.id,
        &normalized_path,
        content.as_bytes(),
        &format!("Update {}", display_page_name(&normalized_path)),
    )
}

pub fn list_content(app: &AppHandle, namespace_id: String) -> Result<ContentTree, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    list_content_for_namespace(&namespace)
}

fn list_content_for_namespace(namespace: &NamespaceSummary) -> Result<ContentTree, String> {
    let mut pages = Vec::new();
    let path_index = read_path_index(&namespace.root_path)?;
    collect_markdown_pages(
        &namespace.root_path,
        &namespace.root_path.join("Pages"),
        &path_index.entries,
        &mut pages,
    )?;
    pages.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(ContentTree { pages })
}

fn collect_markdown_pages(
    root: &Path,
    current: &Path,
    path_index: &std::collections::BTreeMap<String, String>,
    pages: &mut Vec<FileSummary>,
) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if path.is_dir() {
            collect_markdown_pages(root, &path, path_index, pages)?;
            continue;
        }

        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .map_err(to_error)?
            .to_string_lossy()
            .replace('\\', "/");
        let file_id = path_index
            .get(&relative_path)
            .cloned()
            .unwrap_or_else(|| "".to_string());
        pages.push(FileSummary {
            file_id,
            path: relative_path,
        });
    }

    Ok(())
}

fn ensure_namespace_ready(namespace: &NamespaceSummary) -> Result<(), String> {
    if !namespace.root_path.exists() {
        return Err("ネームスペースの保存先フォルダが見つかりません。".to_string());
    }
    ensure_version_dirs(&namespace.root_path)?;
    Ok(())
}

fn read_registry(app: &AppHandle) -> Result<NamespaceRegistry, String> {
    let path = registry_path(app)?;
    if !path.exists() {
        return Ok(NamespaceRegistry::default());
    }

    let content = fs::read_to_string(path).map_err(to_error)?;
    serde_json::from_str(&content).map_err(to_error)
}

fn write_registry(app: &AppHandle, registry: &NamespaceRegistry) -> Result<(), String> {
    let path = registry_path(app)?;
    write_json_atomic(&path, registry)
}

fn registry_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(to_error)?;
    fs::create_dir_all(&app_data_dir).map_err(to_error)?;
    Ok(app_data_dir.join(REGISTRY_FILE_NAME))
}

fn find_namespace(app: &AppHandle, namespace_id: &str) -> Result<NamespaceSummary, String> {
    read_registry(app)?
        .namespaces
        .into_iter()
        .find(|namespace| namespace.id == namespace_id)
        .ok_or_else(|| "ネームスペースが見つかりません。".to_string())
}

fn mark_last_active_namespace(app: &AppHandle, namespace_id: &str) -> Result<(), String> {
    let mut registry = read_registry(app)?;
    registry.last_active_namespace_id = Some(namespace_id.to_string());
    write_registry(app, &registry)
}

fn display_page_name(path: &str) -> String {
    path.strip_prefix("Pages/")
        .unwrap_or(path)
        .strip_suffix(".md")
        .unwrap_or(path)
        .to_string()
}

fn write_json_atomic<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("保存先の親ディレクトリが見つかりません。".to_string());
    };
    fs::create_dir_all(parent).map_err(to_error)?;

    let temporary_path = path.with_extension("json.tmp");
    let content = serde_json::to_string_pretty(value).map_err(to_error)?;
    fs::write(&temporary_path, content).map_err(to_error)?;
    fs::rename(temporary_path, path).map_err(to_error)
}

fn to_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}
