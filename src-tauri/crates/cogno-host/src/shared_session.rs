//! What a session's threads and the requests about it share: what is kept
//! of its output, the client it is attached to, the window it belongs to and
//! whom that window took it from. All of it under one lock, so that
//! attaching, detaching and ending decide in one step: two clients that
//! attach at once never leave the session belonging to one and attached to
//! the other.

use std::num::NonZeroU64;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

use crate::attachment::{Attachment, Owner, TakenFrom};
use crate::host::ClientId;
use crate::kept_output::KeptOutput;
use crate::protocol::{
    Attached, SessionInfo, SessionLifetime, SessionPlacement, ShellProfile, TerminalId,
    TerminalSize,
};
use crate::sync::lock;

struct SessionState {
    kept: KeptOutput,
    attached: Option<Attachment>,
    owner: Owner,
    /// Whom the owner took the session from, while that still matters.
    taken_from: Option<TakenFrom>,
    lifetime: SessionLifetime,
    /// Where it sits in the Cogno it belongs to, as that Cogno last said.
    placement: SessionPlacement,
    size: TerminalSize,
}

/// Who leaves: a window that closed, or a client that is gone with all its
/// windows.
#[derive(Debug, Clone)]
pub(crate) enum Departure {
    Window(Owner),
    Client(ClientId),
}

impl Departure {
    fn owns(&self, owner: &Owner) -> bool {
        match self {
            Departure::Window(window) => owner == window,
            Departure::Client(client) => owner.client == *client,
        }
    }
}

/// What a departure does to a session.
pub(crate) enum Left {
    /// The session is not the departing one's.
    Untouched,
    /// The session ends with its owner.
    Ends,
    /// The session goes on without its owner, attached to nobody. Whoever it
    /// was taken from may show it again.
    RunsOn {
        attachment: Option<Attachment>,
        taken_from: Option<TakenFrom>,
    },
}

/// What attaching did.
pub(crate) struct AttachedNow {
    /// The session as the new client sees it.
    pub info: SessionInfo,
    /// The client that showed it before, if one did.
    pub previous: Option<Attachment>,
    /// Whom the session belonged to before.
    pub previous_owner: Owner,
    /// Whether it passed to another window; not when a window attaches again.
    pub passed_on: bool,
}

/// What ending took off the session.
pub(crate) struct Ended {
    pub attachment: Option<Attachment>,
    pub taken_from: Option<TakenFrom>,
    pub window: String,
}

pub(crate) struct SharedSession {
    /// What it was started with, for a client that attaches later.
    profile: ShellProfile,
    state: Mutex<SessionState>,
    /// The session has ended: nothing is kept or sent any more, and nobody
    /// can attach.
    closed: AtomicBool,
    /// The client attached, or 0 (client ids are never 0): readable while
    /// the lock is held for a replay.
    attached_client: AtomicU64,
}

impl SharedSession {
    pub fn new(
        profile: ShellProfile,
        owner: Owner,
        lifetime: SessionLifetime,
        size: TerminalSize,
        attachment: Option<Attachment>,
    ) -> Arc<Self> {
        let shared = Arc::new(Self {
            profile,
            state: Mutex::new(SessionState {
                kept: KeptOutput::new(),
                attached: None,
                owner,
                taken_from: None,
                lifetime,
                placement: SessionPlacement::default(),
                size,
            }),
            closed: AtomicBool::new(false),
            attached_client: AtomicU64::new(0),
        });
        if let Some(attachment) = attachment {
            let mut state = shared.state();
            shared.put_on(&mut state, attachment);
        }
        shared
    }

