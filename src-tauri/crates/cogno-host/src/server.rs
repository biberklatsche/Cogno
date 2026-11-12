//! One client of a host behind a byte stream: requests come in, replies and
//! events go out (`wire`). The stream's end is the client's end.

use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};

use crate::host::{Client, EventSink, Host};
use crate::protocol::Event;
use crate::wire::{self, HostMessage, RequestEnvelope};

struct Output<W>(Mutex<W>);

impl<W: Write> Output<W> {
    /// False when the client is gone.
    fn send(&self, message: HostMessage) -> bool {
        wire::write_host_message(&mut *self.0.lock().unwrap(), message).is_ok()
    }
}

impl<W: Write + Send + 'static> EventSink for Output<W> {
    fn emit(&self, event: Event) -> bool {
        self.send(HostMessage::Event(event))
    }
}

/// Serves one client of `host` until `input` ends. What becomes of the
/// client's sessions then is theirs to say (`Host::client_gone`).
pub(crate) fn serve_client<W: Write + Send + 'static>(
    host: &Arc<Host>,
    client_id: u64,
    mut input: impl Read,
    output: W,
) -> io::Result<()> {
    let output = Arc::new(Output(Mutex::new(output)));
    wire::write_hello(&mut *output.0.lock().unwrap())?;
    let client = Client {
        id: client_id,
        sink: output.clone(),
    };

    let served = loop {
        let RequestEnvelope { id, request } = match wire::read_request(&mut input) {
            Ok(Some(envelope)) => envelope,
            Ok(None) => break Ok(()),
            Err(error) => break Err(error),
        };
        if request.may_block() {
            // Off the reading thread: the other sessions' input and
            // acknowledgements must not wait for it.
            let host = host.clone();
            let client = client.clone();
            let output = output.clone();
            std::thread::spawn(move || {
                let reply = host.handle(&client, request);
                output.send(HostMessage::Reply { id, reply });
            });
        } else {
            let reply = host.handle(&client, request);
            output.send(HostMessage::Reply { id, reply });
        }
    };
    host.client_gone(client_id);
    served
}
