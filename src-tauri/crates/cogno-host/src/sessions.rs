//! The sessions of a host: shells that run, by terminal id, and the requests
//! about them.
//!
//! Locks: the table first, then a session's own state (`SharedSession`),
//! never the other way round. Nothing that can block - closing a PTY,
//! writing to a pipe, sending to a client - happens under the table's lock.

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::{Arc, Mutex, MutexGuard};

use portable_pty::CommandBuilder;

use crate::attachment::{Attachment, Owner};
use crate::env_vars;
use crate::host::{Client, ClientId};
use crate::line_editor::LineEditorTarget;
use crate::protocol::{
    ExitReason, HostError, HostErrorCode, SessionInfo, SessionLifetime, SessionPlacement,
    SpawnOptions, StreamId, TerminalId, TerminalSize, WindowLabel,
};
use crate::shared_session::{Departure, Ended, Left, SharedSession};
use crate::shell_process::{ShellInput, ShellProcess, StartedShell};
use crate::shell_spawner::{PreparedSpawn, ShellSpawner};
use crate::sync::lock;

/// Size of a single PTY read. Under load the pipe hands over whatever is
/// buffered up to this size, so large reads coalesce output into few
/// messages without any extra batching thread.
const READ_BUF_SIZE: usize = 64 * 1024;
/// The user's home directory in a profile's working directory.
const HOME_PREFIX: &str = "~";

/// A session: its shell and what its threads share.
struct Session {
    shared: Arc<SharedSession>,
    shell: ShellProcess,
    line_editor: Option<LineEditorTarget>,
}

impl Session {
    /// Ends the session and its shell. Can block until the PTY is drained
    /// (closing a ConPTY): never call this while holding the table's lock.
    fn shut_down(self) -> Ended {
        let ended = self.shared.end();
        if let Some(line_editor) = &self.line_editor {
            line_editor.remove();
        }
        self.shell.shut_down();
        ended
    }
}

/// What a `PtySpawn` asks for, past the shell itself.
pub(crate) struct SpawnRequest {
    pub options: SpawnOptions,
    pub window: WindowLabel,
    pub stream: StreamId,
    /// Set after the profile's own environment, so a profile cannot
    /// override it.
    pub env: Vec<(String, String)>,
    pub lifetime: SessionLifetime,
}

/// What became of a spawn.
pub(crate) enum Spawned {
    Started {
        shell_process_id: Option<u32>,
    },
    /// A shell already runs under the terminal id: nothing was started, and
    /// that shell runs on.
    ShellAlreadyRuns,
}

/// What became of a session handed to the table.
enum Registered {
    Live,
    /// Its window or client left while the shell was starting: it comes back.
    OwnerGone(Session),
    /// Another shell runs under its id: it comes back, the other runs on.
    IdTaken(Session),
}

/// The live sessions and who has left, under one lock: a spawn and the
/// cleanup of its window decide in one order.
#[derive(Default)]
struct SessionTable {
    live: HashMap<TerminalId, Session>,
    /// Windows that closed. The app never names a window again once it
    /// closed, so this grows by one per closed window of a live client.
    gone_windows: HashSet<Owner>,
    /// Clients that are gone. Client ids are never used again, so a late
    /// spawn or attach of one is recognized by it.
    gone_clients: HashSet<ClientId>,
}

impl SessionTable {
    /// Registers a spawned session, unless its owner is gone (a late spawn
    /// from a closed window must never replace a reopened workspace's
    /// session) or a shell runs under its id: a running shell is never ended
    /// to make room.
    fn insert(&mut self, terminal_id: &TerminalId, owner: &Owner, session: Session) -> Registered {
        if self.is_gone(owner) {
            return Registered::OwnerGone(session);
        }
        if self.live.contains_key(terminal_id) {
            return Registered::IdTaken(session);
        }
        self.live.insert(terminal_id.clone(), session);
        Registered::Live
    }

    fn is_gone(&self, owner: &Owner) -> bool {
        self.gone_clients.contains(&owner.client) || self.gone_windows.contains(owner)
    }

    fn get(&self, terminal_id: &str) -> Result<&Session, HostError> {
        self.live
            .get(terminal_id)
            .ok_or_else(|| HostError::session_not_found(terminal_id))
    }

