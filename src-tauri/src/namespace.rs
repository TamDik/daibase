use crate::models::{
    BacklinkSummary, CategoryGroupSummary, CategoryPageSummary, ContentTree, DeletedContentSummary,
    FavoriteContentSummary, FileHistoryEntry, FileSummary, FolderSummary, NamespaceDetail,
    NamespaceMetadata, NamespaceRegistry, NamespaceSummary, PageHistorySnapshot, SaveFileResult,
    SearchContentResult, SideBySideDiffRow, SideBySideDiffSection, SpecialPageSummary,
    DEFAULT_MAIN_CONTENT, DEFAULT_PAGE_PATH,
};
use crate::paths::{
    resolve_namespace_file_path, resolve_namespace_folder_path, resolve_namespace_path,
};
use crate::versioning::{
    ensure_version_dirs, file_id_for_path, is_favorite_path, latest_revision_id,
    read_favorite_index, read_file_history, read_object, read_path_index, read_text_object,
    record_file_deletion, record_file_revision, record_file_revision_with_content_type,
    set_favorite_path, write_path_index,
};
use chrono::Utc;
use nucleo_matcher::{Config, Matcher, Utf32Str};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

const REGISTRY_FILE_NAME: &str = "namespaces.json";

pub fn list_namespaces(app: &AppHandle) -> Result<Vec<NamespaceSummary>, String> {
    Ok(read_registry(app)?.namespaces)
}

pub fn initial_namespace(app: &AppHandle) -> Result<Option<NamespaceSummary>, String> {
    let registry = read_registry(app)?;
    let namespace = registry
        .last_active_namespace_id
        .as_deref()
        .and_then(|namespace_id| {
            registry
                .namespaces
                .iter()
                .find(|namespace| namespace.id == namespace_id)
        })
        .or_else(|| registry.namespaces.first())
        .cloned();
    Ok(namespace)
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
        default_location: format!("{}:{DEFAULT_PAGE_PATH}", name.trim()),
        pages_location: format!("{}:Special:Pages", name.trim()),
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
    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?.unwrap_or_default();
    let latest_revision_id = if file_id.is_empty() {
        None
    } else {
        latest_revision_id(&namespace.root_path, &file_id)?
    };

    let title = page_title(&normalized_path);
    let location = page_location(&normalized_path, &namespace);
    let backlinks = page_backlinks_for_namespace(&namespace, &normalized_path)?;

    let is_favorite = is_favorite_path(&namespace.root_path, &normalized_path)?;

    Ok(crate::models::PageContent {
        namespace_id,
        file_id,
        path: normalized_path.clone(),
        title,
        location,
        categories: markdown_categories(&content),
        content,
        backlinks,
        latest_revision_id,
        is_virtual: false,
        is_favorite,
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

pub fn read_managed_file(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<crate::models::ManagedFileContent, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    read_managed_file_for_namespace(&namespace, &path)
}

pub fn upload_file(
    app: &AppHandle,
    namespace_id: String,
    path: String,
    source_path: PathBuf,
) -> Result<SaveFileResult, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_file_path(&path)?;
    let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
    let content = fs::read(&source_path).map_err(to_error)?;
    let content_type = guess_content_type_from_bytes(&content, Some(&source_path));
    if let Some(parent) = resolved_path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }

    fs::write(&resolved_path, &content).map_err(to_error)?;
    let save = record_file_revision_with_content_type(
        &namespace.root_path,
        &namespace.id,
        &normalized_path,
        &content,
        &content_type,
        &format!("Update {}", display_file_name(&normalized_path)),
    )?;
    let detail = open_namespace(app, namespace.id.clone())?;
    let file = read_managed_file_for_namespace(&detail.namespace, &normalized_path)?;
    let location = file.location.clone();

    Ok(SaveFileResult {
        location,
        namespace: detail.namespace,
        content: detail.content,
        file,
        save,
    })
}

pub fn create_folder(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_folder_path(&path)?;
    let resolved_path = resolve_namespace_folder_path(&namespace.root_path, &normalized_path)?;
    fs::create_dir_all(&resolved_path).map_err(to_error)?;
    open_namespace(app, namespace_id)
}

pub fn delete_page(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_page_path(&path)?;
    let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;
    if !resolved_path.is_file() {
        return Err("削除対象のページが見つかりません。".to_string());
    }

    if file_id_for_path(&namespace.root_path, &normalized_path)?.is_some() {
        record_file_deletion(
            &namespace.root_path,
            &namespace.id,
            &normalized_path,
            "text/markdown",
            &format!("Delete {}", display_page_name(&normalized_path)),
        )?;
    }
    fs::remove_file(resolved_path).map_err(to_error)?;
    open_namespace(app, namespace_id)
}

pub fn delete_file(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_file_path(&path)?;
    let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
    if !resolved_path.is_file() {
        return Err("削除対象のファイルが見つかりません。".to_string());
    }
    let content = fs::read(&resolved_path).map_err(to_error)?;
    let content_type = guess_content_type_from_bytes(&content, Some(Path::new(&normalized_path)));

    if file_id_for_path(&namespace.root_path, &normalized_path)?.is_some() {
        record_file_deletion(
            &namespace.root_path,
            &namespace.id,
            &normalized_path,
            &content_type,
            &format!("Delete {}", display_file_name(&normalized_path)),
        )?;
    }
    fs::remove_file(resolved_path).map_err(to_error)?;
    open_namespace(app, namespace_id)
}

pub fn delete_folder(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_folder_path(&path)?;
    let resolved_path = resolve_namespace_folder_path(&namespace.root_path, &normalized_path)?;
    if !resolved_path.is_dir() {
        return Err("削除対象のフォルダーが見つかりません。".to_string());
    }

    let mut file_paths = Vec::new();
    collect_visible_file_paths(&namespace.root_path, &resolved_path, &mut file_paths)?;
    file_paths.sort();
    for file_path in file_paths {
        if file_id_for_path(&namespace.root_path, &file_path)?.is_none() {
            continue;
        }
        if file_path.ends_with(".md") {
            record_file_deletion(
                &namespace.root_path,
                &namespace.id,
                &file_path,
                "text/markdown",
                &format!("Delete {}", display_page_name(&file_path)),
            )?;
        } else {
            let resolved_file_path = resolve_namespace_file_path(&namespace.root_path, &file_path)?;
            let content = fs::read(&resolved_file_path).map_err(to_error)?;
            let content_type = guess_content_type_from_bytes(&content, Some(Path::new(&file_path)));
            record_file_deletion(
                &namespace.root_path,
                &namespace.id,
                &file_path,
                &content_type,
                &format!("Delete {}", display_file_name(&file_path)),
            )?;
        }
    }

    fs::remove_dir_all(resolved_path).map_err(to_error)?;
    open_namespace(app, namespace_id)
}

pub fn restore_deleted_content(
    app: &AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let history = read_file_history(&namespace.root_path, &file_id)?
        .ok_or_else(|| "削除済みコンテンツの履歴が見つかりません。".to_string())?;
    let latest = history
        .revisions
        .last()
        .ok_or_else(|| "削除済みコンテンツの revision が見つかりません。".to_string())?;
    let content = read_object(&namespace.root_path, &latest.object_id)?;
    let normalized_path = latest.path.clone();
    if normalized_path.ends_with(".md") {
        let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;
        if resolved_path.exists() {
            return Err("復活先に同名のページが存在します。".to_string());
        }
        if let Some(parent) = resolved_path.parent() {
            fs::create_dir_all(parent).map_err(to_error)?;
        }
        fs::write(&resolved_path, &content).map_err(to_error)?;
        restore_path_index_entry(&namespace.root_path, &normalized_path, &file_id)?;
        record_file_revision(
            &namespace.root_path,
            &namespace.id,
            &normalized_path,
            &content,
            &format!("Restore {}", display_page_name(&normalized_path)),
        )?;
    } else {
        let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
        if resolved_path.exists() {
            return Err("復活先に同名のファイルが存在します。".to_string());
        }
        if let Some(parent) = resolved_path.parent() {
            fs::create_dir_all(parent).map_err(to_error)?;
        }
        fs::write(&resolved_path, &content).map_err(to_error)?;
        let content_type =
            guess_content_type_from_bytes(&content, Some(Path::new(&normalized_path)));
        restore_path_index_entry(&namespace.root_path, &normalized_path, &file_id)?;
        record_file_revision_with_content_type(
            &namespace.root_path,
            &namespace.id,
            &normalized_path,
            &content,
            &content_type,
            &format!("Restore {}", display_file_name(&normalized_path)),
        )?;
    }

    open_namespace(app, namespace_id)
}

pub fn write_file_note(
    app: &AppHandle,
    namespace_id: String,
    path: String,
    note: String,
) -> Result<crate::models::ManagedFileContent, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let file = read_managed_file_for_namespace(&namespace, &path)?;
    if file.is_virtual {
        return Err("ファイルをアップロードしてから説明を保存してください。".to_string());
    }

    let note_path = file_note_path(&namespace.root_path, &file.file_id)?;
    if let Some(parent) = note_path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    fs::write(note_path, note).map_err(to_error)?;

    read_managed_file_for_namespace(&namespace, &file.path)
}

