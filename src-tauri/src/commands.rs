use crate::models::{ContentTree, NamespaceDetail, NamespaceSummary, PageContent, SaveResult};
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
pub fn list_content(app: AppHandle, namespace_id: String) -> Result<ContentTree, String> {
    crate::namespace::list_content(&app, namespace_id)
}
