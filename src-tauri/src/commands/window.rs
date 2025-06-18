use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn set_window_color(
    red: f64,
    green: f64,
    blue: f64,
    alpha: f64,
    app: AppHandle,
) {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "macos")]
        set_macos_window_color(&window, red, green, blue, alpha);
    } else {
        eprintln!("Window 'main' not found");
    }
}

#[cfg(target_os = "macos")]
fn set_macos_window_color(window: &tauri::WebviewWindow, red: f64, green: f64, blue: f64, alpha: f64) {
    use objc2::class;
    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use raw_window_handle::{HasWindowHandle, RawWindowHandle};

    let raw_handle = window.window_handle().unwrap().as_raw();

    let ns_view_ptr = match raw_handle {
        RawWindowHandle::AppKit(handle) => handle.ns_view.as_ptr() as *mut AnyObject,
        _ => panic!("Not a macOS AppKit window"),
    };

    unsafe {
        let ns_window: *mut AnyObject = msg_send![ns_view_ptr, window];
        let ns_color: *mut AnyObject = msg_send![class!(NSColor),
            colorWithRed: red / 255.0,
            green: green / 255.0,
            blue: blue / 255.0,
            alpha: alpha
        ];
        let _: () = msg_send![ns_window, setBackgroundColor: ns_color];
    }
}