    /// The session `terminal_id`, if `client` is attached to it: only that
    /// one types into it or sizes it, also when another one's request crossed
    /// a takeover.
    fn attached_to(&self, client: ClientId, terminal_id: &str) -> Result<&Session, HostError> {
        let session = self.get(terminal_id)?;
        if session.shared.attached_client() != Some(client) {
            return Err(HostError::new(
                HostErrorCode::AttachedElsewhere,
                format!("The session {terminal_id} is shown by another client"),
            ));
        }
        Ok(session)
    }
}

type Table = Arc<Mutex<SessionTable>>;

/// What the threads of one session need to end it.
#[derive(Clone)]
struct SessionHandle {
    terminal_id: TerminalId,
    table: Table,
    shared: Arc<SharedSession>,
}

impl SessionHandle {
    /// Ends the session from whichever thread notices first: takes it out of
    /// the table (only if the id still belongs to this session), shuts it
    /// down and tells whoever shows it or waits for it. A session that is no
    /// longer in the table was ended on purpose, by whoever took it out.
    fn end(&self, reason: ExitReason) {
        let removed = {
            let mut table = lock(&self.table);
            match table.live.get(&self.terminal_id) {
                Some(session) if Arc::ptr_eq(&session.shared, &self.shared) => {
                    table.live.remove(&self.terminal_id)
                }
                _ => None,
            }
        };
        let Some(session) = removed else {
            return;
        };
        let ended = session.shut_down();
        tell_ended(&self.terminal_id, ended, reason, None);
    }
}

/// Tells whoever showed an ended session, except `not_told`, and whom it was
/// taken from, that it ended.
fn tell_ended(
    terminal_id: &TerminalId,
    ended: Ended,
    reason: ExitReason,
    not_told: Option<ClientId>,
) {
    if let Some(attachment) = ended.attachment {
        if Some(attachment.client) != not_told {
            attachment.tell_exit(terminal_id, &ended.window, reason);
        }
        attachment.end();
    }
    if let Some(taken_from) = ended.taken_from {
        taken_from.tell_exit(terminal_id, reason);
    }
}

#[derive(Default)]
pub(crate) struct Sessions {
    table: Table,
    /// Shut-downs of departed owners' sessions, on threads of their own;
    /// `shut_down_all` joins them before the process ends.
    shut_downs: Mutex<Vec<std::thread::JoinHandle<()>>>,
}

