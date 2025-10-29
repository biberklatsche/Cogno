use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub name: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResizeOptions {
    pub cols: u16,
    pub rows: u16,
}

struct Session {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    should_exit: Arc<AtomicBool>,
}

pub struct PtyState {
    sessions: Arc<Mutex<HashMap<String, Session>>>,
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub async fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    program: String,
    args: Vec<String>,
    options: SpawnOptions,
) -> Result<(), String> {
    let terminal_id = options.name.clone();
    
    let pty_system = native_pty_system();
    
    let pair = pty_system
        .openpty(PtySize {
            rows: options.rows,
            cols: options.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&program);
    cmd.args(&args);

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let should_exit = Arc::new(AtomicBool::new(false));

    let session = Session {
        master: pair.master,
        writer,
        should_exit: should_exit.clone(),
    };

    {
        let mut sessions = state.sessions.lock().unwrap();
        sessions.insert(terminal_id.clone(), session);
    }

    // Start reading from PTY in background thread
    let terminal_id_clone = terminal_id.clone();
    let app_clone = app.clone();
    let sessions_clone = state.sessions.clone();
    let should_exit_clone = should_exit.clone();

    std::thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 8192];
        
        loop {
            if should_exit_clone.load(Ordering::Relaxed) {
                break;
            }
            match std::io::Read::read(&mut reader, &mut buf) {
                Ok(0) => {
                    // EOF - process exited
                    let _ = app_clone.emit(&format!("pty-exit:{}", terminal_id_clone), serde_json::json!({
                        "exitCode": 0
                    }));

                    // Remove session
                    let mut sessions = sessions_clone.lock().unwrap();
                    sessions.remove(&terminal_id_clone);
                    break;
                }
                Ok(n) => {
                    if !should_exit_clone.load(Ordering::Relaxed) {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app_clone.emit(&format!("pty-data:{}", terminal_id_clone), data);
                    } else {
                        break;  // Beenden ohne weitere Events
                    }
                }
                Err(_e) => {
                    let _ = app_clone.emit(&format!("pty-exit:{}", terminal_id_clone), serde_json::json!({
                        "exitCode": 1
                    }));

                    // Remove session
                    let mut sessions = sessions_clone.lock().unwrap();
                    sessions.remove(&terminal_id_clone);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    
    if let Some(session) = sessions.get_mut(&terminal_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        
        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    terminal_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    
    if let Some(session) = sessions.get_mut(&terminal_id) {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        
        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}

#[tauri::command]
pub fn pty_kill(
    state: State<'_, PtyState>,
    terminal_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    
    if let Some(session) = sessions.remove(&terminal_id) {
        session.should_exit.store(true, Ordering::Relaxed);
        drop(session.master);  // <-- Schließt den PTY, dadurch gibt read() EOF zurück
        drop(session.writer);
        Ok(())
    } else {
        Err(format!("Session not found: {}", terminal_id))
    }
}