pub fn list_content(app: &AppHandle, namespace_id: String) -> Result<ContentTree, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    list_content_for_namespace(&namespace)
}

pub fn search_content(
    app: &AppHandle,
    namespace_id: String,
    query: String,
) -> Result<Vec<SearchContentResult>, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    search_content_for_namespace(&namespace, &query)
}

pub fn page_exists_for_namespace(namespace: &NamespaceSummary, path: &str) -> Result<bool, String> {
    let normalized_path = crate::paths::validate_page_path(path)?;
    let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;
    Ok(resolved_path.is_file())
}

pub fn file_exists_for_namespace(namespace: &NamespaceSummary, path: &str) -> Result<bool, String> {
    let normalized_path = crate::paths::validate_file_path(path)?;
    let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
    Ok(resolved_path.is_file())
}

pub fn page_backlinks_for_namespace(
    namespace: &NamespaceSummary,
    path: &str,
) -> Result<Vec<BacklinkSummary>, String> {
    let normalized_path = crate::paths::validate_page_path(path)?;
    let target_location = page_location(&normalized_path, namespace);
    content_backlinks_for_namespace(namespace, &normalized_path, &target_location, false)
}

pub fn file_backlinks_for_namespace(
    namespace: &NamespaceSummary,
    path: &str,
) -> Result<Vec<BacklinkSummary>, String> {
    let normalized_path = crate::paths::validate_file_path(path)?;
    let target_location = file_location(&normalized_path, namespace);
    content_backlinks_for_namespace(namespace, &normalized_path, &target_location, true)
}

fn content_backlinks_for_namespace(
    namespace: &NamespaceSummary,
    normalized_path: &str,
    target_location: &str,
    include_images: bool,
) -> Result<Vec<BacklinkSummary>, String> {
    let content = list_content_for_namespace(namespace)?;
    let mut backlinks = Vec::new();

    for page in content.pages {
        if page.path == normalized_path && target_location == page.location {
            continue;
        }

        let page_path = resolve_namespace_path(&namespace.root_path, &page.path)?;
        let page_content = fs::read_to_string(page_path).map_err(to_error)?;
        let links_to_target = extract_markdown_reference_targets(&page_content, include_images)
            .into_iter()
            .filter(|target| !crate::location::is_external_markdown_link_target(target))
            .any(|target| {
                crate::location::resolve_markdown_link(namespace, &page.path, &target)
                    == target_location
            });

        if links_to_target {
            backlinks.push(BacklinkSummary {
                path: page.path,
                title: page.title,
                location: page.location,
            });
        }
    }

    backlinks.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(backlinks)
}

pub fn list_file_history(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<Vec<FileHistoryEntry>, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_file_path(&path)?;
    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?
        .ok_or_else(|| "ファイルの履歴 ID が見つかりません。".to_string())?;
    let Some(history) = read_file_history(&namespace.root_path, &file_id)? else {
        return Ok(Vec::new());
    };

    Ok(history.revisions.into_iter().rev().collect())
}

pub fn list_page_history(
    app: &AppHandle,
    namespace_id: String,
    path: String,
) -> Result<Vec<FileHistoryEntry>, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_page_path(&path)?;
    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?
        .ok_or_else(|| "ページの履歴 ID が見つかりません。".to_string())?;
    let Some(history) = read_file_history(&namespace.root_path, &file_id)? else {
        return Ok(Vec::new());
    };

    Ok(history.revisions.into_iter().rev().collect())
}

pub fn list_deleted_content(
    app: &AppHandle,
    namespace_id: String,
) -> Result<Vec<DeletedContentSummary>, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let path_index = read_path_index(&namespace.root_path)?;
    let mut items = Vec::new();
    for (indexed_path, file_id) in path_index.entries {
        let resolved_path = if indexed_path.ends_with(".md") {
            match resolve_namespace_path(&namespace.root_path, &indexed_path) {
                Ok(path) => path,
                Err(_) => continue,
            }
        } else {
            match resolve_namespace_file_path(&namespace.root_path, &indexed_path) {
                Ok(path) => path,
                Err(_) => continue,
            }
        };
        if resolved_path.is_file() {
            continue;
        }

        let Some(history) = read_file_history(&namespace.root_path, &file_id)? else {
            continue;
        };
        let Some(latest) = history.revisions.last() else {
            continue;
        };
        let content_kind = if indexed_path.ends_with(".md") {
            "page"
        } else {
            "file"
        };
        items.push(DeletedContentSummary {
            file_id: history.file_id.clone(),
            path: indexed_path.clone(),
            title: if content_kind == "page" {
                page_title(&indexed_path)
            } else {
                file_title(&indexed_path)
            },
            location: file_location(&indexed_path, &namespace),
            content_kind: content_kind.to_string(),
            deleted_at: latest.created_at.clone(),
            latest_revision_id: latest.revision_id.clone(),
        });
    }

    items.sort_by(|left, right| {
        right
            .deleted_at
            .cmp(&left.deleted_at)
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(items)
}

pub fn set_favorite_content(
    app: &AppHandle,
    namespace_id: String,
    path: String,
    is_favorite: bool,
) -> Result<NamespaceDetail, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = validate_existing_content_path(&namespace, &path)?;
    set_favorite_path(&namespace.root_path, &normalized_path, is_favorite)?;
    open_namespace(app, namespace_id)
}

