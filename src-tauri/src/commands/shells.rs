//! The shells installed on this machine, offered as profiles on first start.

use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

#[derive(Serialize, Debug, PartialEq)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub shell_type: String,
}

/// One entry per shell binary: the same bash reached by two names is one shell.
#[derive(Default)]
struct Shells {
    seen: HashSet<String>,
    list: Vec<ShellInfo>,
}

impl Shells {
    fn add(&mut self, identity: String, name: &str, path: &str, shell_type: &str) {
        if self.seen.insert(identity) {
            self.list.push(ShellInfo {
                name: name.to_string(),
                path: path.to_string(),
                shell_type: shell_type.to_string(),
            });
        }
    }
}

/// Reads the disk and, on Windows, walks the PATH: off the thread that
/// drives the window.
#[tauri::command]
pub async fn list_shells() -> Vec<ShellInfo> {
    tauri::async_runtime::spawn_blocking(detect_shells)
        .await
        .unwrap_or_default()
}

#[cfg(windows)]
fn detect_shells() -> Vec<ShellInfo> {
    use which::which;

    let known_shells = [
        (
            "PowerShell",
            "powershell.exe",
            "PowerShell",
            [r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"].as_slice(),
        ),
        (
            "PowerShell Core",
            "pwsh.exe",
            "PowerShell",
            [
                r"C:\Program Files\PowerShell\7\pwsh.exe",
                r"C:\Program Files\PowerShell\6\pwsh.exe",
            ]
            .as_slice(),
        ),
    ];

    fn add(shells: &mut Shells, name: &str, path: &Path, shell_type: &str) {
        let rendered = path.display().to_string();
        shells.add(rendered.to_ascii_lowercase(), name, &rendered, shell_type);
    }

    let mut shells = Shells::default();
    for (name, binary, shell_type, fallback_paths) in known_shells {
        if let Ok(path) = which(binary) {
            add(&mut shells, name, &path, shell_type);
        }
        for fallback_path in fallback_paths {
            let path = Path::new(fallback_path);
            if path.is_file() {
                add(&mut shells, name, path, shell_type);
            }
        }
    }

    let install_roots: Vec<PathBuf> = [
        ("ProgramFiles", r"Git"),
        ("ProgramFiles(x86)", r"Git"),
        ("LOCALAPPDATA", r"Programs\Git"),
    ]
    .iter()
    .filter_map(|(variable, suffix)| {
        std::env::var_os(variable).map(|base| PathBuf::from(base).join(suffix))
    })
    .collect();
    if let Some(bash) = git_bash(which("git.exe").ok().as_deref(), &install_roots, |p| {
        p.is_file()
    }) {
        add(&mut shells, "Git Bash", &bash, "Bash");
    }

    shells.list
}

/// The bash Git for Windows brings, found from where `git.exe` is: the
/// installer puts `<root>\cmd` on the PATH, a user may point at
/// `<root>\mingw64\bin` or `<root>\bin` instead. The usual install roots
/// follow for a git that is not on the PATH. `<root>\bin\bash.exe` is the
/// launcher that sets the MSYS environment up (`usr\bin\bash.exe` is the
/// bare binary), and a root is Git's only with `git-bash.exe` in it: the
/// `bash.exe` in System32 is WSL's and must not pass as Git Bash.
#[cfg(any(windows, test))]
fn git_bash(
    git_exe: Option<&Path>,
    install_roots: &[PathBuf],
    exists: impl Fn(&Path) -> bool,
) -> Option<PathBuf> {
    let from_path = git_exe
        .into_iter()
        .flat_map(|exe| exe.ancestors().skip(1).take(3).map(Path::to_path_buf));
    from_path
        .chain(install_roots.iter().cloned())
        .filter(|root| exists(&root.join("git-bash.exe")))
        .map(|root| root.join("bin").join("bash.exe"))
        .find(|bash| exists(bash))
}

#[cfg(unix)]
fn detect_shells() -> Vec<ShellInfo> {
    let content = std::fs::read_to_string("/etc/shells").unwrap_or_default();
    shells_from_etc_shells(
        &content,
        |path| Path::new(path).is_file(),
        |path| std::fs::canonicalize(path).ok(),
    )
}

/// `/etc/shells` says what may serve as a login shell, not what is
/// installed: packages add their entry and leave it behind, images ship
/// the file ready-made. An entry with nothing at its path is no offer, and
/// two entries for one binary (`/bin/bash` and `/usr/bin/bash` on a merged
/// `/usr`) are one shell.
#[cfg(any(unix, test))]
fn shells_from_etc_shells(
    content: &str,
    is_file: impl Fn(&str) -> bool,
    canonical: impl Fn(&str) -> Option<PathBuf>,
) -> Vec<ShellInfo> {
    // "Bash" or "ZSH" (exactly as written), otherwise None
    fn detect_shell_label(path: &str) -> Option<&'static str> {
        let fname = Path::new(path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if fname == "bash" {
            return Some("Bash");
        }
        if fname == "zsh" {
            return Some("ZSH");
        }
        // Tolerant for variants like bash5, zsh-5.9
        if fname.contains("bash") {
            return Some("Bash");
        }
        if fname.contains("zsh") {
            return Some("ZSH");
        }
        None
    }

    let mut shells = Shells::default();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || !line.starts_with('/') {
            continue;
        }
        let Some(label) = detect_shell_label(line) else {
            continue;
        };
        if !is_file(line) {
            continue;
        }
        let identity = canonical(line)
            .map(|path| path.display().to_string())
            .unwrap_or_else(|| line.to_string());
        let name = Path::new(line)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(line);
        shells.add(identity, name, line, label);
    }
    shells.list
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shell(name: &str, path: &str, shell_type: &str) -> ShellInfo {
        ShellInfo {
            name: name.to_string(),
            path: path.to_string(),
            shell_type: shell_type.to_string(),
        }
    }

    #[test]
    fn an_etc_shells_entry_with_nothing_behind_it_is_not_offered() {
        let content = "# /etc/shells\n/bin/bash\n/usr/bin/zsh\n/usr/bin/fish\n/bin/csh\n";
        let shells = shells_from_etc_shells(
            content,
            |path| path == "/bin/bash" || path == "/usr/bin/fish",
            |path| Some(PathBuf::from(path)),
        );
        assert_eq!(shells, vec![shell("bash", "/bin/bash", "Bash")]);
    }

    #[test]
    fn one_binary_under_two_names_is_one_shell() {
        let content = "/bin/bash\n/usr/bin/bash\n/bin/zsh\n/usr/bin/zsh\n";
        let shells = shells_from_etc_shells(
            content,
            |_| true,
            // A merged /usr: /bin is /usr/bin.
            |path| Some(PathBuf::from(path.trim_start_matches("/usr"))),
        );
        assert_eq!(
            shells,
            vec![
                shell("bash", "/bin/bash", "Bash"),
                shell("zsh", "/bin/zsh", "ZSH"),
            ]
        );
    }

    #[test]
    fn git_bash_is_found_next_to_the_git_on_the_path() {
        let root = PathBuf::from("C:/arbeit/Git");
        let files: HashSet<PathBuf> =
            [root.join("git-bash.exe"), root.join("bin").join("bash.exe")]
                .into_iter()
                .collect();
        let found = git_bash(
            Some(&root.join("cmd").join("git.exe")),
            &[PathBuf::from("C:/Program Files/Git")],
            |path| files.contains(path),
        );
        assert_eq!(found, Some(root.join("bin").join("bash.exe")));

        let from_mingw = git_bash(
            Some(&root.join("mingw64").join("bin").join("git.exe")),
            &[],
            |path| files.contains(path),
        );
        assert_eq!(from_mingw, Some(root.join("bin").join("bash.exe")));
    }

    #[test]
    fn git_bash_falls_back_to_the_install_roots_and_needs_gits_root() {
        let root = PathBuf::from("C:/Program Files/Git");
        let files: HashSet<PathBuf> =
            [root.join("git-bash.exe"), root.join("bin").join("bash.exe")]
                .into_iter()
                .collect();
        let found = git_bash(None, std::slice::from_ref(&root), |path| {
            files.contains(path)
        });
        assert_eq!(found, Some(root.join("bin").join("bash.exe")));

        // A bash.exe under a directory that is not Git's (WSL's launcher in
        // System32, say) is not Git Bash.
        let stray = PathBuf::from("C:/Windows/System32");
        let stray_files: HashSet<PathBuf> =
            [stray.join("bin").join("bash.exe")].into_iter().collect();
        let none = git_bash(
            Some(&stray.join("git.exe")),
            std::slice::from_ref(&stray),
            |path| stray_files.contains(path),
        );
        assert_eq!(none, None);
    }
}
