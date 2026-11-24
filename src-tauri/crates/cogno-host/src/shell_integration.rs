//! The shell integration scripts on this machine: what a shell started with
//! integration sources (`shell_spawner`). The scripts themselves come from
//! whoever talks to the host - they belong to its version of Cogno - and are
//! laid down under that version's integration root.

use std::path::{Component, Path, PathBuf};

use crate::protocol::{HostError, HostErrorCode, IntegrationFile};
use crate::shell_spawner::integration_root;

/// Written last: it says that every file of the version is in place.
const VERSION_FILE: &str = "VERSION";

/// Whether `version` names a version and nothing else.
fn is_version_name(version: &str) -> bool {
    !version.is_empty()
        && version != "."
        && version != ".."
        && version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '+' | '_'))
}

/// Where the scripts of `version` lie under the Cogno home `home`. The
/// version comes over the wire and becomes a directory name: it must be a
/// plain name.
pub(crate) fn root(home: &Path, version: &str) -> Result<PathBuf, HostError> {
    if !is_version_name(version) {
        return Err(HostError::new(
            HostErrorCode::InvalidRequest,
            format!("Not a version of the shell integration: {version:?}"),
        ));
    }
    Ok(integration_root(home, version))
}

/// Makes sure the scripts of `version` are in place under the Cogno home
/// `home`: written when one is missing, left alone otherwise.
pub(crate) fn install(
    home: &Path,
    version: &str,
    files: &[IntegrationFile],
) -> Result<(), HostError> {
    install_into(&root(home, version)?, version, files)?;
    remove_former_logs(home);
    Ok(())
}

/// Shell start-up logs used to pile up under the shell integration, one per
/// shell and never cleared; they now go to the app's log folder, at debug
/// level only. A Cogno before the versioned integration kept them here.
fn remove_former_logs(home: &Path) {
    // Gone after the first time; nothing to report then.
    let _ = std::fs::remove_dir_all(
        home.join(super::shell_spawner::INTEGRATION_DIRECTORY)
            .join("logs"),
    );
}

fn install_into(root: &Path, version: &str, files: &[IntegrationFile]) -> Result<(), HostError> {
    let targets = files
        .iter()
        .map(|file| Ok((target_of(root, &file.relative_path)?, &file.content)))
        .collect::<Result<Vec<_>, HostError>>()?;

    // A version on disk alone is no proof the scripts are there: one may have
    // been deleted, and a shell that starts without its script runs with no
    // integration at all.
    let installed = std::fs::read_to_string(root.join(VERSION_FILE))
        .is_ok_and(|installed| installed.trim() == version);
    if installed && targets.iter().all(|(target, _)| target.is_file()) {
        return Ok(());
    }

    let failed =
        |what: &Path, error: std::io::Error| HostError::io(&what.display().to_string(), error);
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
fn target_of(root: &Path, relative_path: &str) -> Result<PathBuf, HostError> {
    let path = Path::new(relative_path);
    let stays_below = !relative_path.is_empty()
        && !relative_path.contains('\\')
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)));
    if !stays_below {
        return Err(HostError::new(
            HostErrorCode::InvalidRequest,
            format!("Not a path below the shell integration: {relative_path:?}"),
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
        assert!(!root.join("logs").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn installing_removes_the_log_folder_of_a_cogno_before_versions() {
        let home = empty_root();
        let former_logs = home.join("shell-integration").join("logs");
        std::fs::create_dir_all(&former_logs).unwrap();
        std::fs::write(former_logs.join("shell-bootstrap-a.log"), "start").unwrap();

        install(
            &home,
            "1.3.1",
            &[file("bash/bootstrap.bash", "# bootstrap")],
        )
        .unwrap();

        assert!(!former_logs.exists());
        assert!(home
            .join("shell-integration")
            .join("1.3.1")
            .join("VERSION")
            .is_file());
        std::fs::remove_dir_all(home).unwrap();
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

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_version_must_be_a_plain_name() {
        for version in ["0.5.0", "1.2.3-beta.1", "2.0.0+build_7"] {
            assert!(is_version_name(version), "{version:?}");
        }
        for version in ["", ".", "..", "../x", "a/b", "a\\b", "1 2"] {
            assert!(!is_version_name(version), "{version:?}");
        }
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