pub fn list_favorite_content(
    app: &AppHandle,
    namespace_id: String,
) -> Result<Vec<FavoriteContentSummary>, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let favorite_index = read_favorite_index(&namespace.root_path)?;
    let path_index = read_path_index(&namespace.root_path)?;
    let mut items = Vec::new();

    for indexed_path in favorite_index.paths {
        let resolved_path = if indexed_path.ends_with(".md") {
            match resolve_namespace_path(&namespace.root_path, &indexed_path) {
                Ok(path) => path,
                Err(_) => continue,
            }
        } else {
            match resolve_namespace_file_path(&namespace.root_path, &indexed_path) {
                Ok(path) => path,
                Err(_) => continue,
            }
        };
        if !resolved_path.is_file() {
            continue;
        }

        let content_kind = if indexed_path.ends_with(".md") {
            "page"
        } else {
            "file"
        };
        items.push(FavoriteContentSummary {
            file_id: path_index
                .entries
                .get(&indexed_path)
                .cloned()
                .unwrap_or_default(),
            path: indexed_path.clone(),
            title: if content_kind == "page" {
                page_title(&indexed_path)
            } else {
                file_title(&indexed_path)
            },
            location: file_location(&indexed_path, &namespace),
            content_kind: content_kind.to_string(),
        });
    }

    items.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(items)
}

pub fn list_category_groups(
    namespace: &NamespaceSummary,
) -> Result<Vec<CategoryGroupSummary>, String> {
    let content = list_content_for_namespace(namespace)?;
    let mut groups = std::collections::BTreeMap::<String, Vec<CategoryPageSummary>>::new();

    for page in content.pages {
        let page_path = resolve_namespace_path(&namespace.root_path, &page.path)?;
        let page_content = fs::read_to_string(page_path).map_err(to_error)?;
        let categories = markdown_categories(&page_content);
        let summary = CategoryPageSummary {
            file_id: page.file_id,
            path: page.path,
            title: page.title,
            location: page.location,
        };

        if categories.is_empty() {
            continue;
        }

        for category in categories {
            groups.entry(category).or_default().push(summary.clone());
        }
    }

    let mut categories = groups
        .into_iter()
        .map(|(name, mut pages)| {
            pages.sort_by(|left, right| left.path.cmp(&right.path));
            CategoryGroupSummary { name, pages }
        })
        .collect::<Vec<_>>();
    categories.sort_by(|left, right| left.name.cmp(&right.name));

    Ok(categories)
}

pub fn read_deleted_page(
    app: &AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<crate::models::PageContent, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let (entry, content) = read_deleted_entry_object(&namespace, &file_id)?;
    let normalized_path = crate::paths::validate_page_path(&entry.path)?;
    let title = page_title(&normalized_path);
    let location = page_location(&normalized_path, &namespace);

    Ok(crate::models::PageContent {
        namespace_id,
        file_id,
        path: normalized_path.clone(),
        title,
        location,
        content: String::from_utf8(content).map_err(to_error)?,
        categories: Vec::new(),
        backlinks: Vec::new(),
        latest_revision_id: Some(entry.revision_id),
        is_virtual: true,
        is_favorite: false,
    })
}

fn validate_existing_content_path(
    namespace: &NamespaceSummary,
    path: &str,
) -> Result<String, String> {
    if path.ends_with(".md") {
        let normalized_path = crate::paths::validate_page_path(path)?;
        let resolved_path = resolve_namespace_path(&namespace.root_path, &normalized_path)?;
        if !resolved_path.is_file() {
            return Err("お気に入り対象のページが見つかりません。".to_string());
        }
        return Ok(normalized_path);
    }

    let normalized_path = crate::paths::validate_file_path(path)?;
    let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
    if !resolved_path.is_file() {
        return Err("お気に入り対象のファイルが見つかりません。".to_string());
    }
    Ok(normalized_path)
}

pub fn read_deleted_file(
    app: &AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<crate::models::ManagedFileContent, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let (entry, content) = read_deleted_entry_object(&namespace, &file_id)?;
    let normalized_path = crate::paths::validate_file_path(&entry.path)?;
    let title = file_title(&normalized_path);
    let location = file_location(&normalized_path, &namespace);
    let content_type = guess_content_type_from_bytes(&content, Some(Path::new(&normalized_path)));
    let text_content = if is_text_content_type(&content_type) {
        Some(String::from_utf8(content.clone()).map_err(to_error)?)
    } else {
        None
    };
    let data_url = if is_embeddable_content_type(&content_type) {
        Some(format!(
            "data:{content_type};base64,{}",
            encode_base64(&content)
        ))
    } else {
        None
    };

    Ok(crate::models::ManagedFileContent {
        namespace_id,
        file_id,
        path: normalized_path,
        title,
        location,
        note: String::new(),
        backlinks: Vec::new(),
        content_type,
        text_content,
        data_url,
        size: content.len() as u64,
        latest_revision_id: Some(entry.revision_id),
        is_virtual: true,
        is_favorite: false,
    })
}

pub fn read_page_history_snapshot(
    app: &AppHandle,
    namespace_id: String,
    path: String,
    revision_id: String,
) -> Result<PageHistorySnapshot, String> {
    let namespace = find_namespace(app, &namespace_id)?;
    let normalized_path = crate::paths::validate_page_path(&path)?;
    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?
        .ok_or_else(|| "ページの履歴 ID が見つかりません。".to_string())?;
    let history = read_file_history(&namespace.root_path, &file_id)?
        .ok_or_else(|| "ページの履歴が見つかりません。".to_string())?;
    let revision_index = history
        .revisions
        .iter()
        .position(|entry| entry.revision_id == revision_id)
        .ok_or_else(|| "指定された revision が履歴内に見つかりません。".to_string())?;
    let entry = history.revisions[revision_index].clone();
    let previous_content = revision_index
        .checked_sub(1)
        .map(|index| read_text_object(&namespace.root_path, &history.revisions[index].object_id))
        .transpose()?;
    let content = read_text_object(&namespace.root_path, &entry.object_id)?;
    let diff_sections =
        build_side_by_side_diff(previous_content.as_deref().unwrap_or(""), &content);

    Ok(PageHistorySnapshot {
        entry,
        content,
        previous_content,
        diff_sections,
    })
}

#[derive(Clone)]
enum DiffLine {
    Unchanged {
        old_line_number: usize,
        new_line_number: usize,
        text: String,
    },
    Removed {
        old_line_number: usize,
        text: String,
    },
    Added {
        new_line_number: usize,
        text: String,
    },
}

fn build_side_by_side_diff(old_content: &str, new_content: &str) -> Vec<SideBySideDiffSection> {
    group_diff_rows(pair_changed_rows(build_line_diff(old_content, new_content)))
}

