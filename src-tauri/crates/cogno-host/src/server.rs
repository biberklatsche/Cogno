//! A host behind a byte stream: requests come in, replies and events go out
//! (`wire`). The stream's end is the client's end, and with it every shell's.

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

/// Serves one client until `input` ends, then ends every shell.
pub fn serve<W: Write + Send + 'static>(mut input: impl Read, output: W) -> io::Result<()> {
    let output = Arc::new(Output(Mutex::new(output)));
    wire::write_hello(&mut *output.0.lock().unwrap())?;
    let host = Arc::new(Host::new());
    // The one client this server has: whoever is at the other end.
    let client = Client {
        id: 1,
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
    host.release_all();
    served
}
