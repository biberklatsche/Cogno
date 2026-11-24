//! Processes Cogno starts in the background.

use std::process::Command;

/// Starts `command` without a console window of its own. A GUI app that
/// starts a console program on Windows otherwise flashes a window for it;
/// elsewhere there is nothing to do.
pub fn without_console_window(command: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}
