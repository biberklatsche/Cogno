//! The helper side: this binary as git's credential helper, started by git as
//! `cogno git-credential get|store|erase` (gitcredentials(7)). It reads what
//! git asks on stdin, asks the running Cogno over the local server and prints
//! the answer. It holds no token itself and exits 0 whatever happens: a
//! helper that says nothing is one git simply moves past.

use crate::commands::askpass::SESSION_ENV;
use std::collections::HashMap;
use std::io::Read;

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
fn render(answer: &serde_json::Value) -> String {
    let mut output = String::new();
    for key in ["username", "password"] {
        if let Some(value) = answer.get(key).and_then(|value| value.as_str()) {
            if value.contains(['\n', '\r', '\0']) {
                return String::new();
            }
            output.push_str(&format!("{key}={value}\n"));
        }
    }
    // The person refused: git must not go on to ask through askpass.
    if answer.get("quit").and_then(|value| value.as_bool()) == Some(true) {
        output.push_str("quit=1\n");
    }
    output
}

pub fn run_helper(operation: &str) -> i32 {
    let mut input = String::new();
    let _ = std::io::stdin().read_to_string(&mut input);
    // Cogno keeps nothing git hands it: a sign-in is stored when it is made.
    if operation != "get" && operation != "erase" {
        return 0;
    }
    let Ok(port) = std::env::var("COGNO_PORT") else {
        return 0;
    };
    let token = std::env::var("COGNO_TOKEN").unwrap_or_default();
    let asked = parse(&input);
    let body = serde_json::json!({
        // A run of the command runner; absent for git typed in a terminal.
        "session": std::env::var(SESSION_ENV).ok(),
        "operation": operation,
        "protocol": asked.get("protocol"),
        "host": asked.get("host"),
        "password": asked.get("password"),
    });
    let Ok(client) = reqwest::blocking::Client::builder()
        // A sign-in in the browser may take a while.
        .timeout(std::time::Duration::from_secs(60 * 60))
        .build()
    else {
        return 0;
    };
    let Ok(response) = client
        .post(format!("http://127.0.0.1:{port}/credential"))
        .header(crate::http_server::TOKEN_HEADER, token)
        .json(&body)
        .send()
    else {
        return 0;
    };
    let answer: serde_json::Value = response.json().unwrap_or_default();
    print!("{}", render(&answer));
    0
}

#[cfg(test)]
mod tests {
    use super::*;

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
            render(&serde_json::json!({ "username": "oauth2", "password": "token" })),
            "username=oauth2\npassword=token\n"
        );
        assert_eq!(render(&serde_json::json!({})), "");
        assert_eq!(render(&serde_json::json!({ "quit": true })), "quit=1\n");
    }

    #[test]
    fn an_answer_that_would_add_a_line_is_not_given() {
        assert_eq!(
            render(&serde_json::json!({ "username": "me\nquit=1", "password": "x" })),
            ""
        );
    }
}
