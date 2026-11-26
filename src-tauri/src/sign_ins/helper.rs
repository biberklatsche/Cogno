//! Cogno as git's credential helper (gitcredentials(7)), both ends of it.
//!
//! The helper side: git starts this binary as `cogno git-credential
//! get|store|erase`. It reads what git asks on stdin, asks the running Cogno
//! over the local server and prints the answer. It holds no token itself and
//! exits 0 whatever happens: a helper that says nothing is one git simply
//! moves past.
//!
//! The server side (`answer`) decides what git gets. An origin signed in here
//! gets its token from the backend alone. Any other origin is the business of
//! the run that asked: its window signs in or takes a typed credential. Git
//! typed in a terminal gets no answer for such an origin and asks there
//! itself.

use super::{git_config, now, Credential, SignIns};
use crate::commands::run_questions::{ask_running_cogno, Asked, RunQuestions, SESSION_ENV};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

/// The kind of question a credential request is; the payload names the origin.
const CREDENTIAL_KIND: &str = "credential";
/// The kind that tells the run git reported its credential for an origin as
/// rejected. Asked like a question, so the run has heard of it before git
/// ends: its failure then needs no message read to be understood.
const REJECTED_KIND: &str = "credential_rejected";

/// What the window answers to a credential request.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum WindowAnswer {
    /// The person signed in in the browser; the backend holds the token.
    SignedIn,
    /// Typed by hand, handed to git as it is.
    Typed { username: String, password: String },
}

/// How long a credential typed by hand is handed out again: one push must not
/// ask for every fetch that follows.
const TYPED_SECONDS: u64 = 60 * 60;

/// What the helper asks the running Cogno.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Request {
    /// The runner session; absent for git typed in a terminal.
    pub session: Option<String>,
    pub operation: String,
    pub protocol: Option<String>,
    pub host: Option<String>,
    /// The name git already has for the request, from the remote's url.
    pub username: Option<String>,
    /// The credential git reports as rejected (`erase`).
    pub password: Option<String>,
}

/// What git gets back.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Reply {
    Credential {
        username: String,
        password: String,
    },
    /// Git goes on as if this helper were not there: to the next helper, then
    /// to its own prompt.
    Nothing,
    /// The person refused: git must not go on to ask through askpass.
    Quit,
}

impl From<Credential> for Reply {
    fn from(credential: Credential) -> Self {
        Reply::Credential {
            username: credential.username,
            password: credential.password,
        }
    }
}

/// Credentials typed by hand, with the second they are forgotten at. Kept in
/// memory only: whether one is stored for longer is up to the user's own
/// helpers, which git calls after a successful access.
#[derive(Default)]
pub struct Typed(Mutex<HashMap<String, (Credential, u64)>>);

impl Typed {
    fn remember(&self, origin: &str, credential: Credential) {
        self.0
            .lock()
            .unwrap()
            .insert(origin.to_string(), (credential, now() + TYPED_SECONDS));
    }

    /// The credential typed for `origin`; when git names a user, only that
    /// user's.
    fn get(&self, origin: &str, username: Option<&str>) -> Option<Credential> {
        let mut typed = self.0.lock().unwrap();
        match typed.get(origin) {
            Some((credential, until)) if *until > now() => Some(credential.clone())
                .filter(|credential| username.is_none_or(|name| name == credential.username)),
            Some(_) => {
                typed.remove(origin);
                None
            }
            None => None,
        }
    }

    /// Git reported `password` as rejected for `origin`.
    fn forget(&self, origin: &str, password: &str) {
        let mut typed = self.0.lock().unwrap();
        if typed
            .get(origin)
            .is_some_and(|(credential, _)| credential.password == password)
        {
            typed.remove(origin);
        }
    }
}

/// Answers the helper.
pub async fn answer(app: &AppHandle, request: Request) -> Reply {
    let (Some(protocol), Some(host)) = (&request.protocol, &request.host) else {
        return Reply::Nothing;
    };
    let Some(origin) = git_config::origin_of(protocol, host) else {
        return Reply::Nothing;
    };
    let sign_ins = app.state::<SignIns>();
    let typed = app.state::<Typed>();
    let questions = app.state::<RunQuestions>();
    let about_origin = serde_json::json!({ "origin": origin });

    if request.operation == "erase" {
        if let Some(password) = &request.password {
            typed.forget(&origin, password);
            sign_ins.rejected(&origin, password).await;
        }
        if let Some(session) = &request.session {
            questions
                .ask(app, session, REJECTED_KIND, about_origin)
                .await;
        }
        return Reply::Nothing;
    }

    if let Some(credential) = sign_ins.credential(&origin).await {
        return credential.into();
    }
    // Git typed in a terminal gets what is signed in and nothing else: what
    // a run's dialog took belongs to the runs, and git asks in the terminal.
    let Some(session) = &request.session else {
        return Reply::Nothing;
    };
    if let Some(credential) = typed.get(&origin, request.username.as_deref()) {
        return credential.into();
    }
    let answer = match questions
        .ask(app, session, CREDENTIAL_KIND, about_origin)
        .await
    {
        Asked::Answered(answer) => serde_json::from_value::<WindowAnswer>(answer).ok(),
        Asked::Refused => None,
        // The run has nobody for credentials, or is over: git goes on.
        Asked::Unanswered => return Reply::Nothing,
    };
    match answer {
        Some(WindowAnswer::SignedIn) => match sign_ins.credential(&origin).await {
            Some(credential) => credential.into(),
            None => Reply::Quit,
        },
        Some(WindowAnswer::Typed { username, password }) => {
            let credential = Credential { username, password };
            typed.remember(&origin, credential.clone());
            credential.into()
        }
        None => Reply::Quit,
    }
}

