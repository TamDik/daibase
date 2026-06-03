use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use tauri::AppHandle;

const MCP_PROTOCOL_VERSION: &str = "2025-06-18";
const MCP_ENDPOINT_PATH: &str = "/mcp";
const MCP_BIND_ADDR: &str = "127.0.0.1:17620";
static MCP_SERVER_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn server_status() -> crate::models::McpServerStatus {
    crate::models::McpServerStatus {
        enabled: MCP_SERVER_ENABLED.load(Ordering::SeqCst),
        transport: "Streamable HTTP".to_string(),
        url: endpoint_url(),
    }
}

fn endpoint_url() -> String {
    format!("http://{MCP_BIND_ADDR}{MCP_ENDPOINT_PATH}")
}

pub fn start_server(app: AppHandle) {
    thread::spawn(move || {
        let listener = match TcpListener::bind(MCP_BIND_ADDR) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("MCP サーバーを起動できませんでした: {error}");
                return;
            }
        };

        MCP_SERVER_ENABLED.store(true, Ordering::SeqCst);
        eprintln!("MCP Streamable HTTP server listening on {}", endpoint_url());
        for stream in listener.incoming() {
            match stream {
                Ok(stream) => {
                    let app = app.clone();
                    thread::spawn(move || {
                        if let Err(error) = handle_connection(stream, app) {
                            eprintln!("MCP リクエストの処理に失敗しました: {error}");
                        }
                    });
                }
                Err(error) => eprintln!("MCP 接続を受け付けられませんでした: {error}"),
            }
        }
    });
}

fn handle_connection(mut stream: TcpStream, app: AppHandle) -> Result<(), String> {
    let mut reader = BufReader::new(stream.try_clone().map_err(to_error)?);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).map_err(to_error)?;
    let request_parts = request_line.split_whitespace().collect::<Vec<_>>();
    if request_parts.len() < 2 {
        return write_http_error(&mut stream, 400, "Bad Request");
    }

    let method = request_parts[0];
    let path = request_parts[1].split('?').next().unwrap_or_default();
    let headers = read_headers(&mut reader)?;

    if path != MCP_ENDPOINT_PATH {
        return write_http_error(&mut stream, 404, "Not Found");
    }
    if !is_allowed_origin(&headers) {
        return write_http_error(&mut stream, 403, "Forbidden");
    }

    match method {
        "POST" => handle_post(stream, reader, headers, app),
        "GET" | "DELETE" => write_http_error(&mut stream, 405, "Method Not Allowed"),
        "OPTIONS" => write_options(stream),
        _ => write_http_error(&mut stream, 405, "Method Not Allowed"),
    }
}

fn handle_post(
    mut stream: TcpStream,
    mut reader: BufReader<TcpStream>,
    headers: BTreeMap<String, String>,
    app: AppHandle,
) -> Result<(), String> {
    if !accepts_json_and_sse(&headers) {
        return write_http_error(&mut stream, 406, "Not Acceptable");
    }
    if !valid_protocol_version(&headers) {
        return write_http_error(&mut stream, 400, "Bad Request");
    }

    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .ok_or_else(|| "Content-Length が指定されていません。".to_string())?;
    let mut body = vec![0_u8; content_length];
    reader.read_exact(&mut body).map_err(to_error)?;

    let request = serde_json::from_slice::<Value>(&body).map_err(to_error)?;
    if request.get("id").is_none() {
        return write_http_response(&mut stream, 202, "Accepted", "text/plain", "");
    }

    let response = handle_json_rpc(request, &app);
    write_json_response(&mut stream, &response)
}

fn handle_json_rpc(request: Value, app: &AppHandle) -> Value {
    let id = request.get("id").cloned().unwrap_or(Value::Null);
    let Some(method) = request.get("method").and_then(Value::as_str) else {
        return json_rpc_error(id, -32600, "Invalid Request");
    };

    match method {
        "initialize" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": initialize_result()
        }),
        "ping" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {}
        }),
        "tools/list" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "tools": tools()
            }
        }),
        "tools/call" => {
            handle_tool_call(id, request.get("params").cloned().unwrap_or_default(), app)
        }
        _ => json_rpc_error(id, -32601, "Method not found"),
    }
}

