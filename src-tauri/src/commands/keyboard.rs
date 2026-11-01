/// The id of the active keyboard layout, in the form the OS names it: the KLID
/// on Windows ("00000407"), the xkb layout on Linux ("de", or "fr(dvorak)" with a
/// variant), the input source id
/// on macOS ("com.apple.keylayout.German"). The frontend looks its keymap up by
/// this id and falls back to a default keymap on `None`.
///
/// `GetKeyboardLayoutNameW` answers for the calling thread; a worker thread
/// would name the system default, so on Windows the command stays where it
/// is called.
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_keyboard_layout() -> Option<String> {
    detect_layout()
}

/// Linux and macOS ask child processes (`setxkbmap`, `gsettings`,
/// `defaults`, ...), which must not hold up the thread that drives the window.
#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn get_keyboard_layout() -> Option<String> {
    tauri::async_runtime::spawn_blocking(detect_layout)
        .await
        .ok()
        .flatten()
}

#[cfg(target_os = "windows")]
fn detect_layout() -> Option<String> {
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
    Some(
        OsString::from_wide(&buf[..len])
            .to_string_lossy()
            .to_string(),
    )
}

/// Whoever knows first: the X server (X11, and a Wayland session with
/// XWayland, whose layout the compositor keeps in step), then the desktop's
/// own settings on a Wayland session without one - GNOME's input sources,
/// Plasma's keyboard settings - and last the system-wide default that
/// systemd keeps, which is what a session has when nothing else chose.
#[cfg(target_os = "linux")]
fn detect_layout() -> Option<String> {
    setxkbmap_layout()
        .or_else(gnome_layout)
        .or_else(kde_layout)
        .or_else(localectl_layout)
}

/// The key holds the keyboard layout even while an input method (Japanese,
/// Pinyin, ...) is the selected input source.
#[cfg(target_os = "macos")]
fn detect_layout() -> Option<String> {
    const KEY: &str = "AppleCurrentKeyboardLayoutInputSourceID";
    read_hitoolbox(&["read", "com.apple.HIToolbox", KEY])
        .or_else(|| read_hitoolbox(&["-currentHost", "read", "com.apple.HIToolbox", KEY]))
}

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
fn detect_layout() -> Option<String> {
    None
}

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn command_output(program: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(target_os = "linux")]
fn setxkbmap_layout() -> Option<String> {
    layout_from_setxkbmap(&command_output("setxkbmap", &["-query"])?)
}

/// GNOME's input sources: `mru-sources` lists them most recently used first,
/// so the current one leads; it is empty until the user switched once, then
/// `sources` holds the configured order.
#[cfg(target_os = "linux")]
fn gnome_layout() -> Option<String> {
    ["mru-sources", "sources"].iter().find_map(|key| {
        layout_from_gnome_sources(&command_output(
            "gsettings",
            &["get", "org.gnome.desktop.input-sources", key],
        )?)
    })
}

/// Plasma's keyboard settings, `~/.config/kxkbrc`.
#[cfg(target_os = "linux")]
fn kde_layout() -> Option<String> {
    let config_home = std::env::var_os("XDG_CONFIG_HOME")
        .map(std::path::PathBuf::from)
        .or_else(|| dirs::home_dir().map(|home| home.join(".config")))?;
    layout_from_kxkbrc(&std::fs::read_to_string(config_home.join("kxkbrc")).ok()?)
}

#[cfg(target_os = "linux")]
fn localectl_layout() -> Option<String> {
    layout_from_localectl(&command_output("localectl", &["status"])?)
}

#[cfg(target_os = "macos")]
fn read_hitoolbox(args: &[&str]) -> Option<String> {
    layout_from_defaults(&command_output("/usr/bin/defaults", args)?)
}

/// The layout from `setxkbmap -query`, in xkb notation: "de", or "fr(dvorak)"
/// when it has a variant - Dvorak, Bépo and the like are variants of a layout,
/// not layouts of their own. Several layouts can be configured ("layout: us,de",
/// "variant: ,nodeadkeys"); the first one is the active group at startup.
#[cfg(any(target_os = "linux", test))]
fn layout_from_setxkbmap(query_output: &str) -> Option<String> {
    layout_from_key_lines(query_output, "layout:", "variant:")
}

/// `localectl status` prints the system-wide xkb setting as "X11 Layout: de"
/// and "X11 Variant: nodeadkeys", comma lists like setxkbmap.
#[cfg(any(target_os = "linux", test))]
fn layout_from_localectl(status_output: &str) -> Option<String> {
    layout_from_key_lines(status_output, "X11 Layout:", "X11 Variant:")
}

/// "<key> a,b" lines: the first layout, with the first variant when there is one.
#[cfg(any(target_os = "linux", test))]
fn layout_from_key_lines(output: &str, layout_key: &str, variant_key: &str) -> Option<String> {
    let first_of = |key: &str| {
        output
            .lines()
            .find_map(|line| line.trim().strip_prefix(key))
            .and_then(|values| values.split(',').next())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    };
    let layout = first_of(layout_key)?;
    Some(match first_of(variant_key) {
        Some(variant) => format!("{}({})", layout, variant),
        None => layout,
    })
}

