mod commands;
mod location;
mod models;
mod namespace;
mod paths;
mod versioning;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_namespaces,
            commands::create_namespace,
            commands::open_namespace,
            commands::read_page,
            commands::write_page,
            commands::save_page,
            commands::read_file,
            commands::upload_file,
            commands::write_file_note,
            commands::list_content,
            commands::list_page_history,
            commands::list_file_history,
            commands::read_page_history_snapshot,
            commands::open_initial_location,
            commands::open_location,
            commands::resolve_location,
            commands::resolve_markdown_link,
            commands::resolve_markdown_link_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
