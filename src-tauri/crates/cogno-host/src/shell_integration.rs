//! The shell integration scripts on this machine: what a shell started with
//! integration sources (`shell_spawner`). The scripts themselves come from
//! whoever talks to the host - they belong to its version of Cogno - and are
//! laid down under the integration root.

use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

use crate::shell_spawner::integration_root;

const VERSION_FILE: &str = "VERSION";
/// The integration writes its own logs here (`COGNO_LOG_DIR`).
const LOG_DIRECTORY: &str = "logs";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationFile {
    /// Below the integration root, with `/` between its parts.
    pub relative_path: String,
    pub content: String,
}

/// Makes sure the scripts of `version` are in place: written when the version
/// on disk is another one or a file is missing, left alone otherwise.
pub(crate) fn install(
    dev_mode: bool,
    version: &str,
    files: &[IntegrationFile],
) -> Result<(), String> {
    install_into(&integration_root(dev_mode)?, version, files)
}

fn install_into(root: &Path, version: &str, files: &[IntegrationFile]) -> Result<(), String> {
    let targets = files
        .iter()
        .map(|file| Ok((target_of(root, &file.relative_path)?, &file.content)))
        .collect::<Result<Vec<_>, String>>()?;

    // A current version alone is no proof the scripts are there: one may have
    // been deleted, and a shell that starts without its script runs with no
    // integration at all.
    let installed = std::fs::read_to_string(root.join(VERSION_FILE))
        .is_ok_and(|installed| installed.trim() == version);
    if installed && targets.iter().all(|(target, _)| target.is_file()) {
        return Ok(());
    }

    let failed = |what: &Path, error: std::io::Error| format!("{}: {error}", what.display());
    let log_directory = root.join(LOG_DIRECTORY);
    std::fs::create_dir_all(&log_directory).map_err(|error| failed(&log_directory, error))?;
    for (target, content) in &targets {
        if let Some(directory) = target.parent() {
            std::fs::create_dir_all(directory).map_err(|error| failed(directory, error))?;
        }
        std::fs::write(target, content).map_err(|error| failed(target, error))?;
    }
    // Last: a version on disk says every file before it was written.
    let version_file = root.join(VERSION_FILE);
    std::fs::write(&version_file, version).map_err(|error| failed(&version_file, error))
}

/// Where a file goes. Only below the root: the paths come over the wire, and
/// nothing they say may reach another place on this machine.
fn target_of(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    let stays_below = !relative_path.is_empty()
        && !relative_path.contains('\\')
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if !stays_below {
        return Err(format!(
            "Not a path below the shell integration: {relative_path:?}"
        ));
    }
    Ok(root.join(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn file(relative_path: &str, content: &str) -> IntegrationFile {
        IntegrationFile {
            relative_path: relative_path.to_string(),
            content: content.to_string(),
        }
    }

    fn empty_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "cogno-integration-test-{}",
            uuid::Uuid::new_v4().simple()
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn the_scripts_are_laid_down_with_their_version() {
        let root = empty_root();
        let files = [
            file("bash/bootstrap.bash", "# bootstrap"),
            file("zsh/.zshrc", "# zsh"),
        ];

        install_into(&root, "1.3.0", &files).unwrap();

        assert_eq!(
            std::fs::read_to_string(root.join("bash").join("bootstrap.bash")).unwrap(),
            "# bootstrap"
        );
        assert_eq!(
            std::fs::read_to_string(root.join("zsh").join(".zshrc")).unwrap(),
            "# zsh"
        );
        assert_eq!(
            std::fs::read_to_string(root.join("VERSION")).unwrap(),
            "1.3.0"
        );
        assert!(root.join("logs").is_dir());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn scripts_of_the_same_version_are_left_alone_unless_one_is_missing() {
        let root = empty_root();
        let script = root.join("bash").join("bootstrap.bash");
        install_into(&root, "1.3.0", &[file("bash/bootstrap.bash", "first")]).unwrap();

        // Same version: what is on disk stays, whatever is sent.
        install_into(&root, "1.3.0", &[file("bash/bootstrap.bash", "second")]).unwrap();
        assert_eq!(std::fs::read_to_string(&script).unwrap(), "first");

        // A missing script is written again.
        std::fs::remove_file(&script).unwrap();
        install_into(&root, "1.3.0", &[file("bash/bootstrap.bash", "second")]).unwrap();
        assert_eq!(std::fs::read_to_string(&script).unwrap(), "second");

        // Another version replaces the scripts.
        install_into(&root, "1.4.0", &[file("bash/bootstrap.bash", "third")]).unwrap();
        assert_eq!(std::fs::read_to_string(&script).unwrap(), "third");
        assert_eq!(
            std::fs::read_to_string(root.join("VERSION")).unwrap(),
            "1.4.0"
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_path_that_leaves_the_integration_root_is_refused_and_nothing_is_written() {
        let root = empty_root();
        for outside in [
            "../evil.sh",
            "bash/../../evil.sh",
            "/etc/profile.d/evil.sh",
            "C:\\Windows\\evil.ps1",
            "bash\\..\\..\\evil.sh",
            "",
        ] {
            let files = [file("bash/bootstrap.bash", "ok"), file(outside, "evil")];
            assert!(
                install_into(&root, "1.3.0", &files).is_err(),
                "{outside:?} was accepted"
            );
        }
        // Refused before the first write, the good file included.
        assert_eq!(std::fs::read_dir(&root).unwrap().count(), 0);
        std::fs::remove_dir_all(root).unwrap();
    }
}
