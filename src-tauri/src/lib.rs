use cogno_tauri_core::cli::Cli;
use cogno_tauri_core::commands::pty::PtyState;
use cogno_tauri_core::http_server::HttpServerState;
use cogno_tauri_core::{initialize_app_identity, AppIdentity};
use tauri::window::Color;
use tauri::{Builder, Emitter, WebviewUrl, WebviewWindowBuilder};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(cli: Cli) {
    initialize_app_identity(AppIdentity::new(
        "cogno",
        ".cogno",
        ".cogno-dev",
    ));

    Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin({
            let log_level = std::env::var("COGNO_LOG_LEVEL")
                .ok()
                .and_then(|s| s.parse::<tauri_plugin_log::log::LevelFilter>().ok())
                .unwrap_or(tauri_plugin_log::log::LevelFilter::Info);
            tauri_plugin_log::Builder::new()
                .level(log_level)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Webview,
                ))
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir { file_name: None },
                ))
                .build()
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use clap::Parser;
            if let Ok(cli) = Cli::try_parse_from(argv) {
                if let Some(action_payload) = cli.action_payload() {
                    let _ = app.emit("cli-action", &action_payload);
                }
            }
        }))
        .manage(PtyState::new())
        .manage(HttpServerState::new())
        .invoke_handler(tauri::generate_handler![
            cogno_tauri_core::commands::command_runner::command_runner_execute,
            cogno_tauri_core::commands::git_blob::git_read_blob,
            cogno_tauri_core::commands::config::get_default_config,
            cogno_tauri_core::commands::fonts::list_fonts,
            cogno_tauri_core::commands::shells::list_shells,
            cogno_tauri_core::commands::keyboard::get_keyboard_layout,
            cogno_tauri_core::commands::ai_http::ai_http_request,
            cogno_tauri_core::commands::ai_http::ai_http_request_stream,
            cogno_tauri_core::commands::crypto::decrypt,
            cogno_tauri_core::commands::crypto::encrypt,
            cogno_tauri_core::commands::pty::pty_spawn,
            cogno_tauri_core::commands::pty::pty_write,
            cogno_tauri_core::commands::pty::pty_execute_line_editor_action,
            cogno_tauri_core::commands::pty::pty_resize,
            cogno_tauri_core::commands::pty::pty_kill,
            cogno_tauri_core::commands::processes::pty_get_process_tree_by_pid,
            cogno_tauri_core::commands::processes::pty_get_process_tree_by_terminal_id,
            cogno_tauri_core::commands::environment::get_exe_path,
            cogno_tauri_core::commands::environment::get_exe_dir,
            cogno_tauri_core::commands::environment::get_macos_app_bundle,
            cogno_tauri_core::commands::environment::get_cogno_home_dir,
            cogno_tauri_core::commands::environment::get_cogno_config_file_path,
            cogno_tauri_core::commands::environment::get_cogno_db_file_path,
            cogno_tauri_core::commands::environment::get_cogno_log_file_path,
            cogno_tauri_core::commands::environment::get_system_path,
            cogno_tauri_core::commands::environment::get_cli_config_set_overrides,
            cogno_tauri_core::commands::window::new_window,
            cogno_tauri_core::commands::clipboard_image::save_clipboard_image_to_file,
            cogno_tauri_core::http_server::start_http_server,
            cogno_tauri_core::http_server::get_http_server_port
        ])
        .setup(move |app| {
            let webview_window_builder =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                    .title("")
                    .inner_size(800.0, 600.0)
                    .background_color(Color(0x0e, 0x19, 0x25, 0xff))
                    .visible(false);

            #[cfg(target_os = "macos")]
            let win_builder = webview_window_builder.title_bar_style(tauri::TitleBarStyle::Overlay);

            #[cfg(not(target_os = "macos"))]
            let win_builder = webview_window_builder.decorations(false);

            let window = win_builder.build().unwrap();
            window.show().unwrap();

            // Run the requested command on first launch when present.
            if let Some(action_payload) = cli.action_payload() {
                let _ = app.emit("cli-action", &action_payload);
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
