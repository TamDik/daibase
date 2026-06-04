mod commands;
mod location;
mod mcp;
mod models;
mod namespace;
mod paths;
mod plugins;
mod terminal;
mod versioning;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(terminal::TerminalSessions::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            mcp::start_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_mcp_server_status,
            commands::list_plugins,
            commands::install_plugin_from_folder,
            commands::set_plugin_enabled,
            commands::resolve_plugin_entry,
            commands::list_namespaces,
            commands::create_namespace,
            commands::open_namespace,
            commands::read_page,
            commands::write_page,
            commands::save_page,
            commands::read_file,
            commands::upload_file,
            commands::create_folder,
            commands::delete_page,
            commands::delete_file,
            commands::delete_folder,
            commands::restore_deleted_content,
            commands::write_file_note,
            commands::list_content,
            commands::list_page_history,
            commands::list_file_history,
            commands::list_deleted_content,
            commands::set_favorite_content,
            commands::list_favorite_content,
            commands::read_deleted_page,
            commands::read_deleted_file,
            commands::read_page_history_snapshot,
            commands::open_initial_location,
            commands::open_location,
            commands::resolve_location,
            commands::resolve_markdown_link,
            commands::resolve_markdown_image,
            commands::resolve_markdown_link_status,
            commands::start_terminal,
            commands::write_terminal,
            commands::resize_terminal,
            commands::stop_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
