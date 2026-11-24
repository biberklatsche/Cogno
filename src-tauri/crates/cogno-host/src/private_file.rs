//! Files only their owner can read: the host's endpoint with its token,
//! and the app's pairing key and list of paired machines (ARCHITECTURE.md
//! 2.7.1, 2.7.3).

use std::io::{self, Write};
use std::path::Path;

/// Creates `path`, which must not exist yet, readable and writable by its
/// owner only. The file has its final permissions before anything is written.
#[cfg(unix)]
pub fn create(path: &Path) -> io::Result<std::fs::File> {
    use std::os::unix::fs::OpenOptionsExt;
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
}

/// On Windows a new file takes the permissions of its directory, and a
/// profile may let others read. The file gets a list of its own instead:
/// full access for its owner, nobody else, nothing inherited.
#[cfg(windows)]
pub fn create(path: &Path) -> io::Result<std::fs::File> {
    use std::os::windows::ffi::OsStrExt;
    use winapi::shared::sddl::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use winapi::um::securitybaseapi::SetFileSecurityW;
    use winapi::um::winbase::LocalFree;
    use winapi::um::winnt::{DACL_SECURITY_INFORMATION, PROTECTED_DACL_SECURITY_INFORMATION};

    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    let wide = |text: &std::ffi::OsStr| -> Vec<u16> { text.encode_wide().chain([0]).collect() };
    // D: a permission list; P: nothing inherited; one entry: allow (A) all
    // file access (FA) to the owner (OW).
    let owner_only = wide(std::ffi::OsStr::new("D:P(A;;FA;;;OW)"));
    let mut descriptor = std::ptr::null_mut();
    // SAFETY: both strings are NUL-terminated; `descriptor` is allocated by
    // the call and freed below.
    let applied = unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            owner_only.as_ptr(),
            SDDL_REVISION_1 as u32,
            &mut descriptor,
            std::ptr::null_mut(),
        ) != 0
            && SetFileSecurityW(
                wide(path.as_os_str()).as_ptr(),
                DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION,
                descriptor,
            ) != 0
    };
    let failure = io::Error::last_os_error();
    if !descriptor.is_null() {
        // SAFETY: allocated by the conversion above.
        unsafe { LocalFree(descriptor.cast()) };
    }
    if !applied {
        drop(file);
        let _ = std::fs::remove_file(path);
        return Err(failure);
    }
    Ok(file)
}

/// Replaces `path` with `content` at once: written to a file beside it that
/// only the owner can read, then moved over it. A reader never sees half a
/// file, and a crash leaves the old one.
pub fn write_atomically(path: &Path, content: &[u8]) -> io::Result<()> {
    if let Some(directory) = path.parent() {
        std::fs::create_dir_all(directory)?;
    }
    let mut beside = path.as_os_str().to_owned();
    beside.push(".new");
    let beside = std::path::PathBuf::from(beside);
    let _ = std::fs::remove_file(&beside);
    let written = create(&beside).and_then(|mut file| {
        file.write_all(content)?;
        file.sync_all()
    });
    if let Err(error) = written {
        let _ = std::fs::remove_file(&beside);
        return Err(error);
    }
    std::fs::rename(&beside, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir()
            .join(format!(
                "cogno-private-file-{}",
                uuid::Uuid::new_v4().simple()
            ))
            .join(name)
    }

    #[test]
    fn a_file_is_replaced_whole_and_nothing_is_left_beside_it() {
        let path = temp_path("paired.json");

        write_atomically(&path, b"first").unwrap();
        write_atomically(&path, b"second").unwrap();

        assert_eq!(std::fs::read(&path).unwrap(), b"second");
        let entries = std::fs::read_dir(path.parent().unwrap()).unwrap().count();
        assert_eq!(entries, 1);
    }

    #[cfg(unix)]
    #[test]
    fn only_the_owner_may_read_it() {
        use std::os::unix::fs::PermissionsExt;
        let path = temp_path("key");

        write_atomically(&path, b"secret").unwrap();

        let mode = std::fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}
