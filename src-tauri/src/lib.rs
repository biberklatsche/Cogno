#[path = "actions.generated.rs"]
pub mod actions_generated;
mod app_identity;
pub mod cli;
pub mod commands;
mod db;
mod endpoint;
mod http_server;
mod updater;

use app_identity::LOG_FILE_STEM;
use cli::Cli;
use commands::pty::PtyState;
use commands::window_registry::{route, WindowRegistry};
use db::Db;
use http_server::{HttpServerState, RunnableActionsState};
use tauri::window::Color;
use tauri::{Builder, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// The log plugin's default is 40 KB, less than one busy session writes. A
/// few MB hold the last sessions, and the two full files before stay for a
/// report.
const LOG_MAX_FILE_SIZE: u128 = 5 * 1024 * 1024;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(cli: Cli) {
    // Capture the user's login-shell environment in the background so the
    // first terminal spawn does not pay the login-shell startup cost.
    crate::commands::login_environment::prefetch_login_environment();

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
                // Suppress tao's harmless Windows event loop ordering warnings (known tao/winit issue on Windows, not fixable from userland)
                .level_for("tao", tauri_plugin_log::log::LevelFilter::Error)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some(LOG_FILE_STEM.to_string()),
                    }),
                ])
                .max_file_size(LOG_MAX_FILE_SIZE)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepSome(2))
                .build()
        })
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use clap::Parser;
            let Ok(cli) = Cli::try_parse_from(argv) else {
                return;
            };
            if let Some(action_payload) = cli.action_payload() {
                route(app, "cli-action", &action_payload, None);
            }
            // `--config` and `--set` shape a process at its start; the one
            // already running cannot take them on, and the second process
            // is gone before it could say so. The window says it instead.
            if cli.config.is_some() || !cli.config_set_overrides.is_empty() {
                route(
                    app,
                    "cli-notice",
                    "Cogno is already running: --config and --set only apply to a fresh start and were ignored.",
                    None,
                );
            }
            // A second start means "show me Cogno": the window the user last
            // worked in comes to the front.
            if let Some(window) = app
                .state::<WindowRegistry>()
                .last_focused()
                .and_then(|label| app.get_webview_window(&label))
            {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(PtyState::new())
        .manage(crate::commands::window::QuitState::default())
        .manage(HttpServerState::new())
        .manage(RunnableActionsState::new())
        .manage(Db::new())
        .manage(WindowRegistry::new())
        .manage(crate::commands::askpass::AskpassState::new())
        .on_window_event(|window, event| match event {
            WindowEvent::Focused(true) => {
                window
                    .app_handle()
                    .state::<WindowRegistry>()
                    .set_focus(window.label());
            }
            WindowEvent::Destroyed => {
                let app = window.app_handle();
                app.state::<crate::commands::window::QuitState>()
                    .cancel_window(window.label());
                app.state::<PtyState>().release_window(window.label());
                app.state::<WindowRegistry>().on_destroyed(window.label());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::window::window_prepare_quit,
            crate::commands::window::window_receive_quit,
            crate::commands::window::window_answer_quit,
            crate::db::commands::db_open,
            crate::db::commands::db_execute,
            crate::db::commands::db_select,
            crate::db::commands::db_batch,
            crate::commands::command_runner::command_runner_execute,
            crate::commands::askpass::askpass_answer,
            crate::commands::config::get_default_config,
            crate::commands::shells::list_shells,
            crate::commands::keyboard::get_keyboard_layout,
            crate::commands::pty::pty_spawn,
            crate::commands::pty::pty_write,
            crate::commands::pty::pty_execute_line_editor_action,
            crate::commands::pty::pty_resize,
            crate::commands::pty::pty_kill,
            crate::commands::pty::pty_ack,
            crate::commands::processes::pty_get_process_tree_by_terminal_id,
            crate::commands::processes::pty_list_terminal_processes,
            crate::commands::environment::get_cogno_home_dir,
            crate::commands::environment::get_cogno_config_file_path,
            crate::commands::environment::get_cogno_db_file_path,
            crate::commands::environment::get_cogno_log_file_path,
            crate::commands::environment::get_cli_config_set_overrides,
            crate::commands::window::new_window,
            crate::commands::window::window_claim_workspace,
            crate::commands::window::window_release_workspace,
            crate::commands::notification::send_os_notification,
            crate::commands::clipboard_image::save_clipboard_image_to_file,
            crate::http_server::start_http_server,
            crate::http_server::set_runnable_actions,
            crate::updater::updater_state,
            crate::updater::updater_check,
            crate::updater::updater_install
        ])
        .setup(move |app| {
            crate::updater::manage(app.handle());
            std::thread::spawn(crate::commands::clipboard_image::remove_leftover_paste_files);

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

            // A failure here ends the start with Tauri's setup error, not a panic.
            let window = win_builder.build()?;
            window.show()?;

            // Run the requested command on first launch when present.
            if let Some(action_payload) = cli.action_payload() {
                route(app.handle(), "cli-action", &action_payload, None);
            }

            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                window.open_devtools();
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                // Shells first, so none outlives the app (SIGHUP lets them
                // write their history on the way out).
                app.state::<PtyState>().release_all();
                // No process must find this instance's port once it is gone.
                app.state::<HttpServerState>().remove_endpoint();
                // Fold the WAL back into the main file so the database is a
                // single, consistent file once the process is gone.
                app.state::<Db>().close();
            }
        });
}
