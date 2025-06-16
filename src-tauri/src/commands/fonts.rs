use font_kit::source::SystemSource;
use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct FontInfo {
    name: String,
    is_monospace: bool,
}

#[tauri::command]
pub fn list_fonts() -> Vec<FontInfo> {
    let source = SystemSource::new();
    let mut fonts = Vec::new();
    let mut seen = HashSet::new();

    if let Ok(handles) = source.all_fonts() {
        for handle in handles {
            if let Ok(font) = handle.load() {
                let name = font.family_name();
                if seen.insert(name.clone()) {
                    // nur wenn neu
                    let is_monospace = font.is_monospace();
                    fonts.push(FontInfo { name, is_monospace });
                }
            }
        }
    }
    fonts
}
