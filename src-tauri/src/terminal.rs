use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

const TERMINAL_OUTPUT_EVENT: &str = "terminal:output";
const DEFAULT_TERMINAL_COLS: u16 = 80;
const DEFAULT_TERMINAL_ROWS: u16 = 24;

#[derive(Default)]
pub struct TerminalSessions {
    sessions: Mutex<HashMap<String, TerminalProcess>>,
}

struct TerminalProcess {
    child: Box<dyn Child + Send + Sync>,
    master: Box<dyn MasterPty + Send>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

#[derive(Debug, Serialize)]
pub struct TerminalSessionSummary {
    pub id: String,
    pub shell: String,
}

#[derive(Debug, Clone, Serialize)]
struct TerminalOutputEvent {
    session_id: String,
    stream: String,
    text: String,
}

pub fn start_terminal(
    app: AppHandle,
    sessions: &TerminalSessions,
    columns: Option<u16>,
    rows: Option<u16>,
) -> Result<TerminalSessionSummary, String> {
    let shell = default_shell();
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(terminal_size(columns, rows))
        .map_err(to_error)?;

    let mut command = CommandBuilder::new(&shell);
    command.arg("-i");
    if let Some(home) = std::env::var_os("HOME") {
        command.cwd(home);
    }

    let child = pair.slave.spawn_command(command).map_err(to_error)?;
    let reader = pair.master.try_clone_reader().map_err(to_error)?;
    let writer = Arc::new(Mutex::new(pair.master.take_writer().map_err(to_error)?));

    let session_id = Uuid::new_v4().to_string();
    spawn_reader(app, session_id.clone(), reader);

    sessions.sessions.lock().map_err(to_error)?.insert(
        session_id.clone(),
        TerminalProcess {
            child,
            master: pair.master,
            writer,
        },
    );

    Ok(TerminalSessionSummary {
        id: session_id,
        shell,
    })
}

pub fn write_terminal(
    sessions: &TerminalSessions,
    session_id: String,
    input: String,
) -> Result<(), String> {
    let writer = {
        let sessions = sessions.sessions.lock().map_err(to_error)?;
        sessions
            .get(&session_id)
            .map(|terminal| terminal.writer.clone())
            .ok_or_else(|| "ターミナルセッションが見つかりません。".to_string())?
    };

    let result = writer
        .lock()
        .map_err(to_error)?
        .write_all(input.as_bytes())
        .map_err(to_error);
    result
}

pub fn resize_terminal(
    sessions: &TerminalSessions,
    session_id: String,
    columns: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = sessions.sessions.lock().map_err(to_error)?;
    let terminal = sessions
        .get(&session_id)
        .ok_or_else(|| "ターミナルセッションが見つかりません。".to_string())?;
    terminal
        .master
        .resize(terminal_size(Some(columns), Some(rows)))
        .map_err(to_error)
}

pub fn stop_terminal(sessions: &TerminalSessions, session_id: String) -> Result<(), String> {
    let Some(mut terminal) = sessions
        .sessions
        .lock()
        .map_err(to_error)?
        .remove(&session_id)
    else {
        return Ok(());
    };

    terminal.child.kill().map_err(to_error)?;
    terminal.child.wait().map_err(to_error)?;
    Ok(())
}

fn spawn_reader(app: AppHandle, session_id: String, mut reader: Box<dyn Read + Send>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            let read_size = match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read_size) => read_size,
                Err(error) => {
                    emit_terminal_output(
                        &app,
                        &session_id,
                        "system",
                        &format!("Terminal stream error: {error}\r\n"),
                    );
                    break;
                }
            };
            let text = String::from_utf8_lossy(&buffer[..read_size]).to_string();
            emit_terminal_output(&app, &session_id, "pty", &text);
        }
    });
}

fn emit_terminal_output(app: &AppHandle, session_id: &str, stream: &str, text: &str) {
    let _ = app.emit(
        TERMINAL_OUTPUT_EVENT,
        TerminalOutputEvent {
            session_id: session_id.to_string(),
            stream: stream.to_string(),
            text: text.to_string(),
        },
    );
}

fn terminal_size(columns: Option<u16>, rows: Option<u16>) -> PtySize {
    PtySize {
        rows: rows.unwrap_or(DEFAULT_TERMINAL_ROWS).max(1),
        cols: columns.unwrap_or(DEFAULT_TERMINAL_COLS).max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn default_shell() -> String {
    std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
}

fn to_error(error: impl ToString) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_size_falls_back_to_default_dimensions() {
        let size = terminal_size(None, None);

        assert_eq!(size.cols, DEFAULT_TERMINAL_COLS);
        assert_eq!(size.rows, DEFAULT_TERMINAL_ROWS);
    }

    #[test]
    fn terminal_size_clamps_zero_dimensions() {
        let size = terminal_size(Some(0), Some(0));

        assert_eq!(size.cols, 1);
        assert_eq!(size.rows, 1);
    }

    #[test]
    fn default_shell_falls_back_to_zsh_when_shell_is_unset() {
        let old_shell = std::env::var_os("SHELL");
        std::env::remove_var("SHELL");

        assert_eq!(default_shell(), "/bin/zsh");

        if let Some(old_shell) = old_shell {
            std::env::set_var("SHELL", old_shell);
        }
    }
}
