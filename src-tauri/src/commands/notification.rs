use serde_json::Value;
use tauri::Manager;

pub const OS_NOTIFICATION_CLICKED_EVENT: &str = "os-notification-clicked";

/// Shows an OS notification that carries an optional click target. When the
/// user clicks the notification, the originating window is brought to the
/// foreground and the target is emitted back to that window's webview so the
/// frontend can focus the matching tab/pane.
///
/// Click handling is implemented natively per platform because the official
/// notification plugin does not deliver click events on desktop.
#[tauri::command]
pub async fn send_os_notification(
    window: tauri::WebviewWindow,
    title: String,
    body: Option<String>,
    target: Option<Value>,
) -> Result<(), String> {
    let title = title.trim().to_string();
    if title.is_empty() {
        return Err("Notification title must not be empty".to_string());
    }
    let body = body
        .map(|body| body.trim().to_string())
        .filter(|body| !body.is_empty());

    show_notification(&window, title, body, target)
}

#[cfg(any(windows, target_os = "linux"))]
fn focus_window_and_emit_click(app: &tauri::AppHandle, window_label: &str, target: &Option<Value>) {
    use tauri::Emitter;

    if let Some(webview_window) = app.get_webview_window(window_label) {
        let _ = webview_window.show();
        let _ = webview_window.unminimize();
        let _ = webview_window.set_focus();
    }
    let _ = app.emit_to(window_label, OS_NOTIFICATION_CLICKED_EVENT, target.clone());
}

#[cfg(windows)]
fn show_notification(
    window: &tauri::WebviewWindow,
    title: String,
    body: Option<String>,
    target: Option<Value>,
) -> Result<(), String> {
    use tauri_winrt_notification::Toast;

    let app = window.app_handle().clone();
    let window_label = window.label().to_string();

    let mut toast = Toast::new(&windows_app_id(&app))
        .title(&title)
        .on_activated(move |_action| {
            focus_window_and_emit_click(&app, &window_label, &target);
            Ok(())
        });
    if let Some(body) = &body {
        toast = toast.text1(body);
    }
    toast.show().map_err(|error| error.to_string())
}

/// Toast activation requires a registered AppUserModelID. The installed app
/// registers its bundle identifier via the shortcut created by the installer;
/// dev builds run unregistered and fall back to the PowerShell AUMID (same
/// heuristic the official notification plugin uses).
#[cfg(windows)]
fn windows_app_id(app: &tauri::AppHandle) -> String {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.display().to_string()))
        .unwrap_or_default();
    if exe_dir.ends_with("\\target\\debug") || exe_dir.ends_with("\\target\\release") {
        tauri_winrt_notification::Toast::POWERSHELL_APP_ID.to_string()
    } else {
        app.config().identifier.clone()
    }
}

#[cfg(target_os = "linux")]
fn show_notification(
    window: &tauri::WebviewWindow,
    title: String,
    body: Option<String>,
    target: Option<Value>,
) -> Result<(), String> {
    let app = window.app_handle().clone();
    let window_label = window.label().to_string();

    // wait_for_action blocks until the notification is acted on or closed, so
    // the whole show + wait cycle runs on its own thread.
    std::thread::spawn(move || {
        let mut notification = notify_rust::Notification::new();
        notification.summary(&title);
        if let Some(body) = &body {
            notification.body(body);
        }
        notification.action("default", "Open");
        match notification.show() {
            Ok(handle) => handle.wait_for_action(|action| {
                if action == "default" {
                    focus_window_and_emit_click(&app, &window_label, &target);
                }
            }),
            Err(error) => log::error!("Failed to show notification: {error}"),
        }
    });
    Ok(())
}

/// macOS activates the app on notification click by itself; targeted tab/pane
/// focus would require a UNUserNotificationCenter delegate and is not
/// implemented here.
#[cfg(target_os = "macos")]
fn show_notification(
    window: &tauri::WebviewWindow,
    title: String,
    body: Option<String>,
    _target: Option<Value>,
) -> Result<(), String> {
    let identifier = window.app_handle().config().identifier.clone();
    let _ = notify_rust::set_application(if tauri::is_dev() {
        "com.apple.Terminal"
    } else {
        &identifier
    });

    let mut notification = notify_rust::Notification::new();
    notification.summary(&title);
    if let Some(body) = &body {
        notification.body(body);
    }
    notification
        .show()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
