/// The id of the active keyboard layout, in the form the OS names it: the KLID
/// on Windows ("00000407"), the xkb layout on Linux ("de", or "fr(dvorak)" with a
/// variant), the input source id
/// on macOS ("com.apple.keylayout.German"). The frontend looks its keymap up by
/// this id and falls back to a default keymap on `None`.
#[tauri::command]
pub fn get_keyboard_layout() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use winapi::um::winuser::GetKeyboardLayoutNameW;

        const KL_NAMELENGTH: usize = 9; // 8 chars + null
        let mut buf: [u16; KL_NAMELENGTH] = [0; KL_NAMELENGTH];
        let success = unsafe { GetKeyboardLayoutNameW(buf.as_mut_ptr()) };
        if success == 0 {
            return None;
        }
        let len = buf.iter().position(|&c| c == 0).unwrap_or(KL_NAMELENGTH);
        return Some(
            OsString::from_wide(&buf[..len])
                .to_string_lossy()
                .to_string(),
        );
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("setxkbmap")
            .arg("-query")
            .output()
            .ok()?;
        return layout_from_setxkbmap(&String::from_utf8_lossy(&output.stdout));
    }

    // The key holds the keyboard layout even while an input method (Japanese,
    // Pinyin, ...) is the selected input source.
    #[cfg(target_os = "macos")]
    {
        const KEY: &str = "AppleCurrentKeyboardLayoutInputSourceID";
        return read_hitoolbox(&["read", "com.apple.HIToolbox", KEY])
            .or_else(|| read_hitoolbox(&["-currentHost", "read", "com.apple.HIToolbox", KEY]));
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}

#[cfg(target_os = "macos")]
fn read_hitoolbox(args: &[&str]) -> Option<String> {
    let output = std::process::Command::new("/usr/bin/defaults")
        .args(args)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    layout_from_defaults(&String::from_utf8_lossy(&output.stdout))
}

/// The layout from `setxkbmap -query`, in xkb notation: "de", or "fr(dvorak)"
/// when it has a variant - Dvorak, Bépo and the like are variants of a layout,
/// not layouts of their own. Several layouts can be configured ("layout: us,de",
/// "variant: ,nodeadkeys"); the first one is the active group at startup.
#[cfg(any(target_os = "linux", test))]
fn layout_from_setxkbmap(query_output: &str) -> Option<String> {
    let first_of = |key: &str| {
        query_output
            .lines()
            .find_map(|line| line.trim().strip_prefix(key))
            .and_then(|values| values.split(',').next())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    };
    let layout = first_of("layout:")?;
    Some(match first_of("variant:") {
        Some(variant) => format!("{}({})", layout, variant),
        None => layout,
    })
}

/// The value `defaults read <domain> <key>` prints for a string: bare, or quoted
/// when it contains characters outside the plist-safe set.
#[cfg(any(target_os = "macos", test))]
fn layout_from_defaults(output: &str) -> Option<String> {
    let value = output.trim().trim_matches('"').trim();
    (!value.is_empty()).then(|| value.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setxkbmap_reports_the_layout() {
        let output = "rules:      evdev\nmodel:      pc105\nlayout:     de\n";

        assert_eq!(layout_from_setxkbmap(output), Some("de".to_string()));
    }

    #[test]
    fn setxkbmap_with_several_layouts_yields_the_first() {
        let output =
            "rules:      evdev\nmodel:      pc105\nlayout:     us,de\nvariant:    ,nodeadkeys\n";

        assert_eq!(layout_from_setxkbmap(output), Some("us".to_string()));
    }

    #[test]
    fn setxkbmap_reports_the_variant_with_the_layout() {
        let output = "rules:      evdev\nmodel:      pc105\nlayout:     fr\nvariant:    dvorak\n";

        assert_eq!(
            layout_from_setxkbmap(output),
            Some("fr(dvorak)".to_string())
        );
    }

    #[test]
    fn setxkbmap_pairs_the_first_layout_with_the_first_variant() {
        let output = "layout:     de,us\nvariant:    nodeadkeys,dvorak\n";

        assert_eq!(
            layout_from_setxkbmap(output),
            Some("de(nodeadkeys)".to_string())
        );
    }

    #[test]
    fn setxkbmap_tolerates_blank_lines() {
        let output = "\nrules:      evdev\n\nlayout:     fr\n";

        assert_eq!(layout_from_setxkbmap(output), Some("fr".to_string()));
    }

    #[test]
    fn setxkbmap_without_a_layout_yields_nothing() {
        assert_eq!(layout_from_setxkbmap("rules:      evdev\n"), None);
        assert_eq!(layout_from_setxkbmap("layout:\n"), None);
        assert_eq!(layout_from_setxkbmap(""), None);
    }

    #[test]
    fn defaults_prints_the_input_source_id_bare_or_quoted() {
        assert_eq!(
            layout_from_defaults("com.apple.keylayout.German\n"),
            Some("com.apple.keylayout.German".to_string())
        );
        assert_eq!(
            layout_from_defaults("\"com.apple.keylayout.USInternational-PC\"\n"),
            Some("com.apple.keylayout.USInternational-PC".to_string())
        );
    }

    #[test]
    fn defaults_without_a_value_yields_nothing() {
        assert_eq!(layout_from_defaults("\n"), None);
        assert_eq!(layout_from_defaults("\"\"\n"), None);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn reads_an_input_source_id_on_this_machine() {
        // Not every machine has the key set, but when it is, it is a reverse-DNS id.
        if let Some(id) = get_keyboard_layout() {
            assert!(id.contains('.'), "unexpected layout id: {id}");
        }
    }
}