    fn state(&self) -> MutexGuard<'_, SessionState> {
        lock(&self.state)
    }

    fn put_on(&self, state: &mut SessionState, attachment: Attachment) {
        self.attached_client
            .store(attachment.client.get(), Ordering::Release);
        state.attached = Some(attachment);
    }

    fn take_off(&self, state: &mut SessionState) -> Option<Attachment> {
        self.attached_client.store(0, Ordering::Release);
        state.attached.take()
    }

    /// The client attached now, if any.
    pub fn attached_client(&self) -> Option<ClientId> {
        NonZeroU64::new(self.attached_client.load(Ordering::Acquire)).map(ClientId)
    }

    pub fn is_closed(&self) -> bool {
        self.closed.load(Ordering::Acquire)
    }

    #[cfg(test)]
    pub fn owner(&self) -> Owner {
        self.state().owner.clone()
    }

    /// What the attached client has not acknowledged yet.
    #[cfg(all(test, windows))]
    pub fn in_flight(&self) -> usize {
        self.state()
            .attached
            .as_ref()
            .map_or(0, Attachment::in_flight)
    }

    /// Keeps the next piece of output and says who is to get it now.
    pub fn take_in(&self, bytes: &[u8]) -> Option<Attachment> {
        let mut state = self.state();
        state.kept.push(bytes);
        state.attached.clone()
    }

    /// Takes `attachment` off, unless another one has taken its place.
    pub fn forget(&self, attachment: &Attachment) {
        let mut state = self.state();
        if state
            .attached
            .as_ref()
            .is_some_and(|attached| attached.is(attachment))
        {
            self.take_off(&mut state);
        }
    }

    /// Attaches `attachment`, of `window`, and plays it what was kept. The
    /// replay happens under the lock, so the reader's next piece comes after
    /// it; sending only queues (`server`), so that is quick.
    ///
    /// A session that passes to another window goes on without clients from
    /// then on: it must not end with one that only came to look, while the
    /// Cogno it was started in may still be there to take it back. `None`
    /// for a session that has ended.
    pub fn attach(
        &self,
        terminal_id: &TerminalId,
        attachment: Attachment,
        window: String,
    ) -> Option<AttachedNow> {
        let mut state = self.state();
        if self.is_closed() {
            return None;
        }
        let owner = Owner {
            client: attachment.client,
            window,
        };
        // A window that attaches again (it was reloaded) has not lost the
        // session to anybody. Another window of the same client takes it like
        // any other Cogno.
        let passed_on = state.owner != owner;
        let previous_owner = std::mem::replace(&mut state.owner, owner);
        let previous = self.take_off(&mut state);
        if let Some(previous) = &previous {
            // Wakes the reader if it waits for the old client.
            previous.stop();
        }
        if passed_on {
            state.lifetime = SessionLifetime::SurvivesClient;
            // Whoever showed it gets it back once it is let go; a session
            // nobody showed was taken from nobody.
            state.taken_from = previous
                .as_ref()
                .map(|showed| TakenFrom::of(previous_owner.clone(), showed));
        }
        attachment.replay(&state.kept.replay());
        let client = attachment.client;
        self.put_on(&mut state, attachment);
        Some(AttachedNow {
            info: self.info_of(&state, terminal_id, client),
            previous,
            previous_owner,
            passed_on,
        })
    }

    /// Detaches `client`, if it is the one attached, and takes off whom the
    /// session was taken from: that one may show it again.
    pub fn detach(&self, client: ClientId) -> Option<(Attachment, Option<TakenFrom>)> {
        let mut state = self.state();
        if state.attached.as_ref()?.client != client {
            return None;
        }
        let attachment = self.take_off(&mut state)?;
        Some((attachment, state.taken_from.take()))
    }

    /// What `departure` does to this session.
    pub fn depart(&self, departure: &Departure) -> Left {
        let mut state = self.state();
        if let Departure::Client(client) = departure {
            // Nothing waits for a session any more on the client's behalf.
            if state
                .taken_from
                .as_ref()
                .is_some_and(|taken_from| taken_from.owner.client == *client)
            {
                state.taken_from = None;
            }
        }
        if !departure.owns(&state.owner) {
            return Left::Untouched;
        }
        if state.lifetime == SessionLifetime::EndsWithClient {
            return Left::Ends;
        }
        Left::RunsOn {
            attachment: self.take_off(&mut state),
            taken_from: state.taken_from.take(),
        }
    }

    /// The session ends: nothing is kept or sent any more, nobody can attach,
    /// and what was attached or waiting is taken off for the caller to tell.
    pub fn end(&self) -> Ended {
        let mut state = self.state();
        self.closed.store(true, Ordering::Release);
        let attachment = self.take_off(&mut state);
        if let Some(attachment) = &attachment {
            attachment.stop();
        }
        Ended {
            attachment,
            taken_from: state.taken_from.take(),
            window: state.owner.window.clone(),
        }
    }

    /// Only the client that shows the session paces it: a late ack from one
    /// that lost it must not hand its successor credit.
    pub fn acknowledge(&self, client: ClientId, seq: u32) {
        // A client that does not show the session does not wait for the lock.
        if self.attached_client() != Some(client) {
            return;
        }
        if let Some(attached) = self
            .state()
            .attached
            .as_ref()
            .filter(|attached| attached.client == client)
        {
            attached.acknowledge(seq);
        }
    }

    pub fn place(&self, placement: SessionPlacement) {
        self.state().placement = placement;
    }

    pub fn resized(&self, size: TerminalSize) {
        self.state().size = size;
    }

    /// The session as `client` sees it.
    pub fn info(&self, terminal_id: &TerminalId, client: ClientId) -> SessionInfo {
        self.info_of(&self.state(), terminal_id, client)
    }

    fn info_of(
        &self,
        state: &SessionState,
        terminal_id: &TerminalId,
        client: ClientId,
    ) -> SessionInfo {
        let attached = match &state.attached {
            None => Attached::Nowhere,
            Some(attachment) if attachment.client == client => Attached::Here,
            Some(attachment) => Attached::Elsewhere {
                by: attachment.client_name.clone(),
            },
        };
        SessionInfo {
            terminal_id: terminal_id.clone(),
            placement: state.placement.clone(),
            profile: self.profile.clone(),
            size: state.size,
            attached,
        }
    }
}
