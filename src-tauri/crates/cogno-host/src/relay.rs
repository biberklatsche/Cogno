//! What one client of the host has for another: a question to answer (what
//! `cogno action run` asks the Cogno that shows its terminal, what git or ssh
//! asks the Cogno that started them), and what an agent's hook said that no
//! terminal of its own names. The host only passes it on.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};

use crate::host::{Client, ClientId, EventSink};
use crate::protocol::{Answer, Event, HostError, HostErrorCode, RelayId, Response};
use crate::sync::lock;

/// A question on its way: whom the answer goes to, under which of its
/// request ids, and who is to answer.
struct Pending {
    asker: ClientId,
    request: u64,
    answerer: ClientId,
}

#[derive(Default)]
struct RelayState {
    /// The clients connected now.
    clients: HashMap<ClientId, Arc<dyn EventSink>>,
    /// Which client answers the prompts of a prompt session.
    prompt_owners: HashMap<String, ClientId>,
    pending: HashMap<RelayId, Pending>,
    next_relay: u64,
}

#[derive(Default)]
pub(crate) struct Relay {
    state: Mutex<RelayState>,
}

impl Relay {
    fn state(&self) -> MutexGuard<'_, RelayState> {
        lock(&self.state)
    }

    /// `client` is connected: questions and hooks can reach it.
    pub fn came(&self, client: &Client) {
        self.state().clients.insert(client.id, client.sink.clone());
    }

    /// `client` is gone. What it was to answer fails for whoever asked; what
    /// it asked is answered to nobody; its prompts have no owner any more.
    pub fn gone(&self, client: ClientId) {
        let unanswered: Vec<(Arc<dyn EventSink>, u64)> = {
            let mut state = self.state();
            state.clients.remove(&client);
            state.prompt_owners.retain(|_, owner| *owner != client);
            let pending = std::mem::take(&mut state.pending);
            let mut unanswered = Vec::new();
            for (relay, question) in pending {
                if question.asker == client {
                    continue;
                }
                if question.answerer != client {
                    state.pending.insert(relay, question);
                    continue;
                }
                if let Some(asker) = state.clients.get(&question.asker) {
                    unanswered.push((asker.clone(), question.request));
                }
            }
            unanswered
        };
        for (asker, request) in unanswered {
            asker.reply(
                request,
                Err(HostError::new(
                    HostErrorCode::NoAnswer,
                    "The Cogno that was to answer went away",
                )),
            );
        }
    }

    /// Gives every connected client but `from` the event `event` makes.
    pub fn broadcast(&self, from: ClientId, event: impl Fn() -> Event) {
        let others: Vec<Arc<dyn EventSink>> = self
            .state()
            .clients
            .iter()
            .filter(|(id, _)| **id != from)
            .map(|(_, sink)| sink.clone())
            .collect();
        for sink in others {
            sink.event(event());
        }
    }

    /// `client` answers the prompts of `session` from now on.
    pub fn own_prompts(&self, client: ClientId, session: String) {
        self.state().prompt_owners.insert(session, client);
    }

    /// `client` answers the prompts of `session` no more; another owner it
    /// was handed to keeps them.
    pub fn disown_prompts(&self, client: ClientId, session: &str) {
        let mut state = self.state();
        if state.prompt_owners.get(session) == Some(&client) {
            state.prompt_owners.remove(session);
        }
    }

    /// Who answers the prompts of `session`.
    pub fn prompt_owner(&self, session: &str) -> Option<ClientId> {
        self.state().prompt_owners.get(session).copied()
    }

    /// Passes a question of `asker`, which waits under `request`, on to
    /// `answerer`, with the event `asked` makes of its relay id. Fails with
    /// `NotShown` when `answerer` is not connected.
    pub fn ask(
        &self,
        asker: ClientId,
        request: u64,
        answerer: ClientId,
        asked: impl FnOnce(RelayId) -> Event,
    ) -> Result<(), HostError> {
        let (sink, relay) = {
            let mut state = self.state();
            let Some(sink) = state.clients.get(&answerer).cloned() else {
                return Err(not_shown());
            };
            state.next_relay += 1;
            let relay = RelayId(state.next_relay);
            state.pending.insert(
                relay,
                Pending {
                    asker,
                    request,
                    answerer,
                },
            );
            (sink, relay)
        };
        sink.event(asked(relay));
        Ok(())
    }

    /// `from` answers the question `relay`: the asker gets the answer. Only
    /// the client the question went to answers it.
    pub fn answer(&self, from: ClientId, relay: RelayId, answer: Answer) {
        let asker = {
            let mut state = self.state();
            let question = match state.pending.remove(&relay) {
                Some(question) if question.answerer == from => question,
                other => {
                    if let Some(question) = other {
                        state.pending.insert(relay, question);
                    }
                    log::debug!(target: "host", "an answer to no question of the client: {relay:?}");
                    return;
                }
            };
            state
                .clients
                .get(&question.asker)
                .map(|sink| (sink.clone(), question.request))
        };
        if let Some((asker, request)) = asker {
            asker.reply(request, Ok(Response::Answered { answer }));
        }
    }
}

/// Nobody is there to answer.
pub(crate) fn not_shown() -> HostError {
    HostError::new(
        HostErrorCode::NotShown,
        "No Cogno shows that terminal or answers those prompts",
    )
}