fn handle_tool_call(id: Value, params: Value, app: &AppHandle) -> Value {
    let Some(name) = params.get("name").and_then(Value::as_str) else {
        return json_rpc_error(id, -32602, "Tool name is required");
    };
    let arguments = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| json!({}));

    let result = match name {
        "list_namespaces" => to_value(crate::namespace::list_namespaces(app)),
        "create_namespace" => {
            let name = required_string(&arguments, "name");
            let root_path = required_string(&arguments, "root_path").map(PathBuf::from);
            match (name, root_path) {
                (Ok(name), Ok(root_path)) => {
                    to_value(crate::namespace::create_namespace(app, name, root_path))
                }
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "open_namespace" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            namespace_id
                .and_then(|namespace_id| crate::namespace::open_namespace(app, namespace_id))
                .and_then(|value| serde_json::to_value(value).map_err(to_error))
        }
        "list_content" => call_namespace_id(arguments, |namespace_id| {
            crate::namespace::list_content(app, namespace_id)
        }),
        "read_page" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::read_page(app, namespace_id, path)
        }),
        "write_page" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let path = required_string(&arguments, "path");
            let content = required_string(&arguments, "content");
            match (namespace_id, path, content) {
                (Ok(namespace_id), Ok(path), Ok(content)) => to_value(
                    crate::namespace::write_page(app, namespace_id, path, content),
                ),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "read_file" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::read_managed_file(app, namespace_id, path)
        }),
        "upload_file" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let path = required_string(&arguments, "path");
            let source_path = required_string(&arguments, "source_path").map(PathBuf::from);
            match (namespace_id, path, source_path) {
                (Ok(namespace_id), Ok(path), Ok(source_path)) => to_value(
                    crate::namespace::upload_file(app, namespace_id, path, source_path),
                ),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "create_folder" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::create_folder(app, namespace_id, path)
        }),
        "delete_page" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::delete_page(app, namespace_id, path)
        }),
        "delete_file" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::delete_file(app, namespace_id, path)
        }),
        "delete_folder" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::delete_folder(app, namespace_id, path)
        }),
        "restore_deleted_content" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let file_id = required_string(&arguments, "file_id");
            match (namespace_id, file_id) {
                (Ok(namespace_id), Ok(file_id)) => to_value(
                    crate::namespace::restore_deleted_content(app, namespace_id, file_id),
                ),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "write_file_note" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let path = required_string(&arguments, "path");
            let note = required_string(&arguments, "note");
            match (namespace_id, path, note) {
                (Ok(namespace_id), Ok(path), Ok(note)) => to_value(
                    crate::namespace::write_file_note(app, namespace_id, path, note),
                ),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "list_page_history" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::list_page_history(app, namespace_id, path)
        }),
        "list_file_history" => call_namespace_path(arguments, |namespace_id, path| {
            crate::namespace::list_file_history(app, namespace_id, path)
        }),
        "list_deleted_content" => call_namespace_id(arguments, |namespace_id| {
            crate::namespace::list_deleted_content(app, namespace_id)
        }),
        "list_favorite_content" => call_namespace_id(arguments, |namespace_id| {
            crate::namespace::list_favorite_content(app, namespace_id)
        }),
        "set_favorite_content" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let path = required_string(&arguments, "path");
            let is_favorite = required_bool(&arguments, "is_favorite");
            match (namespace_id, path, is_favorite) {
                (Ok(namespace_id), Ok(path), Ok(is_favorite)) => to_value(
                    crate::namespace::set_favorite_content(app, namespace_id, path, is_favorite),
                ),
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        "read_deleted_page" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let file_id = required_string(&arguments, "file_id");
            match (namespace_id, file_id) {
                (Ok(namespace_id), Ok(file_id)) => to_value(crate::namespace::read_deleted_page(
                    app,
                    namespace_id,
                    file_id,
                )),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "read_deleted_file" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let file_id = required_string(&arguments, "file_id");
            match (namespace_id, file_id) {
                (Ok(namespace_id), Ok(file_id)) => to_value(crate::namespace::read_deleted_file(
                    app,
                    namespace_id,
                    file_id,
                )),
                (Err(error), _) | (_, Err(error)) => Err(error),
            }
        }
        "read_page_history_snapshot" => {
            let namespace_id = required_string(&arguments, "namespace_id");
            let path = required_string(&arguments, "path");
            let revision_id = required_string(&arguments, "revision_id");
            match (namespace_id, path, revision_id) {
                (Ok(namespace_id), Ok(path), Ok(revision_id)) => {
                    to_value(crate::namespace::read_page_history_snapshot(
                        app,
                        namespace_id,
                        path,
                        revision_id,
                    ))
                }
                (Err(error), _, _) | (_, Err(error), _) | (_, _, Err(error)) => Err(error),
            }
        }
        _ => return json_rpc_error(id, -32602, &format!("Unknown tool: {name}")),
    };

    match result {
        Ok(value) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": tool_result(value, false)
        }),
        Err(error) => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": tool_result(json!({ "error": error }), true)
        }),
    }
}