impl Sessions {
    fn table(&self) -> MutexGuard<'_, SessionTable> {
        lock(&self.table)
    }

    pub fn count(&self) -> usize {
        self.table().live.len()
    }

    /// Starts the shell of `request.options` in a PTY of its own, attached to
    /// `client`: its output goes there under `request.stream`, its end as
    /// `PtyExit`.
    pub fn spawn(
        &self,
        client: &Client,
        spawner: &ShellSpawner,
        request: SpawnRequest,
    ) -> Result<Spawned, HostError> {
        let SpawnRequest {
            options,
            window,
            stream,
            env,
            lifetime,
        } = request;
        let terminal_id = options.terminal_id.clone();
        // Checked again when the session is registered: two spawns of one id
        // may start at once.
        if self.table().live.contains_key(&terminal_id) {
            return Ok(Spawned::ShellAlreadyRuns);
        }

        let prepared = spawner.prepare_spawn(&options.profile)?;
        let line_editor = LineEditorTarget::for_shell(options.profile.shell_type, &prepared.env);
        let command = shell_command(prepared, line_editor.as_ref(), env, &terminal_id);
        let StartedShell {
            process,
            mut child,
            output,
            input,
        } = ShellProcess::start(command, options.size)?;
        let shell_process_id = process.pid();

        let owner = Owner {
            client: client.id,
            window,
        };
        let shared = SharedSession::new(
            options.profile,
            owner.clone(),
            lifetime,
            options.size,
            Some(Attachment::new(client, stream)),
        );
        let session = Session {
            shared: shared.clone(),
            shell: process,
            line_editor,
        };
        let abandoned = match self.table().insert(&terminal_id, &owner, session) {
            Registered::Live => None,
            Registered::OwnerGone(session) => Some(session),
            Registered::IdTaken(session) => {
                session.shut_down();
                return Ok(Spawned::ShellAlreadyRuns);
            }
        };

        let handle = SessionHandle {
            terminal_id: terminal_id.clone(),
            table: self.table.clone(),
            shared,
        };
        {
            let handle = handle.clone();
            input.spawn(move |error| {
                log::warn!(target: "pty", "write to PTY failed terminal_id={} error={error}", handle.terminal_id);
                handle.end(ExitReason::PtyFailed);
            });
        }
        {
            let handle = handle.clone();
            std::thread::spawn(move || {
                let reason = match child.wait() {
                    Ok(status) => ExitReason::Exited {
                        code: status.exit_code() as i32,
                    },
                    Err(_) => ExitReason::PtyFailed,
                };
                log::info!(
                    target: "pty",
                    "child process exited terminal_id={} shell_pid={shell_process_id:?} reason={reason:?}",
                    handle.terminal_id
                );
                // This also stops the reader, even if a grandchild still holds
                // the PTY and keeps producing output.
                handle.end(reason);
            });
        }
        std::thread::spawn(move || {
            pump_output(output, &handle.shared);
            // EOF or a read error: the PTY is unusable. If the session was
            // ended otherwise, it is no longer in the table and this is a no-op.
            handle.end(ExitReason::PtyFailed);
        });

        // The window or client left while the shell was being prepared. A
        // spawn that registered first is shut down by the departure instead.
        if let Some(session) = abandoned {
            // After the reader started: closing a ConPTY waits for its pipe.
            session.shut_down();
            return Err(HostError::new(
                HostErrorCode::WindowClosed,
                "The window closed while the shell was starting",
            ));
        }
        Ok(Spawned::Started { shell_process_id })
    }

    /// Attaches `client`'s `window` to a running session: it gets what was
    /// kept of the output under `stream`, then what comes. A client that
    /// showed the session before is told that it was taken over.
    pub fn attach(
        &self,
        client: &Client,
        terminal_id: &TerminalId,
        window: WindowLabel,
        stream: StreamId,
    ) -> Result<SessionInfo, HostError> {
        let shared = {
            let table = self.table();
            let owner = Owner {
                client: client.id,
                window: window.clone(),
            };
            // A client that left while this was on its way attaches nothing.
            if table.is_gone(&owner) {
                return Err(HostError::new(
                    HostErrorCode::WindowClosed,
                    "The window closed meanwhile",
                ));
            }
            table.get(terminal_id)?.shared.clone()
        };
        let attached = shared
            .attach(terminal_id, Attachment::new(client, stream), window)
            .ok_or_else(|| HostError::session_not_found(terminal_id))?;
        if let Some(previous) = attached.previous {
            previous.end();
            if attached.passed_on {
                previous.tell_taken_over(
                    terminal_id,
                    &attached.previous_owner.window,
                    client.name.clone(),
                );
            }
        }
        Ok(attached.info)
    }

    /// Detaches `client` from a session, which goes on without one. Whoever
    /// it was taken from is told that it is free again. A client that no
    /// longer shows it (another took it in the meantime) changes nothing.
    pub fn detach(&self, client: ClientId, terminal_id: &TerminalId) -> Result<(), HostError> {
        let shared = self.table().get(terminal_id)?.shared.clone();
        if let Some((attachment, taken_from)) = shared.detach(client) {
            attachment.end();
            if let Some(taken_from) = taken_from {
                taken_from.tell_handed_back(terminal_id);
            }
        }
        Ok(())
    }

    /// Notes where the session sits in the Cogno that shows it.
    pub fn place(
        &self,
        client: ClientId,
        terminal_id: &str,
        placement: SessionPlacement,
    ) -> Result<(), HostError> {
        self.table()
            .attached_to(client, terminal_id)?
            .shared
            .place(placement);
        Ok(())
    }

    /// The sessions that run, as `client` sees them.
    pub fn list(&self, client: ClientId) -> Vec<SessionInfo> {
        let table = self.table();
        let mut list: Vec<SessionInfo> = table
            .live
            .iter()
            .map(|(terminal_id, session)| session.shared.info(terminal_id, client))
            .collect();
        list.sort_by(|a, b| a.terminal_id.cmp(&b.terminal_id));
        list
    }

    /// The session `terminal_id`, as `client` sees it.
    pub fn get(
        &self,
        client: ClientId,
        terminal_id: &TerminalId,
    ) -> Result<SessionInfo, HostError> {
        Ok(self
            .table()
            .get(terminal_id)?
            .shared
            .info(terminal_id, client))
    }

    pub fn write(
        &self,
        client: ClientId,
        terminal_id: &str,
        data: String,
    ) -> Result<(), HostError> {
        self.table()
            .attached_to(client, terminal_id)?
            .shell
            .input()
            .queue(data.into_bytes())
    }

    /// Writing to the shell's line editor can block until the shell gets to
    /// it: never call this on a thread that must not block.
    pub fn execute_line_editor_action(
        &self,
        client: ClientId,
        terminal_id: &str,
        action: &str,
        payload_json: Option<&str>,
    ) -> Result<(), HostError> {
        // Copied out first: nothing may block while the table is locked.
        let (line_editor, input): (Option<LineEditorTarget>, ShellInput) = {
            let table = self.table();
            let session = table.attached_to(client, terminal_id)?;
            (session.line_editor.clone(), session.shell.input().clone())
        };
        let line_editor = line_editor.ok_or_else(|| {
            HostError::new(
                HostErrorCode::LineEditorUnavailable,
                format!("The shell of {terminal_id} takes no line editor actions"),
            )
        })?;
        line_editor.execute(action, payload_json, &input)
    }

    pub fn resize(
        &self,
        client: ClientId,
        terminal_id: &str,
        size: TerminalSize,
    ) -> Result<(), HostError> {
        let table = self.table();
        let session = table.attached_to(client, terminal_id)?;
        session.shell.resize(size)?;
        session.shared.resized(size);
        Ok(())
    }

    /// Ends the session at `client`'s request. The client that asked hears
    /// nothing; another one that shows the session, or waits for it to be
    /// let go, hears that it ended.
    ///
    /// Shutting a session down can block (closing a ConPTY waits for its
    /// output pipe): never call this on a thread that must not block.
    pub fn kill(&self, client: ClientId, terminal_id: &TerminalId) -> Result<(), HostError> {
        let session = self
            .table()
            .live
            .remove(terminal_id)
            .ok_or_else(|| HostError::session_not_found(terminal_id))?;
        let ended = session.shut_down();
        tell_ended(
            terminal_id,
            ended,
            ExitReason::KilledByAnotherClient,
            Some(client),
        );
        Ok(())
    }

    /// The client's acknowledgement that it has taken in every piece of
    /// output up to and including `seq`. Acks for sessions that already
    /// ended are expected (output was still on its way) and accepted.
    pub fn acknowledge(&self, client: ClientId, terminal_id: &str, seq: u32) {
        let shared = self
            .table()
            .live
            .get(terminal_id)
            .map(|session| session.shared.clone());
        if let Some(shared) = shared {
            shared.acknowledge(client, seq);
        }
    }

    /// A window or a client leaves. Its sessions that go on without one are
    /// left running with nobody attached; the others end with it, shut down
    /// on a thread of their own: closing a ConPTY can block until its output
    /// is drained, and the others must not wait for that. The shut-down never
    /// looks ids up again, so a reopened workspace cannot lose its new shells.
    pub fn depart(&self, departure: Departure) {
        let (ended, left) = {
            let mut table = self.table();
            // Gone for good: a spawn or attach of it that has not registered
            // yet never will.
            match &departure {
                Departure::Window(owner) => {
                    table.gone_windows.insert(owner.clone());
                }
                Departure::Client(client) => {
                    table.gone_clients.insert(*client);
                    table.gone_windows.retain(|owner| owner.client != *client);
                }
            }
            let mut ended = Vec::new();
            let mut left = Vec::new();
            let decisions: Vec<(TerminalId, Left)> = table
                .live
                .iter()
                .map(|(terminal_id, session)| {
                    (terminal_id.clone(), session.shared.depart(&departure))
                })
                .collect();
            for (terminal_id, decision) in decisions {
                match decision {
                    Left::Untouched => {}
                    Left::Ends => ended.extend(table.live.remove(&terminal_id)),
                    Left::RunsOn {
                        attachment,
                        taken_from,
                    } => left.push((terminal_id, attachment, taken_from)),
                }
            }
            (ended, left)
        };
        for (terminal_id, attachment, taken_from) in left {
            if let Some(attachment) = attachment {
                attachment.end();
            }
            if let Some(taken_from) = taken_from {
                taken_from.tell_handed_back(&terminal_id);
            }
        }
        self.shut_down_apart(ended);
    }

    fn shut_down_apart(&self, sessions: Vec<Session>) {
        if sessions.is_empty() {
            return;
        }
        let shut_down = std::thread::spawn(move || {
            for session in sessions {
                // The owner is gone: nobody to tell but the stream's end.
                if let Some(attachment) = session.shut_down().attachment {
                    attachment.end();
                }
            }
        });
        let mut shut_downs = lock(&self.shut_downs);
        shut_downs.retain(|shut_down| !shut_down.is_finished());
        shut_downs.push(shut_down);
    }

    /// Ends every shell, so no shell (or, on Windows, grandchild) is left
    /// running after the daemon is gone.
    pub fn shut_down_all(&self) {
        // A departure just before the exit may still be shutting down.
        let shut_downs = std::mem::take(&mut *lock(&self.shut_downs));
        for shut_down in shut_downs {
            let _ = shut_down.join();
        }
        let sessions: Vec<Session> = self
            .table()
            .live
            .drain()
            .map(|(_, session)| session)
            .collect();
        for session in sessions {
            session.shut_down();
        }
    }

    pub fn shell_process_id(&self, terminal_id: &str) -> Result<u32, HostError> {
        self.table().get(terminal_id)?.shell.pid().ok_or_else(|| {
            HostError::new(
                HostErrorCode::ProcessNotFound,
                format!("The shell of {terminal_id} has no process id"),
            )
        })
    }

    /// The process group in the foreground of the terminal.
    #[cfg(unix)]
    pub fn foreground_process_group(&self, terminal_id: &str) -> Result<i32, HostError> {
        self.table()
            .get(terminal_id)?
            .shell
            .foreground_process_group()
            .ok_or_else(|| {
                HostError::new(
                    HostErrorCode::NoForegroundJob,
                    format!("No foreground job known for {terminal_id}"),
                )
            })
    }

    /// Every session's shell process, for one pass over the machine's processes.
    pub fn shell_process_ids(&self) -> Vec<(TerminalId, u32)> {
        self.table()
            .live
            .iter()
            .filter_map(|(terminal_id, session)| {
                session.shell.pid().map(|pid| (terminal_id.clone(), pid))
            })
            .collect()
    }

    /// The window the terminal belongs to.
    #[cfg(test)]
    pub fn owner_of(&self, terminal_id: &str) -> Option<Owner> {
        self.table()
            .live
            .get(terminal_id)
            .map(|session| session.shared.owner())
    }
}