fn build_line_diff(old_content: &str, new_content: &str) -> Vec<DiffLine> {
    let old_lines = split_content_lines(old_content);
    let new_lines = split_content_lines(new_content);
    let mut matrix = vec![vec![0usize; new_lines.len() + 1]; old_lines.len() + 1];

    for old_index in (0..old_lines.len()).rev() {
        for new_index in (0..new_lines.len()).rev() {
            matrix[old_index][new_index] = if old_lines[old_index] == new_lines[new_index] {
                matrix[old_index + 1][new_index + 1] + 1
            } else {
                matrix[old_index + 1][new_index].max(matrix[old_index][new_index + 1])
            };
        }
    }

    let mut diff = Vec::new();
    let mut old_index = 0;
    let mut new_index = 0;
    while old_index < old_lines.len() && new_index < new_lines.len() {
        if old_lines[old_index] == new_lines[new_index] {
            diff.push(DiffLine::Unchanged {
                old_line_number: old_index + 1,
                new_line_number: new_index + 1,
                text: old_lines[old_index].to_string(),
            });
            old_index += 1;
            new_index += 1;
        } else if matrix[old_index + 1][new_index] >= matrix[old_index][new_index + 1] {
            diff.push(DiffLine::Removed {
                old_line_number: old_index + 1,
                text: old_lines[old_index].to_string(),
            });
            old_index += 1;
        } else {
            diff.push(DiffLine::Added {
                new_line_number: new_index + 1,
                text: new_lines[new_index].to_string(),
            });
            new_index += 1;
        }
    }

    while old_index < old_lines.len() {
        diff.push(DiffLine::Removed {
            old_line_number: old_index + 1,
            text: old_lines[old_index].to_string(),
        });
        old_index += 1;
    }
    while new_index < new_lines.len() {
        diff.push(DiffLine::Added {
            new_line_number: new_index + 1,
            text: new_lines[new_index].to_string(),
        });
        new_index += 1;
    }

    diff
}

fn pair_changed_rows(diff: Vec<DiffLine>) -> Vec<SideBySideDiffRow> {
    let mut rows = Vec::new();
    let mut index = 0;

    while index < diff.len() {
        match &diff[index] {
            DiffLine::Unchanged {
                old_line_number,
                new_line_number,
                text,
            } => {
                rows.push(SideBySideDiffRow {
                    kind: "unchanged".to_string(),
                    old_line_number: Some(*old_line_number),
                    old_text: Some(text.clone()),
                    new_line_number: Some(*new_line_number),
                    new_text: Some(text.clone()),
                });
                index += 1;
            }
            DiffLine::Removed { .. } | DiffLine::Added { .. } => {
                let mut removed = Vec::new();
                let mut added = Vec::new();
                while index < diff.len() {
                    match &diff[index] {
                        DiffLine::Removed {
                            old_line_number,
                            text,
                        } => removed.push((*old_line_number, text.clone())),
                        DiffLine::Added {
                            new_line_number,
                            text,
                        } => added.push((*new_line_number, text.clone())),
                        DiffLine::Unchanged { .. } => break,
                    }
                    index += 1;
                }

                let paired_length = removed.len().min(added.len());
                for pair_index in 0..paired_length {
                    rows.push(SideBySideDiffRow {
                        kind: "modified".to_string(),
                        old_line_number: Some(removed[pair_index].0),
                        old_text: Some(removed[pair_index].1.clone()),
                        new_line_number: Some(added[pair_index].0),
                        new_text: Some(added[pair_index].1.clone()),
                    });
                }
                for removed_item in removed.iter().skip(paired_length) {
                    rows.push(SideBySideDiffRow {
                        kind: "removed".to_string(),
                        old_line_number: Some(removed_item.0),
                        old_text: Some(removed_item.1.clone()),
                        new_line_number: None,
                        new_text: None,
                    });
                }
                for added_item in added.iter().skip(paired_length) {
                    rows.push(SideBySideDiffRow {
                        kind: "added".to_string(),
                        old_line_number: None,
                        old_text: None,
                        new_line_number: Some(added_item.0),
                        new_text: Some(added_item.1.clone()),
                    });
                }
            }
        }
    }

    rows
}

fn group_diff_rows(rows: Vec<SideBySideDiffRow>) -> Vec<SideBySideDiffSection> {
    let mut sections = Vec::new();
    let mut current_rows = Vec::new();
    let mut current_kind: Option<String> = None;

    for row in rows {
        let next_kind = if row.kind == "unchanged" {
            "unchanged"
        } else {
            "changed"
        };
        if current_kind
            .as_deref()
            .is_some_and(|kind| kind != next_kind)
        {
            sections.push(diff_section(
                current_kind.take().unwrap_or_default(),
                sections.len(),
                std::mem::take(&mut current_rows),
            ));
        }
        current_kind = Some(next_kind.to_string());
        current_rows.push(row);
    }

    if let Some(kind) = current_kind {
        sections.push(diff_section(kind, sections.len(), current_rows));
    }

    sections
}

fn diff_section(kind: String, index: usize, rows: Vec<SideBySideDiffRow>) -> SideBySideDiffSection {
    SideBySideDiffSection {
        id: format!("{kind}-{index}"),
        kind,
        rows,
    }
}

fn split_content_lines(content: &str) -> Vec<&str> {
    if content.is_empty() {
        Vec::new()
    } else {
        content.split('\n').collect()
    }
}

fn extract_markdown_reference_targets(content: &str, include_images: bool) -> Vec<String> {
    let mut targets = Vec::new();
    let chars = content.char_indices().collect::<Vec<_>>();
    let mut index = 0;

    while index < chars.len() {
        let (byte_index, char) = chars[index];
        if char != '[' || (!include_images && content[..byte_index].ends_with('!')) {
            index += 1;
            continue;
        }

        let Some(label_end_index) = find_next_char(&chars, index + 1, ']') else {
            index += 1;
            continue;
        };
        if chars.get(label_end_index + 1).map(|(_, char)| *char) != Some('(') {
            index = label_end_index + 1;
            continue;
        }

        let target_start_index = label_end_index + 2;
        let Some(target_end_index) = find_next_char(&chars, target_start_index, ')') else {
            index = label_end_index + 1;
            continue;
        };

        let target_start_byte = chars
            .get(target_start_index)
            .map(|(byte_index, _)| *byte_index)
            .unwrap_or(content.len());
        let target_end_byte = chars
            .get(target_end_index)
            .map(|(byte_index, _)| *byte_index)
            .unwrap_or(content.len());
        let target = content[target_start_byte..target_end_byte].trim();
        if !target.is_empty() {
            targets.push(target.to_string());
        }
        index = target_end_index + 1;
    }

    targets
}

fn find_next_char(chars: &[(usize, char)], start_index: usize, target: char) -> Option<usize> {
    chars
        .iter()
        .enumerate()
        .skip(start_index)
        .find_map(|(index, (_, char))| (*char == target).then_some(index))
}

fn list_content_for_namespace(namespace: &NamespaceSummary) -> Result<ContentTree, String> {
    let mut folders = Vec::new();
    let mut pages = Vec::new();
    let mut files = Vec::new();
    let path_index = read_path_index(&namespace.root_path)?;
    let favorite_index = read_favorite_index(&namespace.root_path)?;
    let context = ContentCollectionContext {
        namespace,
        root: &namespace.root_path,
        path_index: &path_index.entries,
        favorite_paths: &favorite_index.paths,
    };
    collect_content_entries(
        &context,
        &namespace.root_path,
        &mut folders,
        &mut pages,
        &mut files,
    )?;
    folders.sort_by(|left, right| left.path.cmp(&right.path));
    pages.sort_by(|left, right| left.path.cmp(&right.path));
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(ContentTree {
        folders,
        pages,
        files,
    })
}

struct ContentCollectionContext<'a> {
    namespace: &'a NamespaceSummary,
    root: &'a Path,
    path_index: &'a std::collections::BTreeMap<String, String>,
    favorite_paths: &'a [String],
}