/// `gsettings get org.gnome.desktop.input-sources <key>` prints a list of
/// tuples, `[('xkb', 'de'), ('xkb', 'us+dvorak')]`, or `@a(ss) []` when it is
/// empty. An input method (`('ibus', 'anthy')`) is no layout; the first xkb
/// entry counts. GNOME joins the variant with `+`, xkb notation brackets it.
#[cfg(any(target_os = "linux", test))]
fn layout_from_gnome_sources(output: &str) -> Option<String> {
    output.split('(').skip(1).find_map(|tuple| {
        let mut quoted = tuple.split('\'').skip(1).step_by(2);
        let kind = quoted.next()?;
        let id = quoted.next()?;
        (kind == "xkb" && !id.is_empty()).then(|| xkb_notation(id))
    })
}

/// Plasma's `kxkbrc`: under `[Layout]`, `LayoutList=de,us` and
/// `VariantList=nodeadkeys,` name the layouts, the first one active at login.
/// With `Use=false` Plasma leaves the layout to the system, and so does this.
#[cfg(any(target_os = "linux", test))]
fn layout_from_kxkbrc(content: &str) -> Option<String> {
    let mut in_layout_section = false;
    let mut layouts = None;
    let mut variants = None;
    for line in content.lines().map(str::trim) {
        if line.starts_with('[') {
            in_layout_section = line == "[Layout]";
            continue;
        }
        if !in_layout_section {
            continue;
        }
        if let Some((key, value)) = line.split_once('=') {
            match key.trim() {
                "Use" if value.trim() == "false" => return None,
                "LayoutList" => layouts = Some(value.trim().to_string()),
                "VariantList" => variants = Some(value.trim().to_string()),
                _ => {}
            }
        }
    }
    let first = |list: Option<String>| {
        list.and_then(|list| list.split(',').next().map(str::trim).map(str::to_string))
            .filter(|value| !value.is_empty())
    };
    let layout = first(layouts)?;
    Some(match first(variants) {
        Some(variant) => format!("{}({})", layout, variant),
        None => layout,
    })
}

/// "us+dvorak" as GNOME writes it -> "us(dvorak)".
#[cfg(any(target_os = "linux", test))]
fn xkb_notation(id: &str) -> String {
    match id.split_once('+') {
        Some((layout, variant)) => format!("{}({})", layout, variant),
        None => id.to_string(),
    }
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
    fn gnome_sources_yield_the_first_xkb_entry_in_xkb_notation() {
        assert_eq!(
            layout_from_gnome_sources("[('xkb', 'de'), ('xkb', 'us')]\n"),
            Some("de".to_string())
        );
        assert_eq!(
            layout_from_gnome_sources("[('ibus', 'anthy'), ('xkb', 'us+dvorak')]\n"),
            Some("us(dvorak)".to_string())
        );
    }

    #[test]
    fn gnome_sources_without_an_entry_yield_nothing() {
        assert_eq!(layout_from_gnome_sources("@a(ss) []\n"), None);
        assert_eq!(layout_from_gnome_sources("[('ibus', 'anthy')]\n"), None);
        assert_eq!(layout_from_gnome_sources(""), None);
    }

    #[test]
    fn kxkbrc_names_the_first_layout_with_its_variant() {
        let content = "[Layout]\nLayoutList=de,us\nUse=true\nVariantList=nodeadkeys,\n\n[Other]\nLayoutList=fr\n";

        assert_eq!(
            layout_from_kxkbrc(content),
            Some("de(nodeadkeys)".to_string())
        );
        assert_eq!(
            layout_from_kxkbrc("[Layout]\nLayoutList=fr\n"),
            Some("fr".to_string())
        );
    }

    #[test]
    fn kxkbrc_leaves_the_layout_to_the_system_when_plasma_does() {
        assert_eq!(
            layout_from_kxkbrc("[Layout]\nLayoutList=de\nUse=false\n"),
            None
        );
        assert_eq!(layout_from_kxkbrc("[Other]\nLayoutList=de\n"), None);
    }

    #[test]
    fn localectl_reports_the_x11_layout_and_variant() {
        let output = "   System Locale: LANG=de_DE.UTF-8\n       VC Keymap: de\n      X11 Layout: de\n     X11 Variant: nodeadkeys\n";

        assert_eq!(
            layout_from_localectl(output),
            Some("de(nodeadkeys)".to_string())
        );
        assert_eq!(
            layout_from_localectl("   System Locale: LANG=C.UTF-8\n       VC Keymap: (unset)\n"),
            None
        );
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
        if let Some(id) = detect_layout() {
            assert!(id.contains('.'), "unexpected layout id: {id}");
        }
    }
}
