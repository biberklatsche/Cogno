// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//#[tauri::command]
//fn greet(name: &str) -> String {
//    format!("Hello, {}! You've been greeted from Rust!", name)
//}

use tauri::{Builder, Manager};

mod commands;
use commands::crypto::decrypt;
use commands::crypto::encrypt;
use commands::fonts::list_fonts;
use commands::keyboard::get_keyboard_layout;
use commands::shells::list_shells;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // "main" is the label of the window in tauri.conf.json
            let window = app
                .get_webview_window("main")
                .expect("failed to get main window");
            // window config
            window
                .set_decorations(false)
                .expect("failed to disable decorations");
            Ok(())
        })
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .invoke_handler(tauri::generate_handler![
            list_fonts,
            list_shells,
            get_keyboard_layout,
            decrypt,
            encrypt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
