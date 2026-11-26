//! The OAuth side of a sign-in: authorization code with PKCE (RFC 7636) for a
//! native app (RFC 8252). The browser comes back to a listener on 127.0.0.1
//! that exists for this one sign-in; the code it brings is exchanged for the
//! tokens, and a refresh token later for the next pair.

use super::store::Provider;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ring::digest::{digest, SHA256};
use ring::rand::{SecureRandom, SystemRandom};
use serde::Deserialize;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// How long the token endpoint may take to answer.
const TOKEN_TIMEOUT: Duration = Duration::from_secs(30);
/// More than a browser sends for the redirect; the rest is not read.
const MAX_REQUEST_BYTES: usize = 16 * 1024;

pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

pub fn pkce() -> Result<Pkce, String> {
    let mut bytes = [0u8; 32];
    SystemRandom::new()
        .fill(&mut bytes)
        .map_err(|_| "no random numbers from the system".to_string())?;
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = challenge_of(&verifier);
    Ok(Pkce {
        verifier,
        challenge,
    })
}

fn challenge_of(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(digest(&SHA256, verifier.as_bytes()))
}

/// The page the browser opens.
pub fn authorize_url(
    provider: &Provider,
    redirect_uri: &str,
    state: &str,
    challenge: &str,
) -> Result<String, String> {
    let mut url = reqwest::Url::parse(&provider.authorize_url).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &provider.client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("scope", &provider.scopes.join(" "))
        .append_pair("state", state)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256");
    Ok(url.into())
}

/// What one request to the listener was.
#[derive(Debug, PartialEq, Eq)]
enum Redirect {
    Code(String),
    /// The provider or the person said no; the text is the provider's.
    Refused(String),
    /// Not the redirect of this sign-in: a favicon request, a stale tab.
    Other,
}

fn read_redirect(request_target: &str, state: &str) -> Redirect {
    let Ok(url) = reqwest::Url::parse(&format!("http://127.0.0.1{request_target}")) else {
        return Redirect::Other;
    };
    let param = |name: &str| {
        url.query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    };
    if param("state").as_deref() != Some(state) {
        return Redirect::Other;
    }
    if let Some(code) = param("code") {
        return Redirect::Code(code);
    }
    match param("error_description").or_else(|| param("error")) {
        Some(reason) => Redirect::Refused(reason),
        None => Redirect::Other,
    }
}

