use serde::Serialize;

#[derive(Serialize)]
#[serde(tag = "platform")]
pub enum KeyboardLayoutInfo {
    #[cfg(target_os = "windows")]
    Windows(WindowsKeyboardLayoutInfo),
    #[cfg(target_os = "linux")]
    Linux(LinuxKeyboardLayoutInfo),
    #[cfg(target_os = "macos")]
    Mac(MacKeyboardLayoutInfo),
}

#[derive(Serialize)]
pub struct WindowsKeyboardLayoutInfo {
    pub id: String,   // KLID wie "00000407"
    pub name: String, // Userfreundlicher Name (hier KLID als Fallback)
}

#[derive(Serialize)]
pub struct LinuxKeyboardLayoutInfo {
    pub model: String,
    pub layout: String,
    pub variant: String,
    pub options: String,
    pub rules: String,
}

#[derive(Serialize)]
pub struct MacKeyboardLayoutInfo {
    pub id: String,
    pub localized_name: String,
    pub lang: String,
}

#[tauri::command]
pub fn get_keyboard_layout() -> Option<KeyboardLayoutInfo> {
    // Windows: klassisch über WinAPI (GetKeyboardLayoutNameW)
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
        let klid = OsString::from_wide(&buf[..len])
            .to_string_lossy()
            .to_string();
        // Fallback: KLID als Name
        return Some(KeyboardLayoutInfo::Windows(WindowsKeyboardLayoutInfo {
            id: klid.clone(),
            name: klid,
        }));
    }

    // Linux: über setxkbmap -query
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let output = Command::new("setxkbmap").arg("-query").output().ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut model = String::new();
        let mut layout = String::new();
        let mut variant = String::new();
        let mut options = String::new();
        let mut rules = String::new();
        for line in stdout.lines() {
            let mut parts = line.split_whitespace();
            match parts.next()? {
                "model:" => model = parts.collect::<Vec<_>>().join(" "),
                "layout:" => layout = parts.collect::<Vec<_>>().join(" "),
                "variant:" => variant = parts.collect::<Vec<_>>().join(" "),
                "options:" => options = parts.collect::<Vec<_>>().join(" "),
                "rules:" => rules = parts.collect::<Vec<_>>().join(" "),
                _ => {}
            }
        }
        return Some(KeyboardLayoutInfo::Linux(LinuxKeyboardLayoutInfo {
            model,
            layout,
            variant,
            options,
            rules,
        }));
    }

    // macOS: hole aktuelle Eingabequelle aus com.apple.HIToolbox
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        #[cfg(debug_assertions)]
        fn dbg_log(label: &str, s: &str) {
            eprintln!("[keyboard macOS] {}: {}", label, s);
        }
        #[cfg(not(debug_assertions))]
        fn dbg_log(_label: &str, _s: &str) {}

        fn run_defaults(args: &[&str]) -> Option<String> {
            let out = Command::new("/usr/bin/defaults").args(args).output().ok()?;
            if !out.status.success() { return None; }
            let s = String::from_utf8_lossy(&out.stdout).to_string();
            if s.trim().is_empty() { None } else { Some(s) }
        }

        #[derive(Clone, Debug, Default)]
        struct MacSource {
            id: Option<String>,
            name: Option<String>,
            lang: Option<String>,
            kind: Option<String>,
        }

        fn trim_val(v: &str) -> String {
            v.trim().trim_end_matches(';').trim().trim_matches('"').to_string()
        }

        fn parse_dicts(text: &str) -> Vec<MacSource> {
            let mut res = Vec::new();
            let mut cur = MacSource::default();
            let mut in_dict = false;
            for line in text.lines() {
                let line = line.trim();
                if line.starts_with('{') {
                    in_dict = true;
                    cur = MacSource::default();
                    continue;
                }
                if !in_dict { continue; }
                if let Some(rest) = line.strip_prefix("InputSourceKind = ") {
                    cur.kind = Some(trim_val(rest));
                }
                if let Some(rest) = line.strip_prefix("InputSourceID = ") {
                    cur.id = Some(trim_val(rest));
                }
                if let Some(rest) = line.strip_prefix("KeyboardLayout Name = ") {
                    cur.name = Some(trim_val(rest));
                }
                if line.starts_with("languages = (") {
                    if let Some(open) = line.find('(') {
                        if let Some(close) = line.find(')') {
                            let inner = &line[open + 1..close];
                            let first = inner.split(',').next().unwrap_or("").trim();
                            let first = first.trim_matches('"');
                            if !first.is_empty() { cur.lang = Some(first.to_string()); }
                        }
                    }
                }
                if line.starts_with('}') {
                    // Fertiges Dict einsammeln
                    res.push(cur.clone());
                    in_dict = false;
                }
            }
            res
        }

        // 0) Direkter Schlüssel für aktives Layout (nur ID): AppleCurrentKeyboardLayoutInputSourceID
        let mut id: Option<String> = None;
        let mut name: Option<String> = None;
        let mut lang: Option<String> = None;

        let direct_id_std = run_defaults(&["read", "com.apple.HIToolbox", "AppleCurrentKeyboardLayoutInputSourceID"]);
        if let Some(txt) = direct_id_std.as_ref() { dbg_log("AppleCurrentKeyboardLayoutInputSourceID", txt); }
        if let Some(txt) = direct_id_std {
            id = Some(trim_val(&txt));
        } else {
            let direct_id_host = run_defaults(&["-currentHost", "read", "com.apple.HIToolbox", "AppleCurrentKeyboardLayoutInputSourceID"]);
            if let Some(txt) = direct_id_host.as_ref() { dbg_log("-currentHost AppleCurrentKeyboardLayoutInputSourceID", txt); }
            if let Some(txt) = direct_id_host { id = Some(trim_val(&txt)); }
        }

        // 1) AppleSelectedInputSources: versuche, eine Keyboard Layout Quelle zu finden
        let sel_std = run_defaults(&["read", "com.apple.HIToolbox", "AppleSelectedInputSources"]);
        if let Some(txt) = sel_std.as_ref() { dbg_log("AppleSelectedInputSources", txt); }
        let mut selected_sources: Option<Vec<MacSource>> = sel_std.as_ref().map(|s| parse_dicts(s));
        if selected_sources.is_none() {
            let sel_host = run_defaults(&["-currentHost", "read", "com.apple.HIToolbox", "AppleSelectedInputSources"]);
            if let Some(txt) = sel_host.as_ref() { dbg_log("-currentHost AppleSelectedInputSources", txt); }
            selected_sources = sel_host.map(|s| parse_dicts(&s));
        }
        if let Some(list) = &selected_sources {
            // Bevorzugt Keyboard Layout
            if let Some(ms) = list.iter().find(|m| m.kind.as_deref() == Some("Keyboard Layout")) {
                if id.is_none() { id = ms.id.clone(); }
                if name.is_none() { name = ms.name.clone(); }
                if lang.is_none() { lang = ms.lang.clone(); }
            } else if let Some(ms) = list.first() {
                // Falls nur Input Method, nimm deren ID (Name/Lang später über Enabled auflösen)
                if id.is_none() { id = ms.id.clone(); }
            }
        }

        // 2) AppleEnabledInputSources: benutze, um Name/Lang zu bestimmen oder als Fallback-Quelle
        let en_std = run_defaults(&["read", "com.apple.HIToolbox", "AppleEnabledInputSources"]);
        if let Some(txt) = en_std.as_ref() { dbg_log("AppleEnabledInputSources", txt); }
        let mut enabled_sources: Option<Vec<MacSource>> = en_std.as_ref().map(|s| parse_dicts(s));
        if enabled_sources.is_none() {
            let en_host = run_defaults(&["-currentHost", "read", "com.apple.HIToolbox", "AppleEnabledInputSources"]);
            if let Some(txt) = en_host.as_ref() { dbg_log("-currentHost AppleEnabledInputSources", txt); }
            enabled_sources = en_host.map(|s| parse_dicts(&s));
        }
        if let Some(list) = &enabled_sources {
            // Falls wir eine ID haben, versuche passenden Eintrag zu finden, um Name/Lang zu setzen
            if let Some(ref cur_id) = id {
                if let Some(ms) = list.iter().find(|m| m.id.as_deref() == Some(cur_id.as_str())) {
                    if name.is_none() { name = ms.name.clone(); }
                    if lang.is_none() { lang = ms.lang.clone(); }
                }
            }
            // Wenn immer noch keine ID, nimm erstes Keyboard Layout aus Enabled
            if id.is_none() {
                if let Some(ms) = list.iter().find(|m| m.kind.as_deref() == Some("Keyboard Layout")) {
                    id = ms.id.clone();
                    if name.is_none() { name = ms.name.clone(); }
                    if lang.is_none() { lang = ms.lang.clone(); }
                }
            }
        }

        // Fallbacks, wenn weiterhin nichts gefunden
        let id = id.unwrap_or_else(|| "com.apple.keylayout.US".to_string());
        let localized_name = name.unwrap_or_else(|| "U.S.".to_string());
        let lang = lang.unwrap_or_else(|| "en".to_string());

        return Some(KeyboardLayoutInfo::Mac(MacKeyboardLayoutInfo { id, localized_name, lang }));
    }

    // Nur kompiliert, wenn keines der oben greift
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}