fn collect_content_entries(
    context: &ContentCollectionContext<'_>,
    current: &Path,
    folders: &mut Vec<FolderSummary>,
    pages: &mut Vec<FileSummary>,
    files: &mut Vec<FileSummary>,
) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if is_hidden_path_entry(&path) {
            continue;
        }
        if path.is_dir() {
            let relative_path = path
                .strip_prefix(context.root)
                .map_err(to_error)?
                .to_string_lossy()
                .replace('\\', "/");
            folders.push(FolderSummary {
                title: folder_title(&relative_path),
                display_path: folder_display_path(&relative_path),
                path: relative_path,
            });
            collect_content_entries(context, &path, folders, pages, files)?;
            continue;
        }

        let relative_path = path
            .strip_prefix(context.root)
            .map_err(to_error)?
            .to_string_lossy()
            .replace('\\', "/");
        let file_id = context
            .path_index
            .get(&relative_path)
            .cloned()
            .unwrap_or_else(|| "".to_string());
        let is_favorite = context
            .favorite_paths
            .iter()
            .any(|favorite_path| favorite_path == &relative_path);
        if relative_path.ends_with(".md") {
            pages.push(FileSummary {
                file_id,
                title: page_title(&relative_path),
                location: page_location(&relative_path, context.namespace),
                display_path: page_display_path(&relative_path),
                path: relative_path,
                is_favorite,
            });
        } else {
            files.push(FileSummary {
                file_id,
                title: file_title(&relative_path),
                location: file_location(&relative_path, context.namespace),
                display_path: file_display_path(&relative_path),
                path: relative_path,
                is_favorite,
            });
        }
    }

    Ok(())
}

fn collect_visible_file_paths(
    root: &Path,
    current: &Path,
    file_paths: &mut Vec<String>,
) -> Result<(), String> {
    if !current.exists() {
        return Ok(());
    }

    for entry in fs::read_dir(current).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let path = entry.path();
        if is_hidden_path_entry(&path) {
            continue;
        }
        if path.is_dir() {
            collect_visible_file_paths(root, &path, file_paths)?;
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .map_err(to_error)?
            .to_string_lossy()
            .replace('\\', "/");
        file_paths.push(relative_path);
    }

    Ok(())
}

fn search_content_for_namespace(
    namespace: &NamespaceSummary,
    query: &str,
) -> Result<Vec<SearchContentResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let normalized_query = query.to_lowercase();
    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    let mut results = special_pages_for_namespace(namespace)
        .into_iter()
        .filter_map(|page| {
            let title_match = fuzzy_match(&mut matcher, &page.title, &normalized_query);
            let path_match = fuzzy_match(&mut matcher, &page.location, &normalized_query);
            search_rank(
                &page.title,
                &page.location,
                &normalized_query,
                title_match.as_ref(),
                path_match.as_ref(),
                false,
            )
            .map(|score| ScoredSearchResult {
                score,
                result: SearchContentResult {
                    content_kind: "special".to_string(),
                    path: page.location.clone(),
                    title: page.title,
                    location: page.location,
                    snippet: Some(page.description),
                    title_match_indices: match_indices(title_match),
                    path_match_indices: match_indices(path_match),
                },
            })
        })
        .collect::<Vec<_>>();

    let mut paths = Vec::new();
    collect_visible_file_paths(&namespace.root_path, &namespace.root_path, &mut paths)?;
    paths.sort();

    for path in paths {
        let resolved_path = namespace.root_path.join(&path);
        let (content_kind, title, location) = if path.ends_with(".md") {
            (
                "page".to_string(),
                page_title(&path),
                page_location(&path, namespace),
            )
        } else {
            (
                "file".to_string(),
                file_title(&path),
                file_location(&path, namespace),
            )
        };

        let title_match = fuzzy_match(&mut matcher, &title, &normalized_query);
        let path_match = fuzzy_match(&mut matcher, &path, &normalized_query);
        let content_type = guess_content_type(&path);
        let text_content = if path.ends_with(".md") || is_text_content_type(&content_type) {
            fs::read_to_string(&resolved_path).ok()
        } else {
            None
        };
        let snippet = text_content
            .as_deref()
            .and_then(|content| search_snippet(content, &normalized_query));

        if let Some(score) = search_rank(
            &title,
            &path,
            &normalized_query,
            title_match.as_ref(),
            path_match.as_ref(),
            snippet.is_some(),
        ) {
            results.push(ScoredSearchResult {
                score,
                result: SearchContentResult {
                    content_kind,
                    path,
                    title,
                    location,
                    snippet,
                    title_match_indices: match_indices(title_match),
                    path_match_indices: match_indices(path_match),
                },
            });
        }
    }

    results.sort_by(|left, right| {
        right
            .score
            .cmp(&left.score)
            .then_with(|| left.result.path.cmp(&right.result.path))
    });
    results.truncate(100);
    Ok(results.into_iter().map(|result| result.result).collect())
}

struct ScoredSearchResult {
    score: u32,
    result: SearchContentResult,
}

struct FuzzyMatch {
    score: u16,
    indices: Vec<u32>,
}

fn fuzzy_match(matcher: &mut Matcher, text: &str, normalized_query: &str) -> Option<FuzzyMatch> {
    let normalized_text = text.to_lowercase();
    let mut text_buffer = Vec::new();
    let mut query_buffer = Vec::new();
    let mut indices = Vec::new();
    let haystack = Utf32Str::new(&normalized_text, &mut text_buffer);
    let needle = Utf32Str::new(normalized_query, &mut query_buffer);
    matcher
        .fuzzy_indices(haystack, needle, &mut indices)
        .map(|score| FuzzyMatch { score, indices })
}

fn search_rank(
    title: &str,
    path: &str,
    normalized_query: &str,
    title_match: Option<&FuzzyMatch>,
    path_match: Option<&FuzzyMatch>,
    content_matches: bool,
) -> Option<u32> {
    let normalized_title = title.to_lowercase();
    let normalized_path = path.to_lowercase();
    let title_score = title_match.map(|matched| {
        1_000_000
            + u32::from(matched.score)
            + if normalized_title == normalized_query {
                200_000
            } else if normalized_title.starts_with(normalized_query) {
                100_000
            } else {
                0
            }
    });
    let path_score = path_match.map(|matched| {
        500_000
            + u32::from(matched.score)
            + if normalized_path == normalized_query {
                100_000
            } else if normalized_path.starts_with(normalized_query) {
                50_000
            } else {
                0
            }
    });

    title_score
        .into_iter()
        .chain(path_score)
        .max()
        .or(content_matches.then_some(1))
}

fn match_indices(matched: Option<FuzzyMatch>) -> Vec<u32> {
    matched.map_or_else(Vec::new, |matched| matched.indices)
}