/// What git wrote: `key=value` lines up to an empty one.
fn parse(input: &str) -> HashMap<String, String> {
    input
        .lines()
        .take_while(|line| !line.is_empty())
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

/// What git reads back. A value with a line break could smuggle a second
/// attribute in, so such an answer is not given at all.
fn render(reply: &Reply) -> String {
    match reply {
        Reply::Credential { username, password }
            if !format!("{username}{password}").contains(['\n', '\r', '\0']) =>
        {
            format!("username={username}\npassword={password}\n")
        }
        Reply::Credential { .. } | Reply::Nothing => String::new(),
        Reply::Quit => "quit=1\n".to_string(),
    }
}

pub fn run_helper(operation: &str) -> i32 {
    let mut input = String::new();
    let _ = std::io::stdin().read_to_string(&mut input);
    // Cogno keeps nothing git hands it: a sign-in is stored when it is made.
    if operation != "get" && operation != "erase" {
        return 0;
    }
    let mut asked = parse(&input);
    let request = Request {
        session: std::env::var(SESSION_ENV).ok(),
        operation: operation.to_string(),
        protocol: asked.remove("protocol"),
        host: asked.remove("host"),
        username: asked.remove("username"),
        password: asked.remove("password"),
    };
    // A rejection matters to the run it happened in, or by the credential
    // that was rejected; with neither there is nothing to tell.
    if operation == "erase" && request.session.is_none() && request.password.is_none() {
        return 0;
    }
    let reply = ask_running_cogno("credential", &serde_json::json!(request))
        .and_then(|answer| serde_json::from_value::<Reply>(answer).ok())
        .unwrap_or(Reply::Nothing);
    print!("{}", render(&reply));
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    const ORIGIN: &str = "https://gitlab.com";

    fn credential(password: &str) -> Credential {
        Credential {
            username: "me".into(),
            password: password.into(),
        }
    }

    #[test]
    fn reads_gits_attributes_up_to_the_empty_line() {
        let asked = parse(
            "protocol=https\nhost=gitlab.com:8443\nwwwauth[]=Basic realm=\"GitLab\"\n\nignored=1\n",
        );

        assert_eq!(asked.get("protocol").map(String::as_str), Some("https"));
        assert_eq!(
            asked.get("host").map(String::as_str),
            Some("gitlab.com:8443")
        );
        assert_eq!(
            asked.get("wwwauth[]").map(String::as_str),
            Some("Basic realm=\"GitLab\"")
        );
        assert!(!asked.contains_key("ignored"));
    }

    #[test]
    fn prints_what_git_reads_back() {
        assert_eq!(
            render(&Reply::from(credential("token"))),
            "username=me\npassword=token\n"
        );
        assert_eq!(render(&Reply::Nothing), "");
        assert_eq!(render(&Reply::Quit), "quit=1\n");
    }

    #[test]
    fn an_answer_that_would_add_a_line_is_not_given() {
        assert_eq!(render(&Reply::from(credential("x\nquit=1"))), "");
    }

    #[test]
    fn a_reply_reads_the_same_on_both_ends() {
        for reply in [
            Reply::from(credential("token")),
            Reply::Nothing,
            Reply::Quit,
        ] {
            let wire = serde_json::json!(reply);
            assert_eq!(serde_json::from_value::<Reply>(wire).unwrap(), reply);
        }
    }

    #[test]
    fn a_typed_credential_is_handed_out_until_git_reports_it_rejected() {
        let typed = Typed::default();
        typed.remember(ORIGIN, credential("token"));

        assert_eq!(typed.get(ORIGIN, None), Some(credential("token")));
        assert_eq!(typed.get(ORIGIN, Some("me")), Some(credential("token")));
        assert_eq!(typed.get(ORIGIN, Some("somebody-else")), None);
        typed.forget(ORIGIN, "another");
        assert_eq!(typed.get(ORIGIN, None), Some(credential("token")));

        typed.forget(ORIGIN, "token");
        assert_eq!(typed.get(ORIGIN, None), None);
    }

    #[test]
    fn a_typed_credential_is_forgotten_when_its_time_is_up() {
        let typed = Typed::default();
        typed
            .0
            .lock()
            .unwrap()
            .insert(ORIGIN.to_string(), (credential("token"), now() - 1));

        assert_eq!(typed.get(ORIGIN, None), None);
        assert!(typed.0.lock().unwrap().is_empty());
    }
}
