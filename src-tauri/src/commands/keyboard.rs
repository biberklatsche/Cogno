use serde::Serialize;
use tauri::command;

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
    pub id: String,    // KLID wie "00000407"
    pub name: String,  // Userfreundlicher Name (hier KLID als Fallback)
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

#[command]
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
        let klid = OsString::from_wide(&buf[..len]).to_string_lossy().to_string();
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

    // macOS: via defaults (als Platzhalter)
    #[cfg(target_os = "macos")]
    {
        // Für detailierte Infos wäre eine Cocoa/CF-API nötig
        // Hier nutzen wir defaults als einfache Lösung
        use std::process::Command;
        let output = Command::new("defaults")
            .arg("read")
            .arg("~/Library/Preferences/com.apple.HIToolbox")
            .output()
            .ok()?;
        let _ = String::from_utf8_lossy(&output.stdout);
        // Platzhalterwerte
        return Some(KeyboardLayoutInfo::Mac(MacKeyboardLayoutInfo {
            id: "com.apple.keylayout.US".to_string(),
            localized_name: "U.S.".to_string(),
            lang: "en".to_string(),
        }));
    }

    // Nur kompiliert, wenn keines der oben greift
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    None
}