fn tools() -> Vec<Value> {
    vec![
        tool(
            "list_namespaces",
            "List Namespaces",
            "Daibase に登録されている namespace 一覧を返します。",
            object_schema(vec![]),
        ),
        tool(
            "create_namespace",
            "Create Namespace",
            "新しい namespace を作成します。",
            object_schema(vec![
                string_prop("name", "namespace 名"),
                string_prop("root_path", "namespace root の絶対パス"),
            ]),
        ),
        namespace_tool(
            "open_namespace",
            "Open Namespace",
            "namespace の詳細とコンテンツツリーを返します。",
        ),
        namespace_tool(
            "list_content",
            "List Content",
            "namespace 内のページ、ファイル、フォルダーを一覧します。",
        ),
        namespace_path_tool("read_page", "Read Page", "Markdown ページを読み込みます。"),
        tool(
            "write_page",
            "Write Page",
            "Markdown ページを作成または更新し、revision を記録します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("path", "namespace root からの .md 相対パス"),
                string_prop("content", "保存する Markdown 本文"),
            ]),
        ),
        namespace_path_tool(
            "read_file",
            "Read File",
            "管理対象ファイルと説明を読み込みます。",
        ),
        tool(
            "upload_file",
            "Upload File",
            "ローカルファイルを namespace に取り込み、revision を記録します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("path", "保存先の相対パス"),
                string_prop("source_path", "取り込み元の絶対パス"),
            ]),
        ),
        namespace_path_tool(
            "create_folder",
            "Create Folder",
            "namespace 内にフォルダーを作成します。",
        ),
        namespace_path_tool(
            "delete_page",
            "Delete Page",
            "Markdown ページを削除し、履歴に削除 revision を記録します。",
        ),
        namespace_path_tool(
            "delete_file",
            "Delete File",
            "管理対象ファイルを削除し、履歴に削除 revision を記録します。",
        ),
        namespace_path_tool(
            "delete_folder",
            "Delete Folder",
            "フォルダーと配下コンテンツを削除し、履歴に削除 revision を記録します。",
        ),
        tool(
            "restore_deleted_content",
            "Restore Deleted Content",
            "削除済みコンテンツを file_id から復元します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("file_id", "復元対象の file ID"),
            ]),
        ),
        tool(
            "write_file_note",
            "Write File Note",
            "管理対象ファイルの説明文を保存します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("path", "対象ファイルの相対パス"),
                string_prop("note", "保存する説明文"),
            ]),
        ),
        namespace_path_tool(
            "list_page_history",
            "List Page History",
            "Markdown ページの revision 履歴を返します。",
        ),
        namespace_path_tool(
            "list_file_history",
            "List File History",
            "管理対象ファイルの revision 履歴を返します。",
        ),
        namespace_tool(
            "list_deleted_content",
            "List Deleted Content",
            "削除済みコンテンツ一覧を返します。",
        ),
        namespace_tool(
            "list_favorite_content",
            "List Favorite Content",
            "お気に入りコンテンツ一覧を返します。",
        ),
        tool(
            "set_favorite_content",
            "Set Favorite Content",
            "ページまたはファイルのお気に入り状態を変更します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("path", "対象コンテンツの相対パス"),
                bool_prop("is_favorite", "お気に入りにする場合 true"),
            ]),
        ),
        tool(
            "read_deleted_page",
            "Read Deleted Page",
            "削除済み Markdown ページの最新内容を読み込みます。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("file_id", "削除済みページの file ID"),
            ]),
        ),
        tool(
            "read_deleted_file",
            "Read Deleted File",
            "削除済み管理対象ファイルの最新内容を読み込みます。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("file_id", "削除済みファイルの file ID"),
            ]),
        ),
        tool(
            "read_page_history_snapshot",
            "Read Page History Snapshot",
            "ページの指定 revision、直前との差分、本文を返します。",
            object_schema(vec![
                string_prop("namespace_id", "namespace ID"),
                string_prop("path", "対象ページの .md 相対パス"),
                string_prop("revision_id", "読み込む revision ID"),
            ]),
        ),
    ]
}

