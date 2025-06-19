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
use commands::window::set_window_color;

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
                    encrypt,
                    set_window_color
                ])
        .setup(|app| {
           let webview_window_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                           .title("")
                           .inner_size(800.0, 600.0)
                           .visible(false);

           #[cfg(target_os = "macos")]
           let win_builder = webview_window_builder.title_bar_style(tauri::TitleBarStyle::Transparent);

           #[cfg(not(target_os = "macos"))]
           let win_builder = webview_window_builder.decorations(false);

           let window = win_builder.build().unwrap();
            window.show().unwrap();

           #[cfg(target_os = "macos")]{
               let app_handle = app.handle();
               set_window_color(10.0, 10.0, 10.0, 1.0, app_handle.clone());
           }
           Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
