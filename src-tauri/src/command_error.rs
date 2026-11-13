//! How a command about hosts and their shells fails, as the webview receives
//! it: `{ "code": …, "message": … }`. The webview decides by the code alone;
//! the message is for people to read and never matched.

use std::fmt;

use cogno_host::protocol::{HostError, HostErrorCode};
use serde::Serialize;

/// What went wrong in this app, as opposed to on a host.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AppErrorCode {
    /// A start was not carried out: a shell already runs under the terminal
    /// id, and is left running. The caller attaches to it instead.
    ShellAlreadyRuns,
    /// The connection to the host broke while the request was on its way.
    ConnectionLost,
    /// There is no connection to the host the request is for.
    NotConnected,
    /// This machine's host could not be started or reached.
    HostNotStarted,
    /// No Cogno answered at the other end: the start command does not reach
    /// it (Cogno never ran there, or the shell there cannot run the command).
    NoCognoThere,
    /// The start command reached Cogno at the other end, but it does not run
    /// there.
    CognoNotRunning,
    /// The host speaks only protocol versions newer than this Cogno knows.
    ThisCognoTooOld,
    /// The host speaks only protocol versions older than this Cogno still
    /// speaks.
    HostTooOld,
    /// The connection could not be set up (ssh did not start, the host did
    /// not introduce itself).
    ConnectFailed,
    /// What names the other machine is not an ssh destination.
    InvalidDestination,
    /// The host answered with something the request does not expect.
    UnexpectedReply,
    /// This app failed in itself (a worker thread died).
    Internal,
}

/// A host's code, or this app's.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(untagged)]
pub enum ErrorCode {
    Host(HostErrorCode),
    App(AppErrorCode),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CommandError {
    pub code: ErrorCode,
    pub message: String,
}

impl CommandError {
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code: ErrorCode::App(code),
            message: message.into(),
        }
    }

    /// A worker thread of this app failed.
    pub fn internal(error: impl fmt::Display) -> Self {
        Self::new(AppErrorCode::Internal, error.to_string())
    }

    pub fn unexpected_reply() -> Self {
        Self::new(
            AppErrorCode::UnexpectedReply,
            "The host answered something else",
        )
    }

    pub fn connection_lost() -> Self {
        Self::new(
            AppErrorCode::ConnectionLost,
            "The connection to the host is lost",
        )
    }

    pub fn is(&self, code: AppErrorCode) -> bool {
        self.code == ErrorCode::App(code)
    }
}

impl From<HostError> for CommandError {
    fn from(error: HostError) -> Self {
        Self {
            code: ErrorCode::Host(error.code),
            message: error.message,
        }
    }
}

impl fmt::Display for CommandError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

pub type CommandResult<T> = Result<T, CommandError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_webview_gets_the_code_and_the_message() {
        let from_host = CommandError::from(HostError::session_not_found("t1"));
        assert_eq!(
            serde_json::to_value(&from_host).unwrap(),
            serde_json::json!({ "code": "sessionNotFound", "message": "No session runs under t1" })
        );
        let own = CommandError::new(AppErrorCode::ShellAlreadyRuns, "runs");
        assert_eq!(
            serde_json::to_value(&own).unwrap(),
            serde_json::json!({ "code": "shellAlreadyRuns", "message": "runs" })
        );
    }
}
