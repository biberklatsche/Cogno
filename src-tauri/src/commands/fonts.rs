use font_kit::source::SystemSource;
use serde::Serialize;
use std::collections::HashSet;

#[derive(Serialize)]
pub struct FontInfo {
    name: String,
    postscript: Option<String>,
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
                    let postscript = font.postscript_name();
                    fonts.push(FontInfo { name, postscript, is_monospace });
                }
            }
        }
    }
    fonts
}
