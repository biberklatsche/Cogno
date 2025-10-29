use tauri::{Builder, WebviewUrl, WebviewWindowBuilder, Emitter};

mod commands;
use commands::crypto::decrypt;
use commands::crypto::encrypt;
use commands::fonts::list_fonts;
use commands::keyboard::get_keyboard_layout;
use commands::shells::list_shells;
use commands::pty::{pty_spawn, pty_write, pty_resize, pty_kill, PtyState};
use commands::environment::{get_exe_path, get_exe_dir, get_macos_app_bundle};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Handle args from a second invocation here
            if argv.iter().any(|a| a == "--open-new-tab") {
                // Emit a global event that the frontend can react to
                let _ = app.emit("cogno://open-new-tab", ());
            }
        }))
        .manage(PtyState::new())
        .invoke_handler(tauri::generate_handler![
                    list_fonts,
                    list_shells,
                    get_keyboard_layout,
                    decrypt,
                    encrypt,
                    pty_spawn,
                    pty_write,
                    pty_resize,
                    pty_kill,
                    get_exe_path,
                    get_exe_dir,
                    get_macos_app_bundle
                ])
        .setup(|app| {
           let webview_window_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                           .title("")
                           .inner_size(800.0, 600.0)
                           .visible(false);

           #[cfg(target_os = "macos")]
           let win_builder = webview_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);


           #[cfg(not(target_os = "macos"))]
           let win_builder = webview_window_builder.decorations(false);

           let window = win_builder.build().unwrap();
           window.show().unwrap();

           #[cfg(debug_assertions)] // only include this code on debug builds
           {
              window.open_devtools();
           }

           // If this is the first instance and it was started with --open-new-tab,
           // immediately emit the event so the UI can react.
           if std::env::args().any(|a| a == "--open-new-tab") {
               app.emit("cogno://open-new-tab", ()).ok();
           }

           Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