fn initialize_result() -> Value {
    json!({
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": {
                "listChanged": false
            }
        },
        "serverInfo": {
            "name": "daibase",
            "title": "Daibase MCP Server",
            "version": env!("CARGO_PKG_VERSION")
        },
        "instructions": "Daibase の namespace、ページ、ファイル、履歴を操作する MCP サーバーです。編集操作は Daibase の独自バージョン管理に記録されます。"
    })
}

fn tool(name: &str, title: &str, description: &str, input_schema: Value) -> Value {
    json!({
        "name": name,
        "title": title,
        "description": description,
        "inputSchema": input_schema
    })
}

fn namespace_tool(name: &str, title: &str, description: &str) -> Value {
    tool(
        name,
        title,
        description,
        object_schema(vec![string_prop("namespace_id", "namespace ID")]),
    )
}

fn namespace_path_tool(name: &str, title: &str, description: &str) -> Value {
    tool(
        name,
        title,
        description,
        object_schema(vec![
            string_prop("namespace_id", "namespace ID"),
            string_prop("path", "namespace root からの相対パス"),
        ]),
    )
}

fn object_schema(properties: Vec<(&'static str, Value)>) -> Value {
    let required = properties
        .iter()
        .map(|(name, _)| Value::String((*name).to_string()))
        .collect::<Vec<_>>();
    let properties = properties
        .into_iter()
        .map(|(name, schema)| (name.to_string(), schema))
        .collect::<serde_json::Map<_, _>>();
    json!({
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": false
    })
}

fn string_prop(name: &'static str, description: &str) -> (&'static str, Value) {
    (
        name,
        json!({ "type": "string", "description": description }),
    )
}

fn bool_prop(name: &'static str, description: &str) -> (&'static str, Value) {
    (
        name,
        json!({ "type": "boolean", "description": description }),
    )
}

fn call_namespace_id<T, F>(arguments: Value, function: F) -> Result<Value, String>
where
    T: Serialize,
    F: FnOnce(String) -> Result<T, String>,
{
    required_string(&arguments, "namespace_id")
        .and_then(function)
        .and_then(|value| serde_json::to_value(value).map_err(to_error))
}

fn call_namespace_path<T, F>(arguments: Value, function: F) -> Result<Value, String>
where
    T: Serialize,
    F: FnOnce(String, String) -> Result<T, String>,
{
    let namespace_id = required_string(&arguments, "namespace_id");
    let path = required_string(&arguments, "path");
    match (namespace_id, path) {
        (Ok(namespace_id), Ok(path)) => function(namespace_id, path)
            .and_then(|value| serde_json::to_value(value).map_err(to_error)),
        (Err(error), _) | (_, Err(error)) => Err(error),
    }
}

fn to_value<T: Serialize>(result: Result<T, String>) -> Result<Value, String> {
    result.and_then(|value| serde_json::to_value(value).map_err(to_error))
}

fn required_string(arguments: &Value, name: &str) -> Result<String, String> {
    arguments
        .get(name)
        .and_then(Value::as_str)
        .map(ToString::to_string)
        .ok_or_else(|| format!("{name} は文字列で指定してください。"))
}

fn required_bool(arguments: &Value, name: &str) -> Result<bool, String> {
    arguments
        .get(name)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("{name} は boolean で指定してください。"))
}