/// The command a prepared spawn starts, with what the session adds to its
/// environment after the profile's own: a profile overrides neither what
/// the caller adds nor the terminal id.
fn shell_command(
    prepared: PreparedSpawn,
    line_editor: Option<&LineEditorTarget>,
    extra_env: Vec<(String, String)>,
    terminal_id: &TerminalId,
) -> CommandBuilder {
    let mut command = CommandBuilder::new(&prepared.program);
    command.args(&prepared.args);
    for (key, value) in prepared.env {
        command.env(key, value);
    }
    if let Some((name, path)) = line_editor.and_then(LineEditorTarget::env) {
        command.env(name, path.as_os_str());
    }
    for (key, value) in extra_env {
        command.env(key, value);
    }
    command.env(env_vars::COGNO_TERMINAL_ID, terminal_id);
    command.cwd(expand_home(&prepared.working_dir));
    command
}

/// `~` and `~/...` (or `~\...`) below the user's home directory. Another
/// user's home (`~bob`) is not expanded.
fn expand_home(directory: &str) -> String {
    let Some(rest) = directory.strip_prefix(HOME_PREFIX) else {
        return directory.to_string();
    };
    let below_home = rest.is_empty() || rest.starts_with('/') || rest.starts_with('\\');
    match dirs::home_dir() {
        Some(home) if below_home => format!("{}{rest}", home.to_string_lossy()),
        _ => directory.to_string(),
    }
}