fn page(status: &str, text: &str) -> String {
    let body = format!(
        "<!doctype html><meta charset=\"utf-8\"><title>Cogno</title>\
         <body style=\"font:16px system-ui;margin:4rem auto;max-width:30rem;text-align:center\">\
         <p>{text}</p></body>"
    );
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

/// Serves the listener until the browser brings this sign-in's redirect.
pub async fn wait_for_code(listener: TcpListener, state: &str) -> Result<String, String> {
    loop {
        let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
        let mut request = Vec::new();
        let mut chunk = [0u8; 2048];
        while !request.windows(4).any(|window| window == b"\r\n\r\n")
            && request.len() < MAX_REQUEST_BYTES
        {
            match stream.read(&mut chunk).await {
                Ok(0) | Err(_) => break,
                Ok(read) => request.extend_from_slice(&chunk[..read]),
            }
        }
        let head = String::from_utf8_lossy(&request);
        let target = head.split_whitespace().nth(1).unwrap_or("/");
        let redirect = read_redirect(target, state);
        let reply = match &redirect {
            Redirect::Code(_) => page(
                "200 OK",
                "Signed in. You can close this tab and go back to Cogno.",
            ),
            Redirect::Refused(_) => page(
                "200 OK",
                "The sign-in was not completed. You can close this tab and try again in Cogno.",
            ),
            Redirect::Other => page("404 Not Found", "Nothing here."),
        };
        let _ = stream.write_all(reply.as_bytes()).await;
        let _ = stream.shutdown().await;
        match redirect {
            Redirect::Code(code) => return Ok(code),
            Redirect::Refused(reason) => return Err(reason),
            Redirect::Other => {}
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Grant {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Seconds the access token is good for; `None` when it does not expire.
    pub expires_in: Option<u64>,
}

#[derive(Debug, PartialEq, Eq)]
pub enum GrantError {
    /// The provider answered and said no: the code or refresh token is spent.
    Rejected(String),
    /// No answer to go by (offline, a proxy, a server error): nothing is known
    /// about the token, so nothing may be thrown away.
    Unreachable(String),
}

impl std::fmt::Display for GrantError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GrantError::Rejected(reason) | GrantError::Unreachable(reason) => {
                formatter.write_str(reason)
            }
        }
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
    error_description: Option<String>,
}

/// Reads the token endpoint's answer. GitHub reports an error with status 200,
/// so the body decides, not the status.
fn read_grant(status: u16, body: &str) -> Result<Grant, GrantError> {
    let Ok(response) = serde_json::from_str::<TokenResponse>(body) else {
        return Err(GrantError::Unreachable(format!(
            "the token endpoint answered {status} with something that is not JSON"
        )));
    };
    match response.access_token.filter(|token| !token.is_empty()) {
        Some(access_token) => Ok(Grant {
            access_token,
            refresh_token: response.refresh_token.filter(|token| !token.is_empty()),
            expires_in: response.expires_in,
        }),
        None if status >= 500 => Err(GrantError::Unreachable(format!(
            "the token endpoint answered {status}"
        ))),
        None => Err(GrantError::Rejected(
            response
                .error_description
                .or(response.error)
                .unwrap_or_else(|| format!("the token endpoint answered {status}")),
        )),
    }
}

async fn request_grant(
    provider: &Provider,
    mut form: Vec<(&str, String)>,
) -> Result<Grant, GrantError> {
    form.push(("client_id", provider.client_id.clone()));
    if let Some(secret) = &provider.client_secret {
        form.push(("client_secret", secret.clone()));
    }
    let unreachable = |error: reqwest::Error| GrantError::Unreachable(error.to_string());
    let client = reqwest::Client::builder()
        .timeout(TOKEN_TIMEOUT)
        .build()
        .map_err(unreachable)?;
    let response = client
        .post(&provider.token_url)
        .header(reqwest::header::ACCEPT, "application/json")
        .form(&form)
        .send()
        .await
        .map_err(unreachable)?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(unreachable)?;
    read_grant(status, &body)
}

pub async fn exchange(
    provider: &Provider,
    code: &str,
    redirect_uri: &str,
    verifier: &str,
) -> Result<Grant, GrantError> {
    request_grant(
        provider,
        vec![
            ("grant_type", "authorization_code".to_string()),
            ("code", code.to_string()),
            ("redirect_uri", redirect_uri.to_string()),
            ("code_verifier", verifier.to_string()),
        ],
    )
    .await
}

pub async fn refresh(provider: &Provider, refresh_token: &str) -> Result<Grant, GrantError> {
    request_grant(
        provider,
        vec![
            ("grant_type", "refresh_token".to_string()),
            ("refresh_token", refresh_token.to_string()),
        ],
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sign_ins::store::tests::provider;

    #[test]
    fn the_challenge_is_the_hash_of_the_verifier() {
        // The example of RFC 7636, appendix B.
        assert_eq!(
            challenge_of("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn the_authorize_url_carries_the_challenge_and_the_loopback_redirect() {
        let url =
            authorize_url(&provider(), "http://127.0.0.1:4711/", "state", "challenge").unwrap();

        assert!(url
            .starts_with("https://gitlab.com/oauth/authorize?response_type=code&client_id=client"));
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A4711%2F"));
        assert!(url.contains("scope=write_repository"));
        assert!(url.contains("code_challenge=challenge&code_challenge_method=S256"));
    }

    #[test]
    fn only_the_redirect_with_this_sign_ins_state_counts() {
        assert_eq!(
            read_redirect("/?code=abc&state=mine", "mine"),
            Redirect::Code("abc".into())
        );
        assert_eq!(
            read_redirect("/?code=abc&state=other", "mine"),
            Redirect::Other
        );
        assert_eq!(read_redirect("/favicon.ico", "mine"), Redirect::Other);
        assert_eq!(
            read_redirect(
                "/?error=access_denied&error_description=No+thanks&state=mine",
                "mine"
            ),
            Redirect::Refused("No thanks".into())
        );
    }

    #[test]
    fn a_grant_is_read_from_the_body_not_the_status() {
        assert_eq!(
            read_grant(
                200,
                r#"{"access_token":"a","refresh_token":"r","expires_in":7200}"#
            ),
            Ok(Grant {
                access_token: "a".into(),
                refresh_token: Some("r".into()),
                expires_in: Some(7200),
            })
        );
        // GitHub: an error with status 200.
        assert_eq!(
            read_grant(
                200,
                r#"{"error":"bad_verification_code","error_description":"The code is spent."}"#
            ),
            Err(GrantError::Rejected("The code is spent.".into()))
        );
        assert_eq!(
            read_grant(400, r#"{"error":"invalid_grant"}"#),
            Err(GrantError::Rejected("invalid_grant".into()))
        );
    }

    #[test]
    fn a_server_error_says_nothing_about_the_token() {
        assert!(matches!(
            read_grant(502, "<html>bad gateway</html>"),
            Err(GrantError::Unreachable(_))
        ));
        assert!(matches!(
            read_grant(503, r#"{"error":"busy"}"#),
            Err(GrantError::Unreachable(_))
        ));
    }

    #[tokio::test]
    async fn the_listener_hands_out_the_code_of_the_matching_redirect() {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let waiting = tokio::spawn(async move { wait_for_code(listener, "mine").await });

        for target in ["/favicon.ico", "/?code=abc&state=mine"] {
            let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", port))
                .await
                .unwrap();
            stream
                .write_all(format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").as_bytes())
                .await
                .unwrap();
            let mut reply = String::new();
            stream.read_to_string(&mut reply).await.unwrap();
        }

        assert_eq!(waiting.await.unwrap(), Ok("abc".to_string()));
    }
}
