//! One client of a host behind a byte stream: hellos first, then requests
//! come in and replies and events go out (`wire`). The stream's end is the
//! client's end.

use std::io::{self, Read, Write};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

use crate::host::{Client, ClientId, EventSink, Host};
use crate::protocol::{AgentHook, Event, HostError, HostErrorCode, Reply, Request};
use crate::wire::{self, ClientFrame, ClientMessage, HostMessage, Output};

/// How much of what agents' hooks said may wait for a client that is slow
/// to read before more is dropped: output waits for acknowledgements, hooks
/// do not.
const MAX_QUEUED_HOOK_BYTES: usize = 4 * 1024 * 1024;

/// What goes to the client, written by a thread of its own: whoever sends
/// only queues, so a client that is slow to read never holds up the host -
/// not its sessions' readers, not another client's requests.
struct ClientWriter {
    /// Each message with what it counts against `queued_hook_bytes`.
    sender: mpsc::Sender<(HostMessage, usize)>,
    queued_hook_bytes: Arc<AtomicUsize>,
}

impl ClientWriter {
    /// Starts the thread that writes to `output`. It ends when the client
    /// can no longer be written to, or when nothing can send any more.
    fn start<W: Write + Send + 'static>(mut output: W) -> Self {
        let (sender, queued) = mpsc::channel::<(HostMessage, usize)>();
        let queued_hook_bytes = Arc::new(AtomicUsize::new(0));
        {
            let queued_hook_bytes = queued_hook_bytes.clone();
            std::thread::spawn(move || {
                for (message, hook_bytes) in queued {
                    if wire::write_host_message(&mut output, message).is_err() {
                        return;
                    }
                    queued_hook_bytes.fetch_sub(hook_bytes, Ordering::AcqRel);
                }
            });
        }
        Self {
            sender,
            queued_hook_bytes,
        }
    }

    /// False when the client is gone.
    fn send(&self, message: HostMessage) -> bool {
        self.sender.send((message, 0)).is_ok()
    }
}

impl EventSink for ClientWriter {
    fn event(&self, event: Event) {
        self.send(HostMessage::Event(event));
    }

    fn agent_hook(&self, hook: AgentHook) {
        let bytes = hook.payload.len();
        if self.queued_hook_bytes.fetch_add(bytes, Ordering::AcqRel) + bytes > MAX_QUEUED_HOOK_BYTES
        {
            self.queued_hook_bytes.fetch_sub(bytes, Ordering::AcqRel);
            log::debug!(target: "host", "a hook was dropped: the client is far behind");
            return;
        }
        let event = Event::AgentHook {
            hook,
            replayed: false,
        };
        if self
            .sender
            .send((HostMessage::Event(event), bytes))
            .is_err()
        {
            self.queued_hook_bytes.fetch_sub(bytes, Ordering::AcqRel);
        }
    }

    fn reply(&self, id: u64, reply: Reply) {
        self.send(HostMessage::Reply { id, reply });
    }

    fn output(&self, output: Output) -> bool {
        self.send(HostMessage::Output(output))
    }
}

/// Serves one client of `host` until `input` ends. What becomes of the
/// client's sessions then is theirs to say (`Host::client_gone`).
pub(crate) fn serve_client<W: Write + Send + 'static>(
    host: &Arc<Host>,
    client_id: ClientId,
    mut input: impl Read,
    mut output: W,
) -> io::Result<()> {
    wire::write_host_hello(&mut output)?;
    let hello = wire::read_client_hello(&mut input)?;
    // The client checks the versions the same way and hangs up itself; a
    // client that does not is not talked to either.
    if wire::check_versions(hello.protocol, hello.oldest).is_err() {
        return Ok(());
    }
    let writer = Arc::new(ClientWriter::start(output));
    let client = Client {
        id: client_id,
        name: hello.name,
        sink: writer.clone(),
    };
    // Also when handling a request panics on this thread: the client's
    // sessions must not stay attached to a client nobody serves.
    let _gone = ClientGone {
        host,
        client: client_id,
    };
    host.client_came(&client);

    loop {
        let message = match wire::read_client_message(&mut input)? {
            Some(ClientFrame::Message(message)) => message,
            Some(ClientFrame::Unreadable { id, reason }) => {
                match id {
                    Some(id) => writer.reply(
                        id,
                        Err(HostError::new(
                            HostErrorCode::InvalidRequest,
                            format!("The request could not be read: {reason}"),
                        )),
                    ),
                    None => log::warn!(target: "host", "a post could not be read: {reason}"),
                }
                continue;
            }
            None => return Ok(()),
        };
        let (id, request) = match message {
            // Answered once another client did; asking only passes it on.
            ClientMessage::Request {
                id,
                request: Request::Ask { to, question },
            } => {
                host.ask(&client, id, to, question);
                continue;
            }
            ClientMessage::Request { id, request } => (Some(id), request),
            ClientMessage::Post { request } => (None, request),
        };
        let may_block = request.may_block();
        let answer = {
            let host = host.clone();
            let client = client.clone();
            let writer = writer.clone();
            move || {
                let reply = host.handle(&client, request);
                match id {
                    Some(id) => writer.reply(id, reply),
                    None => {
                        if let Err(error) = reply {
                            // Nobody waits for it; a typed key that crossed a
                            // takeover is no news.
                            log::debug!(target: "host", "a posted request failed: {error}");
                        }
                    }
                }
            }
        };
        if may_block {
            // Off the reading thread: the other sessions' input and
            // acknowledgements must not wait for it.
            std::thread::spawn(answer);
        } else {
            answer();
        }
    }
}

/// Tells the host that its client is gone when serving it ends, however it
/// ends.
struct ClientGone<'a> {
    host: &'a Host,
    client: ClientId,
}

impl Drop for ClientGone<'_> {
    fn drop(&mut self) {
        self.host.client_gone(self.client);
    }
}