/// Reads PTY output until the PTY ends: keeps it, and sends it to the client
/// that shows the session, waiting for that client when it is behind. Without
/// a client nothing waits; the shell runs on and the output is only kept.
///
/// Once the session has ended nothing is kept or sent any more, but reading
/// goes on until the PTY ends: a reader that stops while the pipe is full
/// leaves the shell blocked on its write, and before Windows 11 24H2
/// `ClosePseudoConsole` then waits for that pipe forever.
fn pump_output(mut reader: Box<dyn Read + Send>, shared: &SharedSession) {
    // Raw bytes go straight to the client's terminal, whose UTF-8 decoder is
    // stateful across writes; splitting a multi-byte sequence is fine.
    let mut buffer = vec![0u8; READ_BUF_SIZE];
    loop {
        let read = match reader.read(&mut buffer) {
            Ok(0) | Err(_) => break,
            Ok(read) => read,
        };
        if shared.is_closed() {
            continue;
        }
        let Some(attachment) = shared.take_in(&buffer[..read]) else {
            continue;
        };
        if !attachment.send(&buffer[..read]) {
            // Detached, taken over, or its client is gone. The piece is
            // kept, so whoever attaches next gets it.
            shared.forget(&attachment);
        }
    }
}

/// Spare parts for the tests of the sessions and the host.
#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use crate::host::EventSink;
    use crate::protocol::{Event, ShellProfile, ShellType};
    use crate::wire::Output;
    use std::num::NonZeroU64;
    use std::time::{Duration, Instant};

    pub struct TakesEverything;
    impl EventSink for TakesEverything {
        fn event(&self, _event: Event) -> bool {
            true
        }
        fn output(&self, _output: Output) -> bool {
            true
        }
    }

    pub fn client_id(id: u64) -> ClientId {
        ClientId(NonZeroU64::new(id).expect("client ids start at 1"))
    }

    /// Client `id`, which takes everything and acknowledges nothing.
    pub fn client(id: u64) -> Client {
        Client {
            id: client_id(id),
            name: None,
            sink: Arc::new(TakesEverything),
        }
    }

    pub fn owner(window: &str) -> Owner {
        Owner {
            client: client_id(1),
            window: window.to_string(),
        }
    }

    pub fn profile(shell_type: ShellType) -> ShellProfile {
        ShellProfile {
            shell_type,
            path: None,
            args: None,
            env: None,
            working_dir: None,
            enable_shell_integration: None,
            inject_cogno_cli: None,
            load_user_rc: None,
        }
    }

    pub const SIZE: TerminalSize = TerminalSize { cols: 80, rows: 24 };

    /// A session shared with client 1 attached.
    pub fn attached_session(flow: crate::flow_control::FlowControl) -> Arc<SharedSession> {
        SharedSession::new(
            profile(ShellType::Bash),
            owner("test"),
            SessionLifetime::EndsWithClient,
            SIZE,
            Some(Attachment::with_flow(&client(1), StreamId(0), flow)),
        )
    }

    pub fn wait_until(limit: Duration, mut condition: impl FnMut() -> bool) -> bool {
        let started = Instant::now();
        while started.elapsed() < limit {
            if condition() {
                return true;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        condition()
    }

    pub fn assert_finishes(handle: std::thread::JoinHandle<()>, what: &str) {
        assert!(
            wait_until(Duration::from_secs(15), || handle.is_finished()),
            "{what} is still running after 15 s"
        );
        handle.join().unwrap();
    }

    /// A shell that runs, of window `window`, put into `sessions` under
    /// `terminal_id` as a spawn leaves it, with the thread reading its output.
    /// On Windows it is the hard case: output nobody takes in, the pipe full.
    pub fn live_session(
        sessions: &Sessions,
        terminal_id: &str,
        window: &str,
    ) -> (Arc<SharedSession>, std::thread::JoinHandle<()>) {
        #[cfg(unix)]
        let (command, flow) = {
            let mut command = CommandBuilder::new("sh");
            command.arg("-i");
            command.env("PS1", "$ ");
            (command, crate::flow_control::FlowControl::new())
        };
        #[cfg(windows)]
        let (command, flow) = stalling_command(200_000);
        let (shared, reader, session) = started_session(command, flow, window);
        let owner = owner(window);
        assert!(matches!(
            sessions
                .table()
                .insert(&terminal_id.to_string(), &owner, session),
            Registered::Live
        ));
        (shared, reader)
    }

    /// Windows: `cmd` printing `lines` lines with a reader that stalls on tiny
    /// watermarks, nothing acknowledged.
    #[cfg(windows)]
    pub fn stalling_command(lines: u32) -> (CommandBuilder, crate::flow_control::FlowControl) {
        let mut command = CommandBuilder::new("cmd");
        command.args([
            "/C",
            &format!("for /L %i in (1,1,{lines}) do @echo line %i"),
        ]);
        (
            command,
            crate::flow_control::FlowControl::with_watermarks(4 * STALL_UNIT, STALL_UNIT),
        )
    }

    /// What the stalling reader's watermarks are made of.
    #[cfg(windows)]
    pub const STALL_UNIT: usize = 900;

    /// A session of `window` running `command`, its reader started.
    pub(super) fn started_session(
        command: CommandBuilder,
        flow: crate::flow_control::FlowControl,
        window: &str,
    ) -> (Arc<SharedSession>, std::thread::JoinHandle<()>, Session) {
        let StartedShell {
            process,
            output,
            input,
            ..
        } = ShellProcess::start(command, SIZE).unwrap();
        // As in a spawn: a PTY whose input is closed stops talking (ConPTY).
        input.spawn(|_| {});
        let shared = SharedSession::new(
            profile(ShellType::Bash),
            owner(window),
            SessionLifetime::EndsWithClient,
            SIZE,
            Some(Attachment::with_flow(&client(1), StreamId(0), flow)),
        );
        let reader = {
            let shared = shared.clone();
            std::thread::spawn(move || pump_output(output, &shared))
        };
        let session = Session {
            shared: shared.clone(),
            shell: process,
            line_editor: None,
        };
        (shared, reader, session)
    }
}

/// A window's sessions: who they belong to, and what its closing takes along.
#[cfg(test)]
mod window_tests {
    use super::test_support::{assert_finishes, client_id, live_session, owner, started_session};
    use super::*;

    #[test]
    fn a_terminal_names_the_window_that_spawned_it_until_it_is_gone() {
        let sessions = Sessions::default();
        let (_shared, reader) = live_session(&sessions, "t1", "test");

        assert_eq!(sessions.owner_of("t1"), Some(owner("test")));
        assert_eq!(sessions.owner_of("unknown"), None);

        sessions.shut_down_all();
        assert_finishes(reader, "reader");
        assert_eq!(sessions.owner_of("t1"), None);
    }

    #[test]
    fn closing_a_window_ends_its_sessions_and_leaves_the_others() {
        let sessions = Sessions::default();
        let (first, first_reader) = live_session(&sessions, "first", "test");
        let (second, second_reader) = live_session(&sessions, "second", "other");

        sessions.depart(Departure::Window(owner("test")));
        assert_finishes(first_reader, "first reader");
        let remaining = sessions.table().live.contains_key("second");
        let first_closed = first.is_closed();
        let second_closed = second.is_closed();
        sessions.shut_down_all();
        assert_finishes(second_reader, "second reader");
        assert!(remaining);
        assert!(first_closed);
        assert!(!second_closed);
    }

    #[test]
    fn a_closed_windows_cleanup_does_not_remove_a_reopened_terminal() {
        let sessions = Sessions::default();
        let (_old, old_reader) = live_session(&sessions, "same-id", "test");

        sessions.depart(Departure::Window(owner("test")));
        let emptied = sessions.table().live.is_empty();
        let (reopened, new_reader) = live_session(&sessions, "same-id", "new-window");
        assert_finishes(old_reader, "old reader");
        let survived = sessions
            .table()
            .live
            .get("same-id")
            .is_some_and(|session| Arc::ptr_eq(&session.shared, &reopened));
        let still_open = !reopened.is_closed();
        sessions.shut_down_all();
        assert_finishes(new_reader, "reopened reader");
        assert!(emptied);
        assert!(survived);
        assert!(still_open);
    }

    #[test]
    fn a_spawn_that_finishes_after_its_owner_left_is_handed_back() {
        let sessions = Sessions::default();
        sessions.depart(Departure::Window(owner("test")));
        sessions.depart(Departure::Client(client_id(7)));

        let (_late, late_reader, late) = started_session(shell_command(), flow(), "test");
        let registered = sessions
            .table()
            .insert(&"t1".to_string(), &owner("test"), late);
        let handed_back = matches!(registered, Registered::OwnerGone(_));
        if let Registered::OwnerGone(session) = registered {
            session.shut_down();
        }
        let of_gone_client = Owner {
            client: client_id(7),
            window: "any".to_string(),
        };
        let (_other, other_reader) = live_session(&sessions, "t2", "other");

        assert!(sessions.table().is_gone(&of_gone_client));
        sessions.shut_down_all();
        assert_finishes(late_reader, "late reader");
        assert_finishes(other_reader, "other reader");
        assert!(handed_back);
        assert_eq!(
            sessions.table().live.keys().cloned().collect::<Vec<_>>(),
            Vec::<String>::new()
        );
    }

    #[cfg(unix)]
    fn shell_command() -> CommandBuilder {
        let mut command = CommandBuilder::new("sh");
        command.arg("-i");
        command
    }

    #[cfg(windows)]
    fn shell_command() -> CommandBuilder {
        super::test_support::stalling_command(10).0
    }

    fn flow() -> crate::flow_control::FlowControl {
        crate::flow_control::FlowControl::new()
    }

    #[test]
    fn only_the_users_own_home_is_expanded() {
        let home = dirs::home_dir().unwrap().to_string_lossy().to_string();
        assert_eq!(expand_home("~"), home);
        assert_eq!(expand_home("~/work"), format!("{home}/work"));
        assert_eq!(expand_home("~bob/work"), "~bob/work");
        assert_eq!(expand_home("/srv"), "/srv");
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::test_support::{assert_finishes, stalling_command, started_session, STALL_UNIT};
    use std::time::{Duration, Instant};

    /// Pane closed while the shell is still printing: the output pipe is
    /// full, the reader is blocked on flow control, nothing acknowledged.
    #[test]
    fn shutting_down_a_session_with_unread_output_returns() {
        let (command, flow) = stalling_command(200_000);
        let (shared, reader, session) = started_session(command, flow, "test");
        wait_for_the_stall(&shared);
        let shut_down = std::thread::spawn(move || {
            session.shut_down();
        });
        assert_finishes(shut_down, "shut_down");
        assert_finishes(reader, "reader thread");
    }

    /// Shell exited on its own with output nobody has read yet (the path
    /// the wait thread takes). Little enough output that the pipe behind the
    /// stalled reader can hold the rest of it.
    #[test]
    fn shutting_down_a_session_whose_shell_already_exited_returns() {
        let (command, flow) = stalling_command(500);
        let (shared, reader, session) = started_session(command, flow, "test");
        wait_for_the_stall(&shared);
        // The shell's 500 lines fit; give it time to exit.
        std::thread::sleep(Duration::from_millis(500));
        let shut_down = std::thread::spawn(move || {
            session.shut_down();
        });
        assert_finishes(shut_down, "shut_down");
        assert_finishes(reader, "reader thread");
    }

    /// Waits until the reader stalled on its watermark, and the pipe behind
    /// it had time to fill.
    fn wait_for_the_stall(shared: &super::SharedSession) {
        let started = Instant::now();
        while shared.in_flight() <= 4 * STALL_UNIT {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "reader never reached the high watermark"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

/// Output and who gets it, without a shell.
#[cfg(test)]
mod output_tests {
    use super::test_support::{attached_session, client, owner, profile, SIZE};
    use super::*;
    use crate::flow_control::FlowControl;
    use crate::protocol::ShellType;

    #[test]
    fn output_nobody_shows_is_kept_without_waiting_for_anyone() {
        let shared = SharedSession::new(
            profile(ShellType::Bash),
            owner("test"),
            SessionLifetime::SurvivesClient,
            SIZE,
            None,
        );
        // Far more than any client may be behind, ending in a line to find.
        let mut written = vec![b'x'; 5 * 1024 * 1024];
        written.extend_from_slice(b"\nthe end\n");

        pump_output(Box::new(std::io::Cursor::new(written)), &shared);

        let late = Attachment::new(&client(2), StreamId(1));
        shared.attach(&"t1".to_string(), late.clone(), "late".to_string());
        // One replay, of what was kept.
        assert_eq!(late.sent_pieces(), 1);
    }

    #[test]
    fn a_client_that_attaches_gets_what_was_kept_before_what_comes() {
        let shared = attached_session(FlowControl::new());
        pump_output(
            Box::new(std::io::Cursor::new(b"before\n".to_vec())),
            &shared,
        );

        let second = Attachment::new(&client(2), StreamId(1));
        let attached = shared
            .attach(&"t1".to_string(), second.clone(), "other".to_string())
            .unwrap();
        // The first client got it live, as piece 0.
        assert_eq!(attached.previous.unwrap().sent_pieces(), 1);
        // The replay took the new client's first sequence number; what the
        // shell writes now follows it.
        assert_eq!(second.sent_pieces(), 1);
        pump_output(Box::new(std::io::Cursor::new(b"after\n".to_vec())), &shared);
        assert_eq!(second.sent_pieces(), 2);
    }

    #[test]
    fn a_session_that_has_ended_takes_no_client() {
        let shared = attached_session(FlowControl::new());
        shared.end();
        let late = Attachment::new(&client(2), StreamId(1));
        assert!(shared
            .attach(&"t1".to_string(), late, "late".to_string())
            .is_none());
    }
}
