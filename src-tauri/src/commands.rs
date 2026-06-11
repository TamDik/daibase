use crate::location::ResolvedLocation;
use crate::models::{
    ContentTree, DeletedContentSummary, FavoriteContentSummary, FileHistoryEntry,
    InstalledPluginSummary, MarkdownImageResolution, MarkdownLinkStatus, McpServerStatus,
    NamespaceDetail, NamespaceSummary, OpenLocationResult, PageContent, PageHistorySnapshot,
    PluginDocumentation, PluginMainResolution, SaveFileResult, SavePageResult, SaveResult,
    SearchContentResult,
};
use std::path::PathBuf;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn list_namespaces(app: AppHandle) -> Result<Vec<NamespaceSummary>, String> {
    crate::namespace::list_namespaces(&app)
}

#[tauri::command]
pub fn get_mcp_server_status() -> McpServerStatus {
    crate::mcp::server_status()
}

#[tauri::command]
pub fn list_plugins(app: AppHandle) -> Result<Vec<InstalledPluginSummary>, String> {
    crate::plugins::list_plugins(&app)
}

#[tauri::command]
pub fn install_plugin_from_folder(
    app: AppHandle,
    source_path: PathBuf,
) -> Result<InstalledPluginSummary, String> {
    crate::plugins::install_plugin_from_folder(&app, source_path)
}

#[tauri::command]
pub fn set_plugin_enabled(
    app: AppHandle,
    plugin_id: String,
    enabled: bool,
) -> Result<InstalledPluginSummary, String> {
    crate::plugins::set_plugin_enabled(&app, plugin_id, enabled)
}

#[tauri::command]
pub fn remove_plugin(app: AppHandle, plugin_id: String) -> Result<(), String> {
    crate::plugins::remove_plugin(&app, plugin_id)
}

#[tauri::command]
pub fn resolve_plugin_main(
    app: AppHandle,
    plugin_id: String,
) -> Result<PluginMainResolution, String> {
    crate::plugins::resolve_plugin_main(&app, plugin_id)
}

#[tauri::command]
pub fn read_plugin_documentation(
    app: AppHandle,
    plugin_id: String,
) -> Result<PluginDocumentation, String> {
    crate::plugins::read_plugin_documentation(&app, plugin_id)
}

#[tauri::command]
pub fn start_terminal(
    app: AppHandle,
    sessions: State<crate::terminal::TerminalSessions>,
    columns: Option<u16>,
    rows: Option<u16>,
) -> Result<crate::terminal::TerminalSessionSummary, String> {
    crate::terminal::start_terminal(app, &sessions, columns, rows)
}

#[tauri::command]
pub fn write_terminal(
    sessions: State<crate::terminal::TerminalSessions>,
    session_id: String,
    input: String,
) -> Result<(), String> {
    crate::terminal::write_terminal(&sessions, session_id, input)
}

#[tauri::command]
pub fn resize_terminal(
    sessions: State<crate::terminal::TerminalSessions>,
    session_id: String,
    columns: u16,
    rows: u16,
) -> Result<(), String> {
    crate::terminal::resize_terminal(&sessions, session_id, columns, rows)
}

#[tauri::command]
pub fn stop_terminal(
    sessions: State<crate::terminal::TerminalSessions>,
    session_id: String,
) -> Result<(), String> {
    crate::terminal::stop_terminal(&sessions, session_id)
}

#[tauri::command]
pub fn create_namespace(
    app: AppHandle,
    name: String,
    root_path: PathBuf,
) -> Result<NamespaceSummary, String> {
    crate::namespace::create_namespace(&app, name, root_path)
}

#[tauri::command]
pub fn open_namespace(app: AppHandle, namespace_id: String) -> Result<NamespaceDetail, String> {
    crate::namespace::open_namespace(&app, namespace_id)
}