fn tool_result(value: Value, is_error: bool) -> Value {
    json!({
        "content": [
            {
                "type": "text",
                "text": serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string())
            }
        ],
        "structuredContent": value,
        "isError": is_error
    })
}

fn read_headers(reader: &mut BufReader<TcpStream>) -> Result<BTreeMap<String, String>, String> {
    let mut headers = BTreeMap::new();
    loop {
        let mut line = String::new();
        reader.read_line(&mut line).map_err(to_error)?;
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        if let Some((name, value)) = trimmed.split_once(':') {
            headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
        }
    }
    Ok(headers)
}

fn is_allowed_origin(headers: &BTreeMap<String, String>) -> bool {
    headers.get("origin").is_none_or(|origin| {
        origin == "http://127.0.0.1"
            || origin == "http://localhost"
            || origin
                .strip_prefix("http://127.0.0.1:")
                .is_some_and(is_port)
            || origin
                .strip_prefix("http://localhost:")
                .is_some_and(is_port)
    })
}

fn is_port(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn accepts_json_and_sse(headers: &BTreeMap<String, String>) -> bool {
    headers.get("accept").is_none_or(|accept| {
        accept.contains("application/json") && accept.contains("text/event-stream")
    })
}

fn valid_protocol_version(headers: &BTreeMap<String, String>) -> bool {
    headers
        .get("mcp-protocol-version")
        .is_none_or(|version| version == MCP_PROTOCOL_VERSION || version == "2025-03-26")
}

fn write_options(mut stream: TcpStream) -> Result<(), String> {
    let response = "HTTP/1.1 204 No Content\r\n\
        Access-Control-Allow-Origin: http://127.0.0.1\r\n\
        Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS\r\n\
        Access-Control-Allow-Headers: Accept, Content-Type, MCP-Protocol-Version, Mcp-Session-Id\r\n\
        Content-Length: 0\r\n\r\n";
    stream.write_all(response.as_bytes()).map_err(to_error)
}

fn write_json_response(stream: &mut TcpStream, value: &Value) -> Result<(), String> {
    let body = serde_json::to_string(value).map_err(to_error)?;
    write_http_response(stream, 200, "OK", "application/json", &body)
}

fn write_http_error(stream: &mut TcpStream, status: u16, reason: &str) -> Result<(), String> {
    write_http_response(stream, status, reason, "text/plain", reason)
}

fn write_http_response(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    content_type: &str,
    body: &str,
) -> Result<(), String> {
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\n\
        Content-Type: {content_type}; charset=utf-8\r\n\
        Content-Length: {}\r\n\
        Access-Control-Allow-Origin: http://127.0.0.1\r\n\
        Connection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(response.as_bytes()).map_err(to_error)
}

fn json_rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": {
            "code": code,
            "message": message
        }
    })
}

fn to_error(error: impl ToString) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_declares_streamable_http_tools_capability() {
        let response = initialize_result();

        assert_eq!(response["protocolVersion"], MCP_PROTOCOL_VERSION);
        assert!(response["capabilities"]["tools"].is_object());
    }

    #[test]
    fn tools_list_includes_editing_tools() {
        let tool_names = tools()
            .into_iter()
            .filter_map(|tool| tool["name"].as_str().map(ToString::to_string))
            .collect::<Vec<_>>();

        assert!(tool_names.contains(&"write_page".to_string()));
        assert!(tool_names.contains(&"upload_file".to_string()));
        assert!(tool_names.contains(&"delete_page".to_string()));
        assert!(tool_names.contains(&"restore_deleted_content".to_string()));
    }
}
