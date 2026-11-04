//! How a process without a Cogno terminal's environment reaches the running
//! instance (ARCHITECTURE.md 2.1): an endpoint file in the Cogno home naming
//! port, process id and an **external token**. The token opens `POST /action`
//! (a message to the webview) and nothing else. What a message means is the
//! business of whoever reads it; this file knows no consumer.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const ENDPOINT_FILE: &str = "endpoint.json";

pub fn endpoint_path(cogno_home: &Path) -> PathBuf {
    cogno_home.join(ENDPOINT_FILE)
}

/// Writes the endpoint file for this instance, readable by the user only.
pub fn write(cogno_home: &Path, port: u16, external_token: &str) -> io::Result<()> {
    fs::create_dir_all(cogno_home)?;
    let content = serde_json::json!({
        "port": port,
        "token": external_token,
        "pid": std::process::id(),
    })
    .to_string();
    let path = endpoint_path(cogno_home);
    fs::write(&path, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

/// Takes the endpoint file away: nothing listens any more. A missing file is fine.
pub fn remove(cogno_home: &Path) {
    let _ = fs::remove_file(endpoint_path(cogno_home));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_home() -> PathBuf {
        std::env::temp_dir().join(format!("cogno-endpoint-{}", uuid::Uuid::new_v4()))
    }

    #[test]
    fn writes_port_token_and_pid() {
        let home = temp_home();
        write(&home, 4321, "secret").unwrap();

        let endpoint: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(endpoint_path(&home)).unwrap()).unwrap();
        assert_eq!(endpoint["port"], 4321);
        assert_eq!(endpoint["token"], "secret");
        assert_eq!(endpoint["pid"], std::process::id());
        fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn removing_twice_is_fine() {
        let home = temp_home();
        write(&home, 1, "a").unwrap();
        remove(&home);
        remove(&home);
        assert!(!endpoint_path(&home).exists());
        fs::remove_dir_all(home).unwrap();
    }
}
