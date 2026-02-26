pub mod cli; // macht cogno_lib::cli::* sichtbar
pub mod commands;

use crate::cli::Cli;
use clap::Parser;
use commands::config::get_default_config;
use commands::crypto::decrypt;
use commands::crypto::encrypt;
use commands::environment::{
    get_cogno_config_file_path, get_cogno_db_file_path, get_cogno_home_dir, get_exe_dir,
    get_exe_path, get_macos_app_bundle, get_system_path,
};
use commands::fonts::list_fonts;
use commands::keyboard::get_keyboard_layout;
use commands::processes::{pty_get_process_tree_by_pid, pty_get_process_tree_by_terminal_id};
use commands::pty::{pty_kill, pty_resize, pty_spawn, pty_write, PtyState};
use commands::shells::list_shells;
use commands::window::new_window;
use tauri::{Builder, Emitter, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(cli: Cli) {
    Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Wenn eine zweite Instanz gestartet wird, parse die CLI-Argumente
            if let Ok(cli) = Cli::try_parse_from(argv) {
                if let Some(cmd) = cli.action {
                    let _ = app.emit("cli-action", &cmd);
                }
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
            pty_get_process_tree_by_pid,
            pty_get_process_tree_by_terminal_id,
            get_exe_path,
            get_exe_dir,
            get_macos_app_bundle,
            get_cogno_home_dir,
            get_cogno_config_file_path,
            get_cogno_db_file_path,
            get_system_path,
            new_window
        ])
        .setup(move |app| {
            let webview_window_builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("")
                    .inner_size(800.0, 600.0)
                    .visible(false);

            #[cfg(target_os = "macos")]
            let win_builder = webview_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);

            #[cfg(not(target_os = "macos"))]
            let win_builder = webview_window_builder.decorations(false);

            let window = win_builder.build().unwrap();
            window.show().unwrap();

            // Beim ersten Start: ggf. gewünschten Command ausführen
            if let Some(cmd) = cli.action.clone() {
                let _ = app.emit("cli-action", &cmd);
            }

            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
