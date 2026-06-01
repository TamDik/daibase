use crate::location::ResolvedLocation;
use crate::models::{
    ContentTree, FileHistoryEntry, MarkdownLinkStatus, NamespaceDetail, NamespaceSummary,
    OpenLocationResult, PageContent, PageHistorySnapshot, SavePageResult, SaveResult,
    SpecialPageSummary,
};
use std::path::PathBuf;
use tauri::AppHandle;

#[tauri::command]
pub fn list_namespaces(app: AppHandle) -> Result<Vec<NamespaceSummary>, String> {
    crate::namespace::list_namespaces(&app)
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
pub fn list_content(app: AppHandle, namespace_id: String) -> Result<ContentTree, String> {
    crate::namespace::list_content(&app, namespace_id)
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
        ResolvedLocation::SpecialNamespaces { .. }
        | ResolvedLocation::SpecialPages { .. }
        | ResolvedLocation::SpecialPagesList { .. } => true,
    };

    Ok(MarkdownLinkStatus {
        location,
        exists,
        is_internal: true,
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
        ResolvedLocation::SpecialNamespaces { location } => {
            Ok(OpenLocationResult::SpecialNamespaces {
                location,
                namespaces,
            })
        }
        ResolvedLocation::SpecialPages {
            namespace,
            location,
        } => Ok(OpenLocationResult::SpecialPages {
            location,
            content: crate::namespace::open_namespace(&app, namespace.id.clone())?.content,
            pages: special_pages_for_namespace(&namespace),
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
                .strip_prefix("Pages/")
                .unwrap_or(path)
                .strip_suffix(".md")
                .unwrap_or(path)
                .split('/')
                .next_back()
                .unwrap_or(path)
                .to_string(),
            location: crate::namespace::page_location(path, namespace),
            content: String::new(),
            latest_revision_id: None,
            is_virtual: true,
        }),
        Err(error) => Err(error),
    }
}

fn special_pages_for_namespace(namespace: &NamespaceSummary) -> Vec<SpecialPageSummary> {
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
            title: "Pages".to_string(),
            description: "namespace 内の全ページを表示します。".to_string(),
            location: format!("{}:Special:Pages", namespace.name),
        },
    ]
}
