pub mod cli; // macht cogno_lib::cli::* sichtbar
pub mod commands;

use tauri::{Builder, WebviewUrl, WebviewWindowBuilder, Emitter};
use clap::ArgMatches;
use crate::cli::parse_cli_from_argv;
use commands::config::get_default_config;
use commands::crypto::decrypt;
use commands::crypto::encrypt;
use commands::fonts::list_fonts;
use commands::keyboard::get_keyboard_layout;
use commands::shells::list_shells;
use commands::pty::{pty_spawn, pty_write, pty_resize, pty_kill, PtyState};
use commands::environment::{get_exe_path, get_exe_dir, get_macos_app_bundle};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(matches: ArgMatches) {
    Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let m = parse_cli_from_argv(argv);
            if m.get_flag("open-new-tab") {
                let _ = app.emit("open-new-tab", ());
            }
        }))
        .manage(PtyState::new())
        .invoke_handler(tauri::generate_handler![
                    get_default_config,
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
        .setup(move |app| {
           if matches.get_flag("open-new-tab") {
               app.emit("open-new-tab", ()).ok();
           }

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

           Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