pub fn special_pages_for_namespace(namespace: &NamespaceSummary) -> Vec<SpecialPageSummary> {
    vec![
        SpecialPageSummary {
            title: "Special Pages".to_string(),
            description: "全ての Special ページを表示します。".to_string(),
            location: format!("{}:Special:SpecialPages", namespace.name),
        },
        SpecialPageSummary {
            title: "Namespaces".to_string(),
            description: "登録済み namespace の確認と新規作成を行います。".to_string(),
            location: "Special:Namespaces".to_string(),
        },
        SpecialPageSummary {
            title: "Help".to_string(),
            description: "Daibase のドキュメントを表示します。".to_string(),
            location: "Special:Help".to_string(),
        },
        SpecialPageSummary {
            title: "Pages".to_string(),
            description: "namespace 内の全ページを表示します。".to_string(),
            location: format!("{}:Special:Pages", namespace.name),
        },
        SpecialPageSummary {
            title: "Deleted Pages".to_string(),
            description: "削除済みのページとファイルを表示します。".to_string(),
            location: format!("{}:Special:DeletedPages", namespace.name),
        },
        SpecialPageSummary {
            title: "Favorites".to_string(),
            description: "お気に入りのページとファイルを表示します。".to_string(),
            location: format!("{}:Special:Favorites", namespace.name),
        },
        SpecialPageSummary {
            title: "Categories".to_string(),
            description: "カテゴリ別にページを表示します。".to_string(),
            location: format!("{}:Special:Categories", namespace.name),
        },
        SpecialPageSummary {
            title: "Plugins".to_string(),
            description: "登録済みプラグインの確認と有効化を行います。".to_string(),
            location: format!("{}:Special:Plugins", namespace.name),
        },
    ]
}

fn search_snippet(content: &str, normalized_query: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| line.to_lowercase().contains(normalized_query))
        .map(|line| {
            if line.chars().count() <= 120 {
                line.to_string()
            } else {
                line.chars().take(117).collect::<String>() + "..."
            }
        })
}

fn read_deleted_entry_object(
    namespace: &NamespaceSummary,
    file_id: &str,
) -> Result<(FileHistoryEntry, Vec<u8>), String> {
    let history = read_file_history(&namespace.root_path, file_id)?
        .ok_or_else(|| "削除済みコンテンツの履歴が見つかりません。".to_string())?;
    let entry = history
        .revisions
        .last()
        .cloned()
        .ok_or_else(|| "削除済みコンテンツの revision が見つかりません。".to_string())?;
    let content = read_object(&namespace.root_path, &entry.object_id)?;

    Ok((entry, content))
}

fn restore_path_index_entry(root: &Path, path: &str, file_id: &str) -> Result<(), String> {
    let mut path_index = read_path_index(root)?;
    path_index
        .entries
        .insert(path.to_string(), file_id.to_string());
    write_path_index(root, &path_index)
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
    let mut registry: NamespaceRegistry = serde_json::from_str(&content).map_err(to_error)?;
    for namespace in &mut registry.namespaces {
        fill_namespace_locations(namespace);
    }
    Ok(registry)
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
    path.strip_suffix(".md").unwrap_or(path).to_string()
}

pub fn page_location(path: &str, namespace: &NamespaceSummary) -> String {
    format!("{}:{}", namespace.name, path)
}

pub fn file_location(path: &str, namespace: &NamespaceSummary) -> String {
    format!("{}:{}", namespace.name, path)
}

fn fill_namespace_locations(namespace: &mut NamespaceSummary) {
    if namespace.default_location.is_empty() {
        namespace.default_location = page_location(&namespace.default_page, namespace);
    }
    if namespace.pages_location.is_empty() {
        namespace.pages_location = format!("{}:Special:Pages", namespace.name);
    }
}

fn page_title(path: &str) -> String {
    display_page_name(path)
        .split('/')
        .next_back()
        .unwrap_or(path)
        .to_string()
}

fn markdown_categories(content: &str) -> Vec<String> {
    let Some(frontmatter) = markdown_frontmatter(content) else {
        return Vec::new();
    };

    let lines = frontmatter.lines().collect::<Vec<_>>();
    let mut categories = Vec::new();
    for (index, line) in lines.iter().enumerate() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        if !key.trim().eq_ignore_ascii_case("categories")
            && !key.trim().eq_ignore_ascii_case("category")
        {
            continue;
        }

        let value = value.trim();
        if !value.is_empty() {
            categories.extend(parse_category_value(value));
            continue;
        }

        for nested_line in lines.iter().skip(index + 1) {
            let trimmed = nested_line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Some(item) = trimmed.strip_prefix("- ") {
                categories.push(clean_category_name(item));
                continue;
            }
            break;
        }
    }

    unique_categories(categories)
}

fn markdown_frontmatter(content: &str) -> Option<&str> {
    let rest = content
        .strip_prefix("---\n")
        .or_else(|| content.strip_prefix("---\r\n"))?;
    let mut offset = content.len() - rest.len();
    for line in rest.split_inclusive('\n') {
        let line_without_break = line.trim_end_matches('\n').trim_end_matches('\r');
        if line_without_break == "---" {
            return Some(&content[content.len() - rest.len()..offset]);
        }
        offset += line.len();
    }
    None
}

fn parse_category_value(value: &str) -> Vec<String> {
    let trimmed = value.trim();
    let list_value = trimmed
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(trimmed);
    list_value.split(',').map(clean_category_name).collect()
}

fn clean_category_name(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim()
        .to_string()
}

fn unique_categories(categories: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::BTreeSet::new();
    categories
        .into_iter()
        .filter(|category| !category.is_empty())
        .filter(|category| seen.insert(category.clone()))
        .collect()
}

fn read_managed_file_for_namespace(
    namespace: &NamespaceSummary,
    path: &str,
) -> Result<crate::models::ManagedFileContent, String> {
    let normalized_path = crate::paths::validate_file_path(path)?;
    let resolved_path = resolve_namespace_file_path(&namespace.root_path, &normalized_path)?;
    let title = file_title(&normalized_path);
    let location = file_location(&normalized_path, namespace);
    let backlinks = file_backlinks_for_namespace(namespace, &normalized_path)?;

    if !resolved_path.exists() {
        return Ok(crate::models::ManagedFileContent {
            namespace_id: namespace.id.clone(),
            file_id: String::new(),
            path: normalized_path.clone(),
            title,
            location,
            note: String::new(),
            backlinks,
            content_type: guess_content_type(path),
            text_content: None,
            data_url: None,
            size: 0,
            latest_revision_id: None,
            is_virtual: true,
            is_favorite: is_favorite_path(&namespace.root_path, &normalized_path)?,
        });
    }

    let file_id = file_id_for_path(&namespace.root_path, &normalized_path)?.unwrap_or_default();
    let latest_revision_id = if file_id.is_empty() {
        None
    } else {
        latest_revision_id(&namespace.root_path, &file_id)?
    };
    let metadata = fs::metadata(&resolved_path).map_err(to_error)?;
    let note = if file_id.is_empty() {
        String::new()
    } else {
        read_file_note(&namespace.root_path, &file_id)?
    };
    let content = fs::read(&resolved_path).map_err(to_error)?;
    let content_type = guess_content_type_from_bytes(&content, Some(Path::new(&normalized_path)));
    let text_content = if is_text_content_type(&content_type) {
        Some(String::from_utf8(content).map_err(to_error)?)
    } else {
        None
    };
    let data_url = if is_embeddable_content_type(&content_type) {
        Some(format!(
            "data:{content_type};base64,{}",
            encode_base64(&fs::read(&resolved_path).map_err(to_error)?)
        ))
    } else {
        None
    };

    Ok(crate::models::ManagedFileContent {
        namespace_id: namespace.id.clone(),
        file_id,
        path: normalized_path.clone(),
        title,
        location,
        note,
        backlinks,
        content_type,
        text_content,
        data_url,
        size: metadata.len(),
        latest_revision_id,
        is_virtual: false,
        is_favorite: is_favorite_path(&namespace.root_path, &normalized_path)?,
    })
}

