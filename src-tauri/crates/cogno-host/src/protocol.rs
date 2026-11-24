//! What a host is asked and what it reports: the one way in and out, for the
//! app on this machine as for one on another.
//!
//! Every type here is part of the wire format and is defined here, not
//! borrowed from the modules that do the work: changing those must never
//! change what goes over the wire by accident.
//!
//! The tagged enums carry an `Unknown` variant. A host and a client of
//! different versions talk to each other (`wire::check_versions`); whatever
//! one of them adds is `Unknown` to the other, never a broken connection.
//! Where a value of a later version cannot be `Unknown` (a shell type a
//! request must name exactly), the one message fails, not the connection
//! (`wire`).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// A terminal of the client that started the session: the session's id.
pub type TerminalId = String;

/// A window of the client: the app names its windows by their label.
pub type WindowLabel = String;

/// One attachment's output channel, chosen by the client: a session's output
/// comes back under it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StreamId(pub u64);

/// A question the host passed on to the client that is to answer it: the
/// answer names it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RelayId(pub u64);

/// What a coding agent's hook said, on its way to the Cogno that shows the
/// agent's terminal. The host keeps and passes it on; it never reads it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentHook {
    /// The terminal the agent runs in, when its hook knew it: an agent with a
    /// background service of its own may not.
    pub terminal_id: Option<TerminalId>,
    /// Which agent: the id of its adapter in the app.
    pub provider: String,
    /// The agent's name for what happened.
    pub event: String,
    /// When the hook ran, in milliseconds since the epoch.
    pub sent_at: u64,
    /// What the agent handed the hook, as the JSON text it was.
    pub payload: String,
}

#[cfg(test)]
impl AgentHook {
    /// A hook of `event`, from Codex, with an empty payload.
    pub fn of(terminal_id: Option<&str>, event: &str) -> Self {
        Self {
            terminal_id: terminal_id.map(str::to_string),
            provider: "codex".to_string(),
            event: event.to_string(),
            sent_at: 1,
            payload: "{}".to_string(),
        }
    }
}

/// Which client a process's question goes to (`Request::Ask`). The host
/// routes by it and nothing else: what is asked and answered is the
/// business of the process and that client.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Addressee {
    /// The client that shows the terminal.
    Terminal { terminal_id: TerminalId },
    /// The client that owns the prompt session (`Request::OwnPrompts`).
    PromptSession { session: String },
    /// An addressee of a later version.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TerminalSize {
    pub cols: u16,
    pub rows: u16,
}

/// The shells Cogno integrates with. The names are the ones the app's
/// profiles use.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ShellType {
    PowerShell,
    #[serde(rename = "ZSH")]
    Zsh,
    Bash,
}

impl fmt::Display for ShellType {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            ShellType::PowerShell => "PowerShell",
            ShellType::Zsh => "ZSH",
            ShellType::Bash => "Bash",
        };
        formatter.write_str(name)
    }
}

/// How a shell is started.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShellProfile {
    pub shell_type: ShellType,
    pub path: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub working_dir: Option<String>,
    pub enable_shell_integration: Option<bool>,
    #[serde(alias = "inject_path")]
    pub inject_cogno_cli: Option<bool>,
    pub load_user_rc: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub terminal_id: TerminalId,
    pub size: TerminalSize,
    pub profile: ShellProfile,
    /// The version of the shell integration the shell sources: the one the
    /// caller installed (`InstallShellIntegration`).
    pub integration_version: String,
}

/// Where a session sits in the Cogno it belongs to, in that Cogno's words.
/// The host only keeps it, for another client to find the session by.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionPlacement {
    pub workspace: Option<String>,
    pub tab: Option<String>,
    /// What the session's pane is called.
    pub title: Option<String>,
    /// Where its shell is.
    pub directory: Option<String>,
}

/// Which client a session is attached to, as the asking client sees it. A
/// client is a whole Cogno, all its windows: which window shows the session
/// is the client's to know.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "to", rename_all = "camelCase")]
pub enum Attached {
    Nowhere,
    /// To the client that asks.
    ThisClient,
    /// To another client, by the name it gave itself (`ClientHello::name`).
    OtherClient {
        by: Option<String>,
    },
    /// What a later version says and this one does not know.
    #[serde(other)]
    Unknown,
}

/// A running session, as a client needs it to find and attach to: where it
/// sits, the profile it was started with (its environment holds the
/// session's token) and its size.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub terminal_id: TerminalId,
    pub placement: SessionPlacement,
    pub profile: ShellProfile,
    pub size: TerminalSize,
    pub attached: Attached,
}

