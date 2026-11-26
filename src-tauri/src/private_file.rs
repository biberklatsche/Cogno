//! Files in the Cogno home that only the user may read: the endpoint file
//! with its token, the index of sign-ins, git's config file.

use std::fs;
use std::io::{self, Write};
use std::path::Path;

/// Writes the file with user-only permissions and puts it in place in one
/// step: nobody reads half of it, and it never exists with wider permissions.
/// Each write stages under a name of its own, so two at once do not collide;
/// the one that renames last is the one that stays.
pub fn write(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    let staged = path.with_file_name(format!(".{name}.{}.tmp", uuid::Uuid::new_v4().simple()));
    let written = stage(&staged, content).and_then(|()| fs::rename(&staged, path));
    if written.is_err() {
        let _ = fs::remove_file(&staged);
    }
    written
}

fn stage(staged: &Path, content: &str) -> io::Result<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(staged)?;
    file.write_all(content.as_bytes())?;
    file.sync_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_the_file_and_leaves_nothing_staged() {
        let dir = std::env::temp_dir().join(format!("cogno-private-{}", uuid::Uuid::new_v4()));
        let path = dir.join("nested").join("file.json");

        write(&path, "first").unwrap();
        write(&path, "second").unwrap();

        assert_eq!(fs::read_to_string(&path).unwrap(), "second");
        let left: Vec<_> = fs::read_dir(path.parent().unwrap())
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        assert_eq!(left, vec![std::ffi::OsString::from("file.json")]);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::remove_dir_all(dir).unwrap();
    }
}