fn display_file_name(path: &str) -> String {
    path.to_string()
}

fn file_title(path: &str) -> String {
    display_file_name(path)
        .split('/')
        .next_back()
        .unwrap_or(path)
        .to_string()
}

fn file_display_path(path: &str) -> Vec<String> {
    display_file_name(path)
        .split('/')
        .filter(|part| !part.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn folder_title(path: &str) -> String {
    path.split('/').next_back().unwrap_or(path).to_string()
}

fn folder_display_path(path: &str) -> Vec<String> {
    path.split('/')
        .filter(|part| !part.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn is_hidden_path_entry(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with('.'))
}

fn file_note_path(root: &Path, file_id: &str) -> Result<PathBuf, String> {
    if file_id.is_empty()
        || !file_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
    {
        return Err("file_id が不正です。".to_string());
    }

    Ok(root
        .join(".daibase/file_notes")
        .join(format!("{file_id}.md")))
}

fn read_file_note(root: &Path, file_id: &str) -> Result<String, String> {
    let path = file_note_path(root, file_id)?;
    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(path).map_err(to_error)
}

fn guess_content_type(path: &str) -> String {
    guess_content_type_from_path(Path::new(path))
}

fn guess_content_type_from_bytes(content: &[u8], fallback_path: Option<&Path>) -> String {
    if content.starts_with(&[0xff, 0xd8, 0xff]) {
        return "image/jpeg".to_string();
    }
    if content.starts_with(b"\x89PNG\r\n\x1a\n") {
        return "image/png".to_string();
    }
    if content.starts_with(b"GIF87a") || content.starts_with(b"GIF89a") {
        return "image/gif".to_string();
    }
    if content.len() >= 12 && &content[0..4] == b"RIFF" && &content[8..12] == b"WEBP" {
        return "image/webp".to_string();
    }
    if content.starts_with(b"%PDF-") {
        return "application/pdf".to_string();
    }

    fallback_path
        .map(guess_content_type_from_path)
        .unwrap_or_else(|| "application/octet-stream".to_string())
}

fn guess_content_type_from_path(path: &Path) -> String {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "txt" => "text/plain",
        "json" => "application/json",
        "csv" => "text/csv",
        "md" => "text/markdown",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn is_text_content_type(content_type: &str) -> bool {
    content_type.starts_with("text/")
        || matches!(
            content_type,
            "application/json" | "image/svg+xml" | "application/xml"
        )
}

fn is_embeddable_content_type(content_type: &str) -> bool {
    content_type.starts_with("image/") || content_type == "application/pdf"
}

fn encode_base64(content: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut encoded = String::with_capacity(content.len().div_ceil(3) * 4);

    for chunk in content.chunks(3) {
        let first = chunk[0];
        let second = chunk.get(1).copied().unwrap_or(0);
        let third = chunk.get(2).copied().unwrap_or(0);
        let combined = ((first as u32) << 16) | ((second as u32) << 8) | third as u32;

        encoded.push(TABLE[((combined >> 18) & 0x3f) as usize] as char);
        encoded.push(TABLE[((combined >> 12) & 0x3f) as usize] as char);
        if chunk.len() > 1 {
            encoded.push(TABLE[((combined >> 6) & 0x3f) as usize] as char);
        } else {
            encoded.push('=');
        }
        if chunk.len() > 2 {
            encoded.push(TABLE[(combined & 0x3f) as usize] as char);
        } else {
            encoded.push('=');
        }
    }

    encoded
}

fn page_display_path(path: &str) -> Vec<String> {
    display_page_name(path)
        .split('/')
        .filter(|part| !part.is_empty())
        .map(ToString::to_string)
        .collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_content_does_not_create_folder_page_locations() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Guide")).unwrap();
        fs::write(root_path.join("Guide/Intro.md"), "# Intro\n").unwrap();
        fs::write(root_path.join("Guide.md"), "# Guide\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let content = list_content_for_namespace(&namespace).unwrap();

        assert_eq!(content.pages.len(), 2);
        assert!(content
            .pages
            .iter()
            .any(|page| page.location == "Work:Guide.md"));
        assert!(content
            .pages
            .iter()
            .any(|page| page.location == "Work:Guide/Intro.md"));

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn list_content_includes_empty_folders() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Notes/Daily")).unwrap();
        fs::write(root_path.join("Main.md"), "# Main\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let content = list_content_for_namespace(&namespace).unwrap();

        assert_eq!(content.folders.len(), 2);
        assert_eq!(content.folders[0].path, "Notes");
        assert_eq!(content.folders[0].display_path, vec!["Notes"]);
        assert_eq!(content.folders[1].path, "Notes/Daily");
        assert_eq!(content.folders[1].display_path, vec!["Notes", "Daily"]);

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn list_content_includes_file_locations() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("images")).unwrap();
        fs::create_dir_all(root_path.join(".hidden")).unwrap();
        fs::write(root_path.join(".DS_Store"), b"metadata").unwrap();
        fs::write(root_path.join(".hidden/secret.png"), b"secret").unwrap();
        fs::write(root_path.join("images/logo.png"), b"image").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let content = list_content_for_namespace(&namespace).unwrap();

        assert_eq!(content.files.len(), 1);
        assert_eq!(content.files[0].path, "images/logo.png");
        assert_eq!(content.files[0].location, "Work:images/logo.png");
        assert_eq!(content.files[0].display_path, vec!["images", "logo.png"]);

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn list_content_marks_favorite_pages_and_files() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("images")).unwrap();
        fs::write(root_path.join("Main.md"), "# Main\n").unwrap();
        fs::write(root_path.join("images/logo.png"), b"image").unwrap();

        set_favorite_path(&root_path, "Main.md", true).unwrap();
        set_favorite_path(&root_path, "images/logo.png", true).unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let content = list_content_for_namespace(&namespace).unwrap();

        assert!(content.pages[0].is_favorite);
        assert!(content.files[0].is_favorite);

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn search_content_matches_paths_titles_and_text() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Guide")).unwrap();
        fs::create_dir_all(root_path.join(".hidden")).unwrap();
        fs::write(root_path.join("Main.md"), "# Main\n\nalpha body\n").unwrap();
        fs::write(root_path.join("Guide/Intro.md"), "# Intro\n\nbeta topic\n").unwrap();
        fs::write(root_path.join("notes.txt"), "beta note\n").unwrap();
        fs::write(root_path.join(".hidden/Secret.md"), "beta secret\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let results = search_content_for_namespace(&namespace, "beta").unwrap();

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].path, "Guide/Intro.md");
        assert_eq!(results[0].content_kind, "page");
        assert_eq!(results[0].location, "Work:Guide/Intro.md");
        assert_eq!(results[0].snippet.as_deref(), Some("beta topic"));
        assert_eq!(results[1].path, "notes.txt");
        assert_eq!(results[1].content_kind, "file");
        assert_eq!(results[1].snippet.as_deref(), Some("beta note"));

        let path_results = search_content_for_namespace(&namespace, "intro").unwrap();
        assert_eq!(path_results.len(), 1);
        assert_eq!(path_results[0].path, "Guide/Intro.md");

        let special_results = search_content_for_namespace(&namespace, "favorites").unwrap();
        assert_eq!(special_results.len(), 1);
        assert_eq!(special_results[0].content_kind, "special");
        assert_eq!(special_results[0].title, "Favorites");
        assert_eq!(special_results[0].location, "Work:Special:Favorites");

        let fuzzy_results = search_content_for_namespace(&namespace, "gdi").unwrap();
        assert_eq!(fuzzy_results.len(), 1);
        assert_eq!(fuzzy_results[0].path, "Guide/Intro.md");
        assert_eq!(fuzzy_results[0].path_match_indices, vec![0, 3, 6]);

        let ranked_results = search_content_for_namespace(&namespace, "main").unwrap();
        assert_eq!(ranked_results[0].path, "Main.md");
        assert!(!ranked_results[0].title_match_indices.is_empty());

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn markdown_categories_reads_frontmatter_categories() {
        assert_eq!(
            markdown_categories("---\ncategories:\n  - Work\n  - Research\n---\n# Main\n"),
            vec!["Work", "Research"]
        );
        assert_eq!(
            markdown_categories("---\ncategories: [Work, Research]\n---\n# Main\n"),
            vec!["Work", "Research"]
        );
    }

    #[test]
    fn list_category_groups_ignores_uncategorized_pages() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(&root_path).unwrap();
        fs::write(
            root_path.join("Main.md"),
            "---\ncategories:\n  - Work\n  - Research\n---\n# Main\n",
        )
        .unwrap();
        fs::write(
            root_path.join("Draft.md"),
            "---\ncategories: Work\n---\n# Draft\n",
        )
        .unwrap();
        fs::write(root_path.join("Free.md"), "# Free\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let categories = list_category_groups(&namespace).unwrap();

        assert_eq!(categories.len(), 2);
        assert_eq!(categories[0].name, "Research");
        assert_eq!(categories[0].pages[0].path, "Main.md");
        assert_eq!(categories[1].name, "Work");
        assert_eq!(
            categories[1]
                .pages
                .iter()
                .map(|page| page.path.as_str())
                .collect::<Vec<_>>(),
            vec!["Draft.md", "Main.md"]
        );
        assert!(categories
            .iter()
            .flat_map(|category| &category.pages)
            .all(|page| page.path != "Free.md"));

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn page_backlinks_include_pages_that_link_to_target() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Guide")).unwrap();
        fs::write(root_path.join("Main.md"), "[Intro](Guide/Intro.md)\n").unwrap();
        fs::write(root_path.join("Notes.md"), "![Intro](Guide/Intro.md)\n").unwrap();
        fs::write(root_path.join("Guide/Index.md"), "[Intro](Intro.md)\n").unwrap();
        fs::write(root_path.join("Guide/Intro.md"), "# Intro\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let backlinks = page_backlinks_for_namespace(&namespace, "Guide/Intro.md").unwrap();

        assert_eq!(backlinks.len(), 2);
        assert_eq!(backlinks[0].path, "Guide/Index.md");
        assert_eq!(backlinks[0].location, "Work:Guide/Index.md");
        assert_eq!(backlinks[1].path, "Main.md");
        assert_eq!(backlinks[1].location, "Work:Main.md");

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn file_backlinks_include_pages_that_link_or_embed_target() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Guide")).unwrap();
        fs::create_dir_all(root_path.join("images")).unwrap();
        fs::write(root_path.join("Main.md"), "![Logo](images/logo.png)\n").unwrap();
        fs::write(
            root_path.join("Guide/Index.md"),
            "[Logo](../images/logo.png)\n",
        )
        .unwrap();
        fs::write(
            root_path.join("Guide/Other.md"),
            "[Other](../images/other.png)\n",
        )
        .unwrap();
        fs::write(root_path.join("images/logo.png"), b"image").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let backlinks = file_backlinks_for_namespace(&namespace, "images/logo.png").unwrap();

        assert_eq!(backlinks.len(), 2);
        assert_eq!(backlinks[0].path, "Guide/Index.md");
        assert_eq!(backlinks[0].location, "Work:Guide/Index.md");
        assert_eq!(backlinks[1].path, "Main.md");
        assert_eq!(backlinks[1].location, "Work:Main.md");

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn list_content_ignores_hidden_pages_and_folders() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join(".hidden")).unwrap();
        fs::write(root_path.join(".DS_Store"), b"metadata").unwrap();
        fs::write(root_path.join(".hidden/Secret.md"), "# Secret\n").unwrap();
        fs::write(root_path.join("Main.md"), "# Main\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        let content = list_content_for_namespace(&namespace).unwrap();

        assert_eq!(content.pages.len(), 1);
        assert_eq!(content.pages[0].path, "Main.md");

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn page_exists_uses_namespace_file_path() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("Guide")).unwrap();
        fs::write(root_path.join("Guide/Intro.md"), "# Intro\n").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        assert!(page_exists_for_namespace(&namespace, "Guide/Intro.md").unwrap());
        assert!(!page_exists_for_namespace(&namespace, "Missing.md").unwrap());

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn file_exists_uses_namespace_file_path() {
        let root_path = std::env::temp_dir().join(format!("daibase_test_{}", Uuid::new_v4()));
        fs::create_dir_all(root_path.join("images")).unwrap();
        fs::write(root_path.join("images/logo.png"), b"image").unwrap();

        let namespace = NamespaceSummary {
            id: "ns-work".to_string(),
            name: "Work".to_string(),
            root_path: root_path.clone(),
            default_page: DEFAULT_PAGE_PATH.to_string(),
            default_location: "Work:Main.md".to_string(),
            pages_location: "Work:Special:Pages".to_string(),
            created_at: "2026-06-01T00:00:00Z".to_string(),
            updated_at: "2026-06-01T00:00:00Z".to_string(),
        };

        assert!(file_exists_for_namespace(&namespace, "images/logo.png").unwrap());
        assert!(!file_exists_for_namespace(&namespace, "images/missing.png").unwrap());

        fs::remove_dir_all(root_path).unwrap();
    }

    #[test]
    fn detects_jpeg_content_type_from_file_content_without_extension() {
        let content = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

        assert_eq!(guess_content_type_from_bytes(&content, None), "image/jpeg");
    }

    #[test]
    fn encodes_base64_for_data_url() {
        assert_eq!(encode_base64(b"hello"), "aGVsbG8=");
    }

    #[test]
    fn builds_side_by_side_diff_sections() {
        let sections = build_side_by_side_diff("# Main\n\nBefore\nSame", "# Main\n\nAfter\nSame");

        assert_eq!(sections[0].kind, "unchanged");
        assert_eq!(sections[0].rows[0].old_text.as_deref(), Some("# Main"));
        assert_eq!(sections[1].kind, "changed");
        assert_eq!(sections[1].rows[0].kind, "modified");
        assert_eq!(sections[1].rows[0].old_text.as_deref(), Some("Before"));
        assert_eq!(sections[1].rows[0].new_text.as_deref(), Some("After"));
        assert_eq!(sections[2].kind, "unchanged");
        assert_eq!(sections[2].rows[0].old_text.as_deref(), Some("Same"));
    }
}
