//! What a window may do with sign-ins. It learns that an origin is signed in,
//! never a token.

use super::store::Provider;
use super::{SignInStatus, SignIns};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;

/// Signs in to `origin` in the browser; resolves when the tokens are stored.
#[tauri::command]
pub async fn sign_ins_sign_in(
    app: AppHandle,
    sign_ins: State<'_, SignIns>,
    origin: String,
    provider: Provider,
) -> Result<SignInStatus, String> {
    // Git reaches a sign-in only through the local server (`POST /credential`).
    if app.state::<crate::http_server::HttpServerState>().port() == 0 {
        return Err(
            "Cogno's local server is off (http_server.enabled), so git could not ask Cogno for the sign-in."
                .to_string(),
        );
    }
    sign_ins
        .sign_in(&origin, provider, |url| {
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|error| error.to_string())
        })
        .await
}

/// Ends a sign-in that still waits for the browser.
#[tauri::command]
pub fn sign_ins_cancel(sign_ins: State<'_, SignIns>, origin: String) {
    sign_ins.cancel(&origin);
}

#[tauri::command]
pub async fn sign_ins_sign_out(sign_ins: State<'_, SignIns>, origin: String) -> Result<(), String> {
    sign_ins.sign_out(&origin).await;
    Ok(())
}

#[tauri::command]
pub fn sign_ins_list(sign_ins: State<'_, SignIns>) -> Vec<SignInStatus> {
    sign_ins.statuses()
}