/// A shell installed on the host, offered as a profile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ShellInfo {
    pub name: String,
    pub path: String,
    pub shell_type: ShellType,
}

/// One file of the shell integration, as the client's version of Cogno has it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrationFile {
    /// Below the integration root, with `/` between its parts.
    pub relative_path: String,
    pub content: String,
}

/// The state a process is in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProcessStatus {
    Running,
    Sleeping,
    Idle,
    Stopped,
    Zombie,
    Dead,
    #[serde(other)]
    Other,
}

/// What the process panel shows about one process - nothing more, so a
/// snapshot does not read every process's environment or command line.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessDetails {
    pub process_id: u32,
    pub parent_process_id: Option<u32>,
    pub name: String,
    pub current_working_directory: Option<String>,
    pub status: ProcessStatus,
    pub run_time_seconds: u64,
    pub memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessTreeSnapshot {
    pub root_process_id: u32,
    pub root_process: ProcessDetails,
    pub descendants: Vec<ProcessDetails>,
}

/// A process under a terminal's shell: its name and working directory to
/// find candidates, the start time to tell two apart.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalProcess {
    pub terminal_id: TerminalId,
    pub name: String,
    pub current_working_directory: Option<String>,
    /// Unix seconds.
    pub started_at: u64,
}

/// What a client asks of a host.
///
/// A client waits for the reply to `PtySpawn` and `PtyAttach` before it sends
/// anything else about that terminal: requests that may block are answered
/// on threads of their own, so a later request can overtake them.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Request {
    /// Starts a shell, attached to the caller.
    PtySpawn {
        options: SpawnOptions,
        /// The caller's window the session belongs to and ends with.
        window: WindowLabel,
        stream: StreamId,
    },
    /// Attaches the caller to a running session: what was kept of its output
    /// comes under `stream`, then what the shell writes from now on. A client
    /// that showed it before gets `PtyTakenOver`. Answered with `Attached`.
    PtyAttach {
        terminal_id: TerminalId,
        /// As in `PtySpawn`: the session is this window's from now on.
        window: WindowLabel,
        stream: StreamId,
    },
    /// Detaches the caller from a session, which goes on.
    PtyDetach {
        terminal_id: TerminalId,
    },
    /// Says where a session sits in the caller's Cogno, for others to see.
    PtyPlace {
        terminal_id: TerminalId,
        placement: SessionPlacement,
    },
    PtyWrite {
        terminal_id: TerminalId,
        data: String,
    },
    PtyLineEditorAction {
        terminal_id: TerminalId,
        action: String,
        payload_json: Option<String>,
    },
    PtyResize {
        terminal_id: TerminalId,
        size: TerminalSize,
    },
    /// Ends a session on purpose. The caller hears no `PtyExit`; another
    /// client that shows it does.
    PtyKill {
        terminal_id: TerminalId,
    },
    /// Everything up to and including output `seq` of `stream` has been
    /// taken in. An ack of a stream that is no longer the session's (it was
    /// taken over, or attached again) changes nothing.
    PtyAck {
        terminal_id: TerminalId,
        stream: StreamId,
        seq: u32,
    },
    /// A window of the caller closed: the sessions it owns end, the ones it
    /// borrowed are let go.
    WindowClosed {
        window: WindowLabel,
    },
    /// The pane of the caller's `window` for a session is gone for good: the
    /// session ends if it belongs to that window, also while another machine
    /// shows it. The caller hears no `PtyExit`; whoever else shows it does.
    PaneClosed {
        terminal_id: TerminalId,
        window: WindowLabel,
    },
    /// The sessions that run on the host.
    ListSessions,
    /// The session `terminal_id`, as a client needs it before it attaches:
    /// its profile and token. Answered with `Session`, or `SessionNotFound`.
    GetSession {
        terminal_id: TerminalId,
    },
    ProcessTree {
        terminal_id: TerminalId,
    },
    /// The processes under every terminal's shell.
    TerminalProcesses,
    TerminateProcess {
        terminal_id: TerminalId,
        process_id: u32,
    },
    /// Ends what runs in the foreground of the terminal; the shell and its
    /// background jobs stay. On Windows everything under the shell ends.
    TerminateForegroundJob {
        terminal_id: TerminalId,
    },
    ListShells,
    /// Lays the shell integration scripts of `version` down, unless they are
    /// there already. Each version has its own place: a host serves Cognos
    /// of several versions, and the shells of one must not source the
    /// scripts of another.
    InstallShellIntegration {
        version: String,
        files: Vec<IntegrationFile>,
    },
    /// What an agent's hook said (a post): the session of its terminal keeps
    /// it for whoever attaches later, and the client that shows it gets it
    /// now. Without a terminal, every other client that shows a session
    /// gets it.
    AgentHook {
        hook: AgentHook,
    },
    /// A question for another client (a request): the host passes it on to
    /// `to` and answers with `Answered` once that client did. `NoAddressee`
    /// when nobody is there to answer, `NoAnswer` when the client went away
    /// first. `question` is JSON text the host never reads.
    Ask {
        to: Addressee,
        question: String,
    },
    /// The caller answers a question the host passed on to it (a post):
    /// JSON text the host never reads.
    Answer {
        relay: RelayId,
        answer: String,
    },
    /// The caller answers the prompts of `session` from now on (a post).
    OwnPrompts {
        session: String,
    },
    /// The caller answers the prompts of `session` no more (a post).
    DisownPrompts {
        session: String,
    },
    /// What a later version asks and this one does not know.
    #[serde(other)]
    Unknown,
}

