// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//#[tauri::command]
//fn greet(name: &str) -> String {
//    format!("Hello, {}! You've been greeted from Rust!", name)
//}

use tauri::{Builder, WebviewUrl, WebviewWindowBuilder};

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
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
                    list_fonts,
                    list_shells,
                    get_keyboard_layout,
                    decrypt,
                    encrypt
                ])
        .setup(|app| {
           let webview_window_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                           .title("")
                           .inner_size(800.0, 600.0)
                           .visible(false);

           #[cfg(target_os = "macos")]
           let win_builder = webview_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);

           #[cfg(not(target_os = "macos"))]{
               // let win_builder = webview_window_builder.decorations(false);
               webview_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);
           }


           let window = win_builder.build().unwrap();
           window.show().unwrap();

           Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