#[tauri::command]
pub fn read_page(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<PageContent, String> {
    crate::namespace::read_page(&app, namespace_id, path)
}

#[tauri::command]
pub fn write_page(
    app: AppHandle,
    namespace_id: String,
    path: String,
    content: String,
) -> Result<SaveResult, String> {
    crate::namespace::write_page(&app, namespace_id, path, content)
}

#[tauri::command]
pub fn save_page(
    app: AppHandle,
    namespace_id: String,
    path: String,
    content: String,
) -> Result<SavePageResult, String> {
    let save = crate::namespace::write_page(&app, namespace_id.clone(), path.clone(), content)?;
    let detail = crate::namespace::open_namespace(&app, namespace_id)?;
    let page = crate::namespace::read_page(&app, detail.namespace.id.clone(), path)?;
    let location = crate::namespace::page_location(&page.path, &detail.namespace);

    Ok(SavePageResult {
        location,
        namespace: detail.namespace,
        content: detail.content,
        page,
        save,
    })
}

#[tauri::command]
pub fn read_file(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<crate::models::ManagedFileContent, String> {
    crate::namespace::read_managed_file(&app, namespace_id, path)
}

#[tauri::command]
pub fn upload_file(
    app: AppHandle,
    namespace_id: String,
    path: String,
    source_path: PathBuf,
) -> Result<SaveFileResult, String> {
    crate::namespace::upload_file(&app, namespace_id, path, source_path)
}

#[tauri::command]
pub fn create_folder(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    crate::namespace::create_folder(&app, namespace_id, path)
}

#[tauri::command]
pub fn delete_page(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    crate::namespace::delete_page(&app, namespace_id, path)
}

#[tauri::command]
pub fn delete_file(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    crate::namespace::delete_file(&app, namespace_id, path)
}

#[tauri::command]
pub fn delete_folder(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<NamespaceDetail, String> {
    crate::namespace::delete_folder(&app, namespace_id, path)
}

#[tauri::command]
pub fn restore_deleted_content(
    app: AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<NamespaceDetail, String> {
    crate::namespace::restore_deleted_content(&app, namespace_id, file_id)
}

#[tauri::command]
pub fn write_file_note(
    app: AppHandle,
    namespace_id: String,
    path: String,
    note: String,
) -> Result<crate::models::ManagedFileContent, String> {
    crate::namespace::write_file_note(&app, namespace_id, path, note)
}

#[tauri::command]
pub fn list_content(app: AppHandle, namespace_id: String) -> Result<ContentTree, String> {
    crate::namespace::list_content(&app, namespace_id)
}

#[tauri::command]
pub fn search_content(
    app: AppHandle,
    namespace_id: String,
    query: String,
) -> Result<Vec<SearchContentResult>, String> {
    crate::namespace::search_content(&app, namespace_id, query)
}

#[tauri::command]
pub fn list_page_history(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<Vec<FileHistoryEntry>, String> {
    crate::namespace::list_page_history(&app, namespace_id, path)
}

#[tauri::command]
pub fn list_file_history(
    app: AppHandle,
    namespace_id: String,
    path: String,
) -> Result<Vec<FileHistoryEntry>, String> {
    crate::namespace::list_file_history(&app, namespace_id, path)
}

#[tauri::command]
pub fn list_deleted_content(
    app: AppHandle,
    namespace_id: String,
) -> Result<Vec<DeletedContentSummary>, String> {
    crate::namespace::list_deleted_content(&app, namespace_id)
}

#[tauri::command]
pub fn set_favorite_content(
    app: AppHandle,
    namespace_id: String,
    path: String,
    is_favorite: bool,
) -> Result<NamespaceDetail, String> {
    crate::namespace::set_favorite_content(&app, namespace_id, path, is_favorite)
}

#[tauri::command]
pub fn list_favorite_content(
    app: AppHandle,
    namespace_id: String,
) -> Result<Vec<FavoriteContentSummary>, String> {
    crate::namespace::list_favorite_content(&app, namespace_id)
}

#[tauri::command]
pub fn read_deleted_page(
    app: AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<PageContent, String> {
    crate::namespace::read_deleted_page(&app, namespace_id, file_id)
}

#[tauri::command]
pub fn read_deleted_file(
    app: AppHandle,
    namespace_id: String,
    file_id: String,
) -> Result<crate::models::ManagedFileContent, String> {
    crate::namespace::read_deleted_file(&app, namespace_id, file_id)
}

#[tauri::command]
pub fn read_page_history_snapshot(
    app: AppHandle,
    namespace_id: String,
    path: String,
    revision_id: String,
) -> Result<PageHistorySnapshot, String> {
    crate::namespace::read_page_history_snapshot(&app, namespace_id, path, revision_id)
}

#[tauri::command]
pub fn resolve_location(
    app: AppHandle,
    location: String,
    source_namespace_id: Option<String>,
) -> Result<ResolvedLocation, String> {
    let namespaces = crate::namespace::list_namespaces(&app)?;
    let source_namespace = source_namespace_id
        .as_deref()
        .map(|namespace_id| {
            namespaces
                .iter()
                .find(|namespace| namespace.id == namespace_id)
                .ok_or_else(|| "ネームスペースが見つかりません。".to_string())
        })
        .transpose()?;

    crate::location::resolve_location(&location, &namespaces, source_namespace)
}

#[tauri::command]
pub fn resolve_markdown_link(
    app: AppHandle,
    current_namespace_id: String,
    current_path: String,
    target: String,
) -> Result<String, String> {
    let namespaces = crate::namespace::list_namespaces(&app)?;
    let namespace = namespaces
        .iter()
        .find(|namespace| namespace.id == current_namespace_id)
        .ok_or_else(|| "ネームスペースが見つかりません。".to_string())?;

    Ok(crate::location::resolve_markdown_link(
        namespace,
        &current_path,
        &target,
    ))
}

#[tauri::command]
pub fn resolve_markdown_link_status(
    app: AppHandle,
    current_namespace_id: String,
    current_path: String,
    target: String,
) -> Result<MarkdownLinkStatus, String> {
    if crate::location::is_external_markdown_link_target(&target) {
        return Ok(MarkdownLinkStatus {
            location: target,
            exists: false,
            is_internal: false,
        });
    }

    let namespaces = crate::namespace::list_namespaces(&app)?;
    let current_namespace = namespaces
        .iter()
        .find(|namespace| namespace.id == current_namespace_id)
        .ok_or_else(|| "ネームスペースが見つかりません。".to_string())?;
    let location =
        crate::location::resolve_markdown_link(current_namespace, &current_path, &target);
    let resolved =
        crate::location::resolve_location(&location, &namespaces, Some(current_namespace))?;
    let exists = match resolved {
        ResolvedLocation::Page {
            namespace,
            page_path,
            ..
        } => crate::namespace::page_exists_for_namespace(&namespace, &page_path)?,
        ResolvedLocation::File {
            namespace,
            file_path,
            ..
        } => crate::namespace::file_exists_for_namespace(&namespace, &file_path)?,
        ResolvedLocation::SpecialNamespaces { .. }
        | ResolvedLocation::SpecialHelp { .. }
        | ResolvedLocation::SpecialPages { .. }
        | ResolvedLocation::SpecialPagesList { .. }
        | ResolvedLocation::SpecialDeletedPages { .. }
        | ResolvedLocation::SpecialFavorites { .. }
        | ResolvedLocation::SpecialCategories { .. }
        | ResolvedLocation::SpecialPlugins { .. } => true,
    };

    Ok(MarkdownLinkStatus {
        location,
        exists,
        is_internal: true,
    })
}

#[tauri::command]
pub fn resolve_markdown_image(
    app: AppHandle,
    current_namespace_id: String,
    current_path: String,
    target: String,
) -> Result<MarkdownImageResolution, String> {
    if crate::location::is_external_markdown_link_target(&target) {
        return Ok(MarkdownImageResolution {
            location: target,
            exists: false,
            is_internal: false,
            is_image: false,
            content_type: None,
            data_url: None,
        });
    }

    let namespaces = crate::namespace::list_namespaces(&app)?;
    let current_namespace = namespaces
        .iter()
        .find(|namespace| namespace.id == current_namespace_id)
        .ok_or_else(|| "ネームスペースが見つかりません。".to_string())?;
    let location =
        crate::location::resolve_markdown_image(current_namespace, &current_path, &target);
    let resolved =
        crate::location::resolve_location(&location, &namespaces, Some(current_namespace))?;

    let ResolvedLocation::File {
        namespace,
        file_path,
        ..
    } = resolved
    else {
        return Ok(MarkdownImageResolution {
            location,
            exists: false,
            is_internal: true,
            is_image: false,
            content_type: None,
            data_url: None,
        });
    };

    let file = crate::namespace::read_managed_file(&app, namespace.id, file_path)?;
    let is_image = !file.is_virtual && file.content_type.starts_with("image/");

    Ok(MarkdownImageResolution {
        location,
        exists: !file.is_virtual,
        is_internal: true,
        is_image,
        content_type: Some(file.content_type),
        data_url: if is_image { file.data_url } else { None },
    })
}

#[tauri::command]
pub fn open_initial_location(app: AppHandle) -> Result<OpenLocationResult, String> {
    match crate::namespace::initial_namespace(&app)? {
        Some(namespace) => {
            let location = crate::namespace::page_location(&namespace.default_page, &namespace);
            open_location(app, location, Some(namespace.id))
        }
        None => Ok(OpenLocationResult::SpecialNamespaces {
            location: crate::location::NAMESPACES_LOCATION.to_string(),
            namespaces: Vec::new(),
        }),
    }
}

#[tauri::command]
pub fn open_location(
    app: AppHandle,
    location: String,
    source_namespace_id: Option<String>,
) -> Result<OpenLocationResult, String> {
    let namespaces = crate::namespace::list_namespaces(&app)?;
    let source_namespace = source_namespace_id
        .as_deref()
        .map(|namespace_id| {
            namespaces
                .iter()
                .find(|namespace| namespace.id == namespace_id)
                .ok_or_else(|| "ネームスペースが見つかりません。".to_string())
        })
        .transpose()?;
    let resolved = crate::location::resolve_location(&location, &namespaces, source_namespace)?;

    match resolved {
        ResolvedLocation::Page {
            namespace,
            page_path,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let page = read_page_or_virtual(&app, &detail.namespace, &page_path)?;
            Ok(OpenLocationResult::Page {
                location,
                namespace: detail.namespace,
                content: detail.content,
                page,
            })
        }
        ResolvedLocation::File {
            namespace,
            file_path,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let file =
                crate::namespace::read_managed_file(&app, detail.namespace.id.clone(), file_path)?;
            Ok(OpenLocationResult::File {
                location,
                namespace: detail.namespace,
                content: detail.content,
                file,
            })
        }
        ResolvedLocation::SpecialNamespaces { location } => {
            Ok(OpenLocationResult::SpecialNamespaces {
                location,
                namespaces,
            })
        }
        ResolvedLocation::SpecialHelp {
            document_path,
            location,
        } => Ok(OpenLocationResult::SpecialHelp {
            location,
            documents: crate::help::list_documents(),
            document: document_path
                .as_deref()
                .map(crate::help::read_document)
                .transpose()?,
        }),
        ResolvedLocation::SpecialPages {
            namespace,
            location,
        } => Ok(OpenLocationResult::SpecialPages {
            location,
            content: crate::namespace::open_namespace(&app, namespace.id.clone())?.content,
            pages: crate::namespace::special_pages_for_namespace(&namespace),
            namespace,
        }),
        ResolvedLocation::SpecialPagesList {
            namespace,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            Ok(OpenLocationResult::SpecialPagesList {
                location,
                namespace: detail.namespace,
                content: detail.content,
            })
        }
        ResolvedLocation::SpecialDeletedPages {
            namespace,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let items = crate::namespace::list_deleted_content(&app, detail.namespace.id.clone())?;
            Ok(OpenLocationResult::SpecialDeletedPages {
                location,
                namespace: detail.namespace,
                content: detail.content,
                items,
            })
        }
        ResolvedLocation::SpecialFavorites {
            namespace,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let items = crate::namespace::list_favorite_content(&app, detail.namespace.id.clone())?;
            Ok(OpenLocationResult::SpecialFavorites {
                location,
                namespace: detail.namespace,
                content: detail.content,
                items,
            })
        }
        ResolvedLocation::SpecialCategories {
            namespace,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let (categories, uncategorized_pages) =
                crate::namespace::list_category_groups(&detail.namespace)?;
            Ok(OpenLocationResult::SpecialCategories {
                location,
                namespace: detail.namespace,
                content: detail.content,
                categories,
                uncategorized_pages,
            })
        }
        ResolvedLocation::SpecialPlugins {
            namespace,
            location,
        } => {
            let detail = crate::namespace::open_namespace(&app, namespace.id.clone())?;
            let plugins = crate::plugins::list_plugins(&app)?;
            Ok(OpenLocationResult::SpecialPlugins {
                location,
                namespace: detail.namespace,
                content: detail.content,
                plugins,
            })
        }
    }
}

fn read_page_or_virtual(
    app: &AppHandle,
    namespace: &NamespaceSummary,
    path: &str,
) -> Result<PageContent, String> {
    match crate::namespace::read_page(app, namespace.id.clone(), path.to_string()) {
        Ok(page) => Ok(page),
        Err(error) if error.contains("ページが見つかりません") => Ok(PageContent {
            namespace_id: namespace.id.clone(),
            file_id: String::new(),
            path: path.to_string(),
            title: path
                .strip_suffix(".md")
                .unwrap_or(path)
                .split('/')
                .next_back()
                .unwrap_or(path)
                .to_string(),
            location: crate::namespace::page_location(path, namespace),
            content: String::new(),
            categories: Vec::new(),
            backlinks: crate::namespace::page_backlinks_for_namespace(namespace, path)?,
            latest_revision_id: None,
            is_virtual: true,
            is_favorite: false,
        }),
        Err(error) => Err(error),
    }
}
