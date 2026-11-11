//! What a host is asked and what it reports: the one way in and out, whether
//! the host runs inside the app or somewhere else.

pub use crate::processes::{ProcessDetails, ProcessTreeSnapshot, TerminalProcess};
pub use crate::pty::{PtySpawnResult, SpawnOptions};
pub use crate::shell_spawner::ShellProfile;
pub use crate::shells::ShellInfo;
use serde::{Deserialize, Serialize};

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
    },
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
}

impl Request {
    /// Whether answering can take a while (starting a shell, closing a
    /// ConPTY, walking the machine's processes).
    pub fn may_block(&self) -> bool {
        match self {
            Request::PtySpawn { .. }
            | Request::PtyKill { .. }
            | Request::ProcessTree { .. }
            | Request::TerminalProcesses
            | Request::TerminateProcess { .. }
            | Request::ListShells => true,
            Request::PtyWrite { .. }
            | Request::PtyLineEditorAction { .. }
            | Request::PtyResize { .. }
            | Request::PtyAck { .. }
            | Request::ReleaseOwner { .. } => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Response {
    Done,
    Spawned(PtySpawnResult),
    ProcessTree(ProcessTreeSnapshot),
    TerminalProcesses(Vec<TerminalProcess>),
    Shells(Vec<ShellInfo>),
}

pub type Reply = Result<Response, String>;

#[derive(Debug, Serialize, Deserialize)]
pub enum Event {
    /// One framed chunk of a session's output (sequence number, then bytes).
    /// On the wire it is a binary frame of its own, never part of a message.
    #[serde(skip)]
    PtyData { stream: u64, frame: Vec<u8> },
    /// Nothing more comes under this stream.
    PtyStreamEnded { stream: u64 },
    /// The session ended on its own; a killed or replaced one reports nothing.
    PtyExit {
        terminal_id: String,
        owner: String,
        exit_code: i32,
    },
}
