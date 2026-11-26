//! How git learns of Cogno as its credential helper without the user's git
//! config ever being touched: a config file in the Cogno home that only this
//! module writes, and that the runner and every shell include through the
//! environment (`GIT_CONFIG_COUNT`, git 2.31 and later).
//!
//! The file names this binary as a helper for every host - git puts it behind
//! the user's own helpers - and as the only helper for each origin signed in
//! here. For those no other helper sees `get`, `store` or `erase`, so no copy
//! of the token ends up in a keychain helper that forgets when it runs out.

use std::io;
use std::path::{Path, PathBuf};

const FILE: &str = "git-credentials.gitconfig";
/// Names this binary to the helper line; a path in an environment variable
/// survives the translation into a WSL distro (`WSLENV` `/p`).
pub const HELPER_ENV: &str = "COGNO_GIT_CREDENTIAL";
/// What git appends its operation to: `cogno git-credential get`.
pub const SUBCOMMAND: &str = "git-credential";

pub fn path(cogno_home: &Path) -> PathBuf {
    cogno_home.join(FILE)
}

fn helper_line() -> String {
    // A leading `!` makes git run the rest with its shell, on Windows too.
    format!("\thelper = \"!\\\"${HELPER_ENV}\\\" {SUBCOMMAND}\"\n")
}

fn render(origins: &[String]) -> String {
    let mut content = String::from(
        "# Written by Cogno; changes are overwritten. See ARCHITECTURE.md, \"Anmeldungen\".\n[credential]\n",
    );
    content.push_str(&helper_line());
    for origin in origins {
        content.push_str(&format!("[credential \"{origin}\"]\n\thelper =\n"));
        content.push_str(&helper_line());
    }
    content
}

/// Rewrites the file for the origins signed in right now.
pub fn write(cogno_home: &Path, origins: &[String]) -> io::Result<()> {
    super::store::write_private(&path(cogno_home), &render(origins))
}

/// What a process Cogno starts needs in its environment for git to read the
/// file. `count` is the `GIT_CONFIG_COUNT` the process already gets, whose
/// entries stay in place. Empty when this binary cannot be named.
pub fn environment_for(app: &tauri::AppHandle, count: Option<&str>) -> Vec<(String, String)> {
    use tauri::Manager;

    let Ok(helper) = std::env::current_exe() else {
        return Vec::new();
    };
    environment(app.state::<super::SignIns>().cogno_home(), &helper, count)
}

fn environment(cogno_home: &Path, helper: &Path, count: Option<&str>) -> Vec<(String, String)> {
    let index = count
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    vec![
        (HELPER_ENV.to_string(), helper.display().to_string()),
        ("GIT_CONFIG_COUNT".to_string(), (index + 1).to_string()),
        (
            format!("GIT_CONFIG_KEY_{index}"),
            "include.path".to_string(),
        ),
        (
            format!("GIT_CONFIG_VALUE_{index}"),
            path(cogno_home).display().to_string(),
        ),
    ]
}

/// The same variables as a `WSLENV` list: paths are translated for the distro.
pub fn wslenv(environment: &[(String, String)]) -> Vec<String> {
    environment
        .iter()
        .map(|(key, _)| {
            if key == HELPER_ENV || key.starts_with("GIT_CONFIG_VALUE_") {
                format!("{key}/p")
            } else {
                key.clone()
            }
        })
        .collect()
}

/// The origin git asks for: scheme and host, with the port when there is one.
/// Only http and https have credential helpers; anything else is no origin.
pub fn origin_of(protocol: &str, host: &str) -> Option<String> {
    normalize_origin(&format!("{protocol}://{host}"))
}

/// An origin in the one spelling the index, the file and git's requests share.
pub fn normalize_origin(origin: &str) -> Option<String> {
    let url = reqwest::Url::parse(origin).ok()?;
    if !matches!(url.scheme(), "http" | "https") || !url.username().is_empty() {
        return None;
    }
    if url.path() != "/" || url.query().is_some() || url.fragment().is_some() {
        return None;
    }
    let host = url.host_str()?;
    Some(match url.port() {
        Some(port) => format!("{}://{host}:{port}", url.scheme()),
        None => format!("{}://{host}", url.scheme()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cogno_is_a_helper_for_all_hosts_and_the_only_one_for_signed_in_origins() {
        let content = render(&["https://gitlab.com".to_string()]);

        assert_eq!(
            content.lines().skip(1).collect::<Vec<_>>(),
            vec![
                "[credential]",
                "\thelper = \"!\\\"$COGNO_GIT_CREDENTIAL\\\" git-credential\"",
                "[credential \"https://gitlab.com\"]",
                "\thelper =",
                "\thelper = \"!\\\"$COGNO_GIT_CREDENTIAL\\\" git-credential\"",
            ]
        );
    }

    #[test]
    fn the_include_goes_behind_config_already_in_the_environment() {
        let home = Path::new("/home/me/.cogno");
        let exe = Path::new("/opt/Cogno/cogno");

        assert_eq!(
            environment(home, exe, None),
            vec![
                (
                    "COGNO_GIT_CREDENTIAL".to_string(),
                    "/opt/Cogno/cogno".to_string()
                ),
                ("GIT_CONFIG_COUNT".to_string(), "1".to_string()),
                ("GIT_CONFIG_KEY_0".to_string(), "include.path".to_string()),
                (
                    "GIT_CONFIG_VALUE_0".to_string(),
                    "/home/me/.cogno/git-credentials.gitconfig".to_string()
                ),
            ]
        );
        let after_two = environment(home, exe, Some("2"));
        assert_eq!(after_two[1].1, "3");
        assert_eq!(after_two[2].0, "GIT_CONFIG_KEY_2");
    }

    #[test]
    fn paths_are_translated_for_a_wsl_distro() {
        let shared = wslenv(&environment(
            Path::new("C:\\h"),
            Path::new("C:\\c.exe"),
            None,
        ));

        assert_eq!(
            shared,
            vec![
                "COGNO_GIT_CREDENTIAL/p",
                "GIT_CONFIG_COUNT",
                "GIT_CONFIG_KEY_0",
                "GIT_CONFIG_VALUE_0/p"
            ]
        );
    }

    #[test]
    fn an_origin_is_scheme_host_and_port_and_nothing_else() {
        assert_eq!(
            origin_of("https", "gitlab.com"),
            Some("https://gitlab.com".into())
        );
        assert_eq!(
            origin_of("https", "GitLab.com:8443"),
            Some("https://gitlab.com:8443".into())
        );
        assert_eq!(
            origin_of("https", "gitlab.com:443"),
            Some("https://gitlab.com".into())
        );
        assert_eq!(origin_of("ssh", "gitlab.com"), None);
        assert_eq!(normalize_origin("https://gitlab.com/group"), None);
        assert_eq!(normalize_origin("https://me@gitlab.com"), None);
        // Nothing that could break out of the section header in the file.
        assert_eq!(normalize_origin("https://a\"]\n[x"), None);
    }
}
