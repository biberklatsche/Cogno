//! Files in the Cogno home that only the user may read: the endpoint file
//! with its token, the index of sign-ins, git's config file.

use std::fs;
use std::io;
use std::path::Path;

/// Writes the file with user-only permissions and puts it in place in one
/// step: nobody reads half of it, and it never exists with wider permissions.
pub fn write(path: &Path, content: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let staged = path.with_extension("tmp");
    fs::write(&staged, content)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&staged, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(&staged, path)
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
        assert!(!path.with_extension("tmp").exists());
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
