// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//#[tauri::command]
//fn greet(name: &str) -> String {
//    format!("Hello, {}! You've been greeted from Rust!", name)
//}
mod commands;
use commands::fonts::list_fonts;
use commands::shells::list_shells;
use commands::keyboard::get_keyboard_layout;
use commands::crypto::encrypt;
use commands::crypto::decrypt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .invoke_handler(tauri::generate_handler![list_fonts, list_shells, get_keyboard_layout, decrypt, encrypt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
