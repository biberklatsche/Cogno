//! Which host each terminal of this app runs on, through which connection,
//! for which window, and under which output stream. A request about a
//! terminal finds its host here, so the webview never has to name it.

use std::collections::HashMap;
use std::sync::Mutex;

use cogno_host::protocol::{HostError, StreamId, TerminalId, WindowLabel};
use cogno_host::sync::lock;

use crate::command_error::CommandResult;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Route {
    /// The host on another machine; `None` for this machine's daemon.
    pub host: Option<String>,
    /// The connection it came through (`HostConnection::id`): it ends with
    /// that one, not with a newer connection to the same host.
    pub connection: u64,
    /// The window that spawned or attached it: where its messages and its
    /// end go.
    pub window: WindowLabel,
    pub stream: StreamId,
}

#[derive(Default)]
pub struct TerminalRoutes(Mutex<HashMap<TerminalId, Route>>);

impl TerminalRoutes {
    /// Routes `terminal_id` before its request goes out: the shell's first
    /// output and its end can overtake the reply. Unless committed, the
    /// route is taken back when the returned guard goes, and what routed the
    /// id before (a shell that already runs under it) does again.
    pub fn register(&self, terminal_id: &TerminalId, route: Route) -> PendingRoute<'_> {
        let previous = lock(&self.0).insert(terminal_id.clone(), route);
        PendingRoute {
            routes: self,
            terminal_id: terminal_id.clone(),
            previous: Some(previous),
        }
    }

    /// The route of a terminal of `window`: a window that lost the terminal
    /// to another one reaches it no more.
    pub fn of_window(&self, terminal_id: &str, window: &str) -> CommandResult<Route> {
        lock(&self.0)
            .get(terminal_id)
            .filter(|route| route.window == window)
            .cloned()
            .ok_or_else(|| HostError::session_not_found(terminal_id).into())
    }

    pub fn window_of(&self, terminal_id: &str) -> Option<WindowLabel> {
        lock(&self.0)
            .get(terminal_id)
            .map(|route| route.window.clone())
    }

    pub fn remove(&self, terminal_id: &str) -> Option<Route> {
        lock(&self.0).remove(terminal_id)
    }

    /// The window lost the terminal to another Cogno. That other one may be
    /// a window of this very app, which has routed it to itself by then: its
    /// route stays.
    pub fn remove_of_window(&self, terminal_id: &str, window: &str) {
        let mut routes = lock(&self.0);
        if routes
            .get(terminal_id)
            .is_some_and(|route| route.window == window)
        {
            routes.remove(terminal_id);
        }
    }

    /// Takes out every terminal that came through `connection`.
    pub fn drain_connection(&self, connection: u64) -> Vec<(TerminalId, Route)> {
        lock(&self.0)
            .extract_if(|_, route| route.connection == connection)
            .collect()
    }

    /// Takes out every terminal of `window`.
    pub fn drain_window(&self, window: &str) -> Vec<Route> {
        lock(&self.0)
            .extract_if(|_, route| route.window == window)
            .map(|(_, route)| route)
            .collect()
    }
}

/// A route whose request is still on its way (`TerminalRoutes::register`).
pub struct PendingRoute<'a> {
    routes: &'a TerminalRoutes,
    terminal_id: TerminalId,
    /// What routed the id before; `None` once committed.
    previous: Option<Option<Route>>,
}

impl PendingRoute<'_> {
    /// The request went through: the route stays.
    pub fn commit(mut self) {
        self.previous = None;
    }
}

impl Drop for PendingRoute<'_> {
    fn drop(&mut self) {
        let Some(previous) = self.previous.take() else {
            return;
        };
        let mut routes = lock(&self.routes.0);
        match previous {
            Some(previous) => routes.insert(self.terminal_id.clone(), previous),
            None => routes.remove(&self.terminal_id),
        };
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn route(window: &str, stream: u64) -> Route {
        Route {
            host: None,
            connection: 1,
            window: window.to_string(),
            stream: StreamId(stream),
        }
    }

    fn routed_to(window: &str) -> TerminalRoutes {
        let routes = TerminalRoutes::default();
        routes
            .register(&"t1".to_string(), route(window, 1))
            .commit();
        routes
    }

    #[test]
    fn a_window_that_lost_its_terminal_is_no_longer_where_requests_go() {
        let routes = routed_to("main");

        routes.remove_of_window("t1", "main");

        assert!(routes.of_window("t1", "main").is_err());
    }

    #[test]
    fn the_window_of_this_app_that_took_a_terminal_over_keeps_it() {
        // The other window attached first; then the old one hears of it.
        let routes = routed_to("window-2");

        routes.remove_of_window("t1", "main");

        assert_eq!(routes.window_of("t1").as_deref(), Some("window-2"));
    }

    #[test]
    fn a_route_whose_request_failed_gives_way_to_the_one_before() {
        let routes = routed_to("main");

        // A start under the same id that the host turned down.
        drop(routes.register(&"t1".to_string(), route("main", 2)));
        assert_eq!(routes.of_window("t1", "main").unwrap().stream, StreamId(1));

        // A first route that failed leaves nothing behind.
        drop(routes.register(&"t2".to_string(), route("main", 3)));
        assert_eq!(routes.window_of("t2"), None);
    }
}
