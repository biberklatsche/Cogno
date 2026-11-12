//! What a host is asked and what it reports: the one way in and out, for the
//! app on this machine as for one on another.

pub use crate::processes::{ProcessDetails, ProcessTreeSnapshot, TerminalProcess};
pub use crate::pty::{PtySpawnResult, SpawnOptions};
pub use crate::shell_integration::IntegrationFile;
pub use crate::shell_spawner::ShellProfile;
pub use crate::shells::ShellInfo;
use serde::{Deserialize, Serialize};

/// Where a session sits in the Cogno it belongs to, in that Cogno's words.
/// The host only keeps it, for another client to find the session by.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLabel {
    pub workspace: Option<String>,
    pub tab: Option<String>,
    /// What the session's pane is called.
    pub title: Option<String>,
    /// Where its shell is.
    pub directory: Option<String>,
}

/// A running session, as a client needs it to find and attach to: where it
/// sits, the profile it was started with (its environment holds the
/// session's token) and its size.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub terminal_id: String,
    pub label: SessionLabel,
    pub profile: ShellProfile,
    pub cols: u16,
    pub rows: u16,
    /// Whether a client shows it right now.
    pub shown: bool,
    /// Whether that client is the one that asks.
    pub shown_here: bool,
    /// The name the client that shows it gave itself, if it gave one.
    pub shown_by: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Request {
    PtySpawn {
        options: SpawnOptions,
        /// Whom the session belongs to; `ReleaseOwner` ends all of one owner's
        /// sessions at once. The app names the window that spawned it.
        owner: String,
        /// Chosen by the caller: the session's output comes back under it.
        stream: u64,
        /// Set after the profile's own environment, so a profile cannot
        /// override it.
        env: Vec<(String, String)>,
        /// Whether the session goes on when its client is gone, for another
        /// client to attach to. Otherwise it ends with its client.
        survives_client: bool,
    },
    /// Shows a running session to the caller: what was kept of its output
    /// comes under `stream`, then what the shell writes from now on. A client
    /// that showed it before gets `PtyTakenOver`.
    PtyAttach {
        terminal_id: String,
        /// As in `PtySpawn`: the session is the caller's from now on.
        owner: String,
        stream: u64,
    },
    /// Stops showing a session, which goes on.
    PtyDetach {
        terminal_id: String,
    },
    /// Says where a session sits in the caller's Cogno, for others to see.
    PtyLabel {
        terminal_id: String,
        label: SessionLabel,
    },
    /// Says what the caller is called: the machine its Cogno runs on. Shown
    /// to a client whose session the caller shows.
    Introduce {
        name: String,
    },
    /// The sessions that run on the host.
    ListSessions,
    PtyWrite {
        terminal_id: String,
        data: String,
    },
    PtyLineEditorAction {
        terminal_id: String,
        action: String,
        payload_json: Option<String>,
    },
    PtyResize {
        terminal_id: String,
        cols: u16,
        rows: u16,
    },
    /// An intentional end: no `PtyExit` follows.
    PtyKill {
        terminal_id: String,
    },
    /// Everything up to and including `seq` has been parsed.
    PtyAck {
        terminal_id: String,
        seq: u32,
    },
    ReleaseOwner {
        owner: String,
    },
    ProcessTree {
        terminal_id: String,
    },
    /// The processes under every terminal's shell.
    TerminalProcesses,
    TerminateProcess {
        terminal_id: String,
        process_id: u32,
    },
    ListShells,
    /// Lays the shell integration scripts of `version` down, unless they are
    /// there already. `dev_mode` as in a spawn: which Cogno home is meant.
    InstallShellIntegration {
        dev_mode: bool,
        version: String,
        files: Vec<IntegrationFile>,
    },
}

impl Request {
    /// The terminal the request is about, if it is about one.
    pub fn terminal_id(&self) -> Option<&str> {
        match self {
            Request::PtySpawn { options, .. } => Some(&options.name),
            Request::PtyAttach { terminal_id, .. }
            | Request::PtyDetach { terminal_id }
            | Request::PtyLabel { terminal_id, .. }
            | Request::PtyWrite { terminal_id, .. }
            | Request::PtyLineEditorAction { terminal_id, .. }
            | Request::PtyResize { terminal_id, .. }
            | Request::PtyKill { terminal_id }
            | Request::PtyAck { terminal_id, .. }
            | Request::ProcessTree { terminal_id }
            | Request::TerminateProcess { terminal_id, .. } => Some(terminal_id),
            Request::ReleaseOwner { .. }
            | Request::Introduce { .. }
            | Request::ListSessions
            | Request::TerminalProcesses
            | Request::ListShells
            | Request::InstallShellIntegration { .. } => None,
        }
    }

    /// Whether answering can take a while (starting a shell, closing a
    /// ConPTY, walking the machine's processes).
    pub fn may_block(&self) -> bool {
        match self {
            Request::PtySpawn { .. }
            | Request::PtyAttach { .. }
            | Request::PtyKill { .. }
            | Request::ProcessTree { .. }
            | Request::TerminalProcesses
            | Request::TerminateProcess { .. }
            | Request::ListShells
            | Request::InstallShellIntegration { .. } => true,
            Request::PtyWrite { .. }
            | Request::PtyLineEditorAction { .. }
            | Request::PtyResize { .. }
            | Request::PtyAck { .. }
            | Request::PtyDetach { .. }
            | Request::PtyLabel { .. }
            | Request::Introduce { .. }
            | Request::ListSessions
            | Request::ReleaseOwner { .. } => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Done,
    Spawned(PtySpawnResult),
    Sessions(Vec<SessionInfo>),
    ProcessTree(ProcessTreeSnapshot),
    TerminalProcesses(Vec<TerminalProcess>),
    Shells(Vec<ShellInfo>),
}

pub type Reply = Result<Response, String>;

/// How a refused `PtySpawn` begins when a shell already runs under the
/// terminal id: the client attaches to that one instead. Clients match the
/// text, so it never changes.
pub const SHELL_ALREADY_RUNS: &str = "A shell already runs as terminal";

#[derive(Debug, Serialize, Deserialize)]
pub enum Event {
    /// One framed chunk of a session's output (sequence number, then bytes).
    /// On the wire it is a binary frame of its own, never part of a message.
    #[serde(skip)]
    PtyData { stream: u64, frame: Vec<u8> },
    /// Nothing more comes under this stream.
    PtyStreamEnded { stream: u64 },
    /// Another client attached to the session: it runs on, shown elsewhere.
    PtyTakenOver {
        terminal_id: String,
        owner: String,
        /// What the client that shows it now is called, if it said.
        by: Option<String>,
    },
    /// The client that took a session over let it go, or is gone: nobody
    /// shows it now, and `owner`, who showed it before, may again.
    PtyReleased { terminal_id: String, owner: String },
    /// The session ended: on its own, or ended by another client.
    PtyExit {
        terminal_id: String,
        owner: String,
        exit_code: i32,
    },
}
