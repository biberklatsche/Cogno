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
    /// The user hung up on the machine while it was being connected.
    HungUp,
    /// There is no connection to the host the request is for.
    NotConnected,
    /// This machine's host could not be started or reached.
    HostNotStarted,
    /// What answered at the other end is no Cogno host.
    NoCognoThere,
    /// The host speaks only protocol versions newer than this Cogno knows.
    ThisCognoTooOld,
    /// The host speaks only protocol versions older than this Cogno still
    /// speaks.
    HostTooOld,
    /// The connection could not be set up (the machine was not reached, the
    /// host did not introduce itself).
    ConnectFailed,
    /// The host answered with something the request does not expect.
    UnexpectedReply,
    /// Pairing is off: the Remote feature is switched off.
    PairingOff,
    /// The other machine was not reached.
    PairingUnreachable,
    /// The pairing was not confirmed on both machines: the other machine
    /// does not pair now, a user declined or did not answer in time.
    PairingDeclined,
    /// The machine is not paired with this one (any more).
    NotPaired,
    /// What the user pasted to pair by is no machine's invitation.
    NoInvitation,
    /// A paired machine was given no name.
    NameMissing,
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