impl Request {
    /// The terminal the request is about, if it is about one.
    pub fn terminal_id(&self) -> Option<&str> {
        match self {
            Request::PtySpawn { options, .. } => Some(&options.terminal_id),
            Request::PtyAttach { terminal_id, .. }
            | Request::PtyDetach { terminal_id }
            | Request::PtyPlace { terminal_id, .. }
            | Request::PtyWrite { terminal_id, .. }
            | Request::PtyLineEditorAction { terminal_id, .. }
            | Request::PtyResize { terminal_id, .. }
            | Request::PtyKill { terminal_id }
            | Request::PaneClosed { terminal_id, .. }
            | Request::PtyAck { terminal_id, .. }
            | Request::ProcessTree { terminal_id }
            | Request::TerminateProcess { terminal_id, .. }
            | Request::TerminateForegroundJob { terminal_id }
            | Request::GetSession { terminal_id } => Some(terminal_id),
            Request::WindowClosed { .. }
            | Request::ListSessions
            | Request::TerminalProcesses
            | Request::ListShells
            | Request::InstallShellIntegration { .. }
            | Request::AgentHook { .. }
            | Request::Ask { .. }
            | Request::Answer { .. }
            | Request::OwnPrompts { .. }
            | Request::DisownPrompts { .. }
            | Request::Unknown => None,
        }
    }

    /// Whether answering can take a while (starting a shell, closing a
    /// ConPTY, writing to a pipe a shell reads when it gets to it, walking
    /// the machine's processes).
    pub fn may_block(&self) -> bool {
        match self {
            Request::PtySpawn { .. }
            | Request::PtyAttach { .. }
            | Request::PtyKill { .. }
            | Request::PaneClosed { .. }
            | Request::PtyLineEditorAction { .. }
            | Request::ProcessTree { .. }
            | Request::TerminalProcesses
            | Request::TerminateProcess { .. }
            | Request::TerminateForegroundJob { .. }
            | Request::ListShells
            | Request::InstallShellIntegration { .. } => true,
            Request::PtyWrite { .. }
            | Request::PtyResize { .. }
            | Request::PtyAck { .. }
            | Request::PtyDetach { .. }
            | Request::PtyPlace { .. }
            | Request::WindowClosed { .. }
            | Request::ListSessions
            | Request::GetSession { .. }
            | Request::AgentHook { .. }
            | Request::Ask { .. }
            | Request::Answer { .. }
            | Request::OwnPrompts { .. }
            | Request::DisownPrompts { .. }
            | Request::Unknown => false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Response {
    Done,
    Spawned {
        shell_process_id: Option<u32>,
    },
    /// A `PtySpawn` was not carried out: a shell already runs under its
    /// terminal id, and is left running. The client attaches to it instead.
    ShellAlreadyRuns,
    /// The caller is attached; this is the session it is attached to.
    Attached {
        session: Box<SessionInfo>,
    },
    Sessions {
        sessions: Vec<SessionInfo>,
    },
    Session {
        session: Box<SessionInfo>,
    },
    ProcessTree {
        snapshot: Box<ProcessTreeSnapshot>,
    },
    TerminalProcesses {
        processes: Vec<TerminalProcess>,
    },
    Shells {
        shells: Vec<ShellInfo>,
    },
    /// What the client a question went to answered (`Request::Ask`).
    Answered {
        answer: String,
    },
    /// What a later version answers and this one does not know.
    #[serde(other)]
    Unknown,
}

/// Why a request failed. The message is for people to read; what a client
/// does about the failure depends on the code alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HostErrorCode {
    /// No session runs under the terminal id.
    SessionNotFound,
    /// The session is attached to another client: only that one types into
    /// it or sizes it.
    AttachedElsewhere,
    /// The session is ending.
    SessionClosing,
    /// The window the session was started for closed meanwhile.
    WindowClosed,
    /// The shell could not be started.
    SpawnFailed,
    /// The request names something that does not exist (a line editor
    /// action, a path outside the shell integration), or holds a value this
    /// host does not know (a later client's).
    InvalidRequest,
    /// The request is one this host does not know (a later client's).
    UnknownRequest,
    /// The session's shell takes no line editor actions.
    LineEditorUnavailable,
    /// No process runs under that id.
    ProcessNotFound,
    /// The process does not run under the terminal's shell.
    NotInTerminalTree,
    /// Unix only: the terminal has no foreground job to end.
    NoForegroundJob,
    /// Some processes did not end.
    ProcessesSurvived,
    /// Reading or writing failed on the host.
    Io,
    /// Nobody takes what was asked: no client shows the terminal, or owns
    /// the prompt session.
    NoAddressee,
    /// The client a question went to went away before it answered.
    NoAnswer,
    /// A code of a later version.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostError {
    pub code: HostErrorCode,
    pub message: String,
}

impl HostError {
    pub fn new(code: HostErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn session_not_found(terminal_id: &str) -> Self {
        Self::new(
            HostErrorCode::SessionNotFound,
            format!("No session runs under {terminal_id}"),
        )
    }

    pub fn io(context: &str, error: impl fmt::Display) -> Self {
        Self::new(HostErrorCode::Io, format!("{context}: {error}"))
    }
}

impl fmt::Display for HostError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for HostError {}

pub type Reply = Result<Response, HostError>;

/// Why a session ended.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ExitReason {
    /// The shell ended with this code.
    Exited { code: i32 },
    /// Another client ended it (`PtyKill`).
    KilledByAnotherClient,
    /// Reading or writing the PTY failed; the shell is ended with it.
    PtyFailed,
    /// A reason of a later version: the session ended all the same.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Event {
    /// Nothing more comes under this stream.
    PtyStreamEnded { stream: StreamId },
    /// Another client attached to the session: it runs on, shown elsewhere.
    PtyTakenOver {
        terminal_id: TerminalId,
        window: WindowLabel,
        /// What the client that shows it now is called, if it said.
        by: Option<String>,
    },
    /// The client that took a session over let it go, or is gone: nobody
    /// shows it now, and `window`, which showed it before, may again.
    PtyHandedBack {
        terminal_id: TerminalId,
        window: WindowLabel,
    },
    /// The session ended.
    PtyExit {
        terminal_id: TerminalId,
        window: WindowLabel,
        reason: ExitReason,
    },
    /// What an agent's hook said. `replayed`: it was kept, and comes now
    /// because the client attached - it is not news.
    AgentHook { hook: AgentHook, replayed: bool },
    /// A question for this client, as `to` named it; it answers with
    /// `Request::Answer` under `relay`.
    Asked {
        relay: RelayId,
        to: Addressee,
        question: String,
    },
    /// What a later version reports and this one does not know.
    #[serde(other)]
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The wire format of version 1, pinned: a change here breaks every
    /// Cogno already out there.
    #[test]
    fn the_wire_format_stays_as_released() {
        let request = Request::PtyResize {
            terminal_id: "t1".into(),
            size: TerminalSize { cols: 80, rows: 24 },
        };
        assert_eq!(
            serde_json::to_string(&request).unwrap(),
            r#"{"type":"ptyResize","terminal_id":"t1","size":{"cols":80,"rows":24}}"#
        );
        let reply: Reply = Err(HostError::session_not_found("t1"));
        assert_eq!(
            serde_json::to_string(&reply).unwrap(),
            r#"{"Err":{"code":"sessionNotFound","message":"No session runs under t1"}}"#
        );
        let event = Event::PtyExit {
            terminal_id: "t1".into(),
            window: "main".into(),
            reason: ExitReason::Exited { code: 0 },
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"type":"ptyExit","terminal_id":"t1","window":"main","reason":{"kind":"exited","code":0}}"#
        );
    }

    #[test]
    fn what_a_later_version_adds_is_unknown_not_an_error() {
        let request: Request =
            serde_json::from_str(r#"{"type":"ptyTeleport","terminal_id":"t1","to":"mars"}"#)
                .unwrap();
        assert!(matches!(request, Request::Unknown));
        let event: Event = serde_json::from_str(r#"{"type":"ptyRecolored","hue":3}"#).unwrap();
        assert!(matches!(event, Event::Unknown));
        let response: Response = serde_json::from_str(r#"{"type":"teleported"}"#).unwrap();
        assert!(matches!(response, Response::Unknown));
        let error: HostError =
            serde_json::from_str(r#"{"code":"outOfCoffee","message":"later"}"#).unwrap();
        assert_eq!(error.code, HostErrorCode::Unknown);
        let status: ProcessStatus = serde_json::from_str(r#""Hibernating""#).unwrap();
        assert_eq!(status, ProcessStatus::Other);
        let attached: Attached = serde_json::from_str(r#"{"to":"twoClients"}"#).unwrap();
        assert_eq!(attached, Attached::Unknown);
        let reason: ExitReason = serde_json::from_str(r#"{"kind":"evicted"}"#).unwrap();
        assert_eq!(reason, ExitReason::Unknown);
    }

    #[test]
    fn what_goes_from_process_to_cogno_has_these_names_on_the_wire() {
        let hook = AgentHook {
            terminal_id: Some("t1".into()),
            provider: "codex".into(),
            event: "Stop".into(),
            sent_at: 7,
            payload: "{}".into(),
        };
        assert_eq!(
            serde_json::to_string(&Request::AgentHook { hook: hook.clone() }).unwrap(),
            r#"{"type":"agentHook","hook":{"terminal_id":"t1","provider":"codex","event":"Stop","sent_at":7,"payload":"{}"}}"#
        );
        assert_eq!(
            serde_json::to_string(&Event::AgentHook {
                hook,
                replayed: true
            })
            .unwrap(),
            r#"{"type":"agentHook","hook":{"terminal_id":"t1","provider":"codex","event":"Stop","sent_at":7,"payload":"{}"},"replayed":true}"#
        );
        assert_eq!(
            serde_json::to_string(&Request::Ask {
                to: Addressee::Terminal {
                    terminal_id: "t1".into(),
                },
                question: "{}".into(),
            })
            .unwrap(),
            r#"{"type":"ask","to":{"type":"terminal","terminal_id":"t1"},"question":"{}"}"#
        );
        assert_eq!(
            serde_json::to_string(&Event::Asked {
                relay: RelayId(3),
                to: Addressee::PromptSession {
                    session: "s".into()
                },
                question: "{}".into(),
            })
            .unwrap(),
            r#"{"type":"asked","relay":3,"to":{"type":"promptSession","session":"s"},"question":"{}"}"#
        );
        assert_eq!(
            serde_json::to_string(&Request::Answer {
                relay: RelayId(3),
                answer: "null".into(),
            })
            .unwrap(),
            r#"{"type":"answer","relay":3,"answer":"null"}"#
        );
        assert_eq!(
            serde_json::to_string(&Response::Answered {
                answer: "null".into()
            })
            .unwrap(),
            r#"{"type":"answered","answer":"null"}"#
        );
        assert_eq!(
            serde_json::to_string(&Request::OwnPrompts {
                session: "s".into()
            })
            .unwrap(),
            r#"{"type":"ownPrompts","session":"s"}"#
        );
        assert_eq!(
            serde_json::to_string(&HostErrorCode::NoAddressee).unwrap(),
            r#""noAddressee""#
        );
        assert_eq!(
            serde_json::to_string(&HostErrorCode::NoAnswer).unwrap(),
            r#""noAnswer""#
        );
        let later: Addressee = serde_json::from_str(r#"{"type":"teleport"}"#).unwrap();
        assert_eq!(later, Addressee::Unknown);
    }

    #[test]
    fn whom_a_session_is_attached_to_is_said_from_the_asking_client() {
        assert_eq!(
            serde_json::to_string(&Attached::ThisClient).unwrap(),
            r#"{"to":"thisClient"}"#
        );
        assert_eq!(
            serde_json::to_string(&Attached::OtherClient {
                by: Some("laptop".into())
            })
            .unwrap(),
            r#"{"to":"otherClient","by":"laptop"}"#
        );
    }
}
