//! Tests of the sign-ins as a whole, against a token endpoint on this machine.

use super::store::tests::{provider, temp_home, FakeKeychain};
use super::*;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const ORIGIN: &str = "https://gitlab.com";

/// A token endpoint that answers each request with the next body.
async fn token_endpoint(answers: Vec<(u16, &'static str)>) -> (String, Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
    let url = format!(
        "http://127.0.0.1:{}/token",
        listener.local_addr().unwrap().port()
    );
    let requests = Arc::new(Mutex::new(Vec::new()));
    let seen = requests.clone();
    tokio::spawn(async move {
        for (status, body) in answers {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut chunk = [0u8; 4096];
            loop {
                let read = stream.read(&mut chunk).await.unwrap();
                request.extend_from_slice(&chunk[..read]);
                let text = String::from_utf8_lossy(&request).to_string();
                let Some((head, sent)) = text.split_once("\r\n\r\n") else {
                    continue;
                };
                let length = head
                    .lines()
                    .find_map(|line| {
                        line.to_ascii_lowercase()
                            .strip_prefix("content-length:")
                            .map(|value| value.trim().parse::<usize>().unwrap())
                    })
                    .unwrap_or(0);
                if sent.len() >= length {
                    seen.lock().unwrap().push(sent.to_string());
                    break;
                }
            }
            let reply = format!(
                "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(reply.as_bytes()).await.unwrap();
        }
    });
    (url, requests)
}

struct Fixture {
    sign_ins: SignIns,
    keychain: FakeKeychain,
    home: PathBuf,
    changes: Arc<Mutex<Vec<Vec<SignInStatus>>>>,
}

fn fixture() -> Fixture {
    let home = temp_home();
    let changes = Arc::new(Mutex::new(Vec::new()));
    let seen = changes.clone();
    let keychain = FakeKeychain::default();
    let sign_ins = SignIns::open(
        home.clone(),
        Store::open(home.clone(), Box::new(keychain.clone())),
        Box::new(move |statuses| seen.lock().unwrap().push(statuses.to_vec())),
    );
    Fixture {
        sign_ins,
        keychain,
        home,
        changes,
    }
}

async fn signed_in(
    fixture: &Fixture,
    token_url: &str,
    expires_in: Option<u64>,
    refresh: Option<&str>,
) {
    let provider = Provider {
        token_url: token_url.to_string(),
        ..provider()
    };
    let grant = Grant {
        access_token: "first".into(),
        refresh_token: refresh.map(str::to_string),
        expires_in,
    };
    fixture
        .sign_ins
        .keep(ORIGIN, provider, grant, None)
        .await
        .unwrap();
    fixture.sign_ins.changed();
}

fn git_config(fixture: &Fixture) -> String {
    std::fs::read_to_string(git_config::path(&fixture.home)).unwrap()
}

#[tokio::test]
async fn a_fresh_token_is_handed_out_as_it_is() {
    let fixture = fixture();
    signed_in(
        &fixture,
        "http://127.0.0.1:1/unused",
        Some(7200),
        Some("r1"),
    )
    .await;

    assert_eq!(
        fixture.sign_ins.credential(ORIGIN).await,
        Some(Credential {
            username: "oauth2".into(),
            password: "first".into()
        })
    );
    assert!(git_config(&fixture).contains("[credential \"https://gitlab.com\"]"));
}

#[tokio::test]
async fn a_token_about_to_run_out_is_renewed_and_the_new_pair_kept() {
    let (token_url, requests) = token_endpoint(vec![(
        200,
        r#"{"access_token":"second","refresh_token":"r2","expires_in":7200}"#,
    )])
    .await;
    let fixture = fixture();
    signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

    let credential = fixture.sign_ins.credential(ORIGIN).await;

    assert_eq!(credential.unwrap().password, "second");
    assert!(requests.lock().unwrap()[0].contains("grant_type=refresh_token&refresh_token=r1"));
    // The second request uses what the first one stored: no further refresh.
    assert_eq!(
        fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
        "second"
    );
    assert_eq!(requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn two_requests_at_once_spend_the_refresh_token_once() {
    let (token_url, requests) = token_endpoint(vec![(
        200,
        r#"{"access_token":"second","refresh_token":"r2","expires_in":7200}"#,
    )])
    .await;
    let fixture = fixture();
    signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

    let (first, second) = tokio::join!(
        fixture.sign_ins.credential(ORIGIN),
        fixture.sign_ins.credential(ORIGIN)
    );

    assert_eq!(first.unwrap().password, "second");
    assert_eq!(second.unwrap().password, "second");
    assert_eq!(requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn a_rejected_refresh_signs_the_origin_out() {
    let (token_url, _) = token_endpoint(vec![(400, r#"{"error":"invalid_grant"}"#)]).await;
    let fixture = fixture();
    signed_in(&fixture, &token_url, Some(30), Some("r1")).await;

    assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

    assert!(fixture.sign_ins.statuses().is_empty());
    assert!(!git_config(&fixture).contains("gitlab.com"));
    assert_eq!(fixture.changes.lock().unwrap().last(), Some(&vec![]));
}

#[tokio::test]
async fn an_unreachable_provider_keeps_the_sign_in() {
    let fixture = fixture();
    // Nothing listens on port 1.
    signed_in(&fixture, "http://127.0.0.1:1/token", Some(30), Some("r1")).await;

    assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

    assert_eq!(fixture.sign_ins.statuses().len(), 1);
}

#[tokio::test]
async fn a_refresh_token_the_keychain_does_not_hand_out_keeps_the_sign_in() {
    let fixture = fixture();
    signed_in(&fixture, "http://127.0.0.1:1/unused", Some(30), Some("r1")).await;
    *fixture.keychain.denied.lock().unwrap() = Some(format!("{ORIGIN}#refresh"));

    assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

    assert_eq!(fixture.sign_ins.statuses().len(), 1);
    assert_eq!(fixture.keychain.entries.lock().unwrap().len(), 2);
}

#[tokio::test]
async fn a_token_gone_from_the_keychain_signs_the_origin_out_for_git_and_the_windows() {
    let fixture = fixture();
    signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;
    fixture.keychain.entries.lock().unwrap().clear();

    assert_eq!(fixture.sign_ins.credential(ORIGIN).await, None);

    assert!(!git_config(&fixture).contains("gitlab.com"));
    assert_eq!(fixture.changes.lock().unwrap().last(), Some(&vec![]));
}

#[tokio::test]
async fn a_rejected_token_is_renewed_once() {
    let (token_url, _) = token_endpoint(vec![(
        200,
        r#"{"access_token":"second","expires_in":7200}"#,
    )])
    .await;
    let fixture = fixture();
    signed_in(&fixture, &token_url, Some(7200), Some("r1")).await;

    fixture.sign_ins.rejected(ORIGIN, "first").await;

    assert_eq!(
        fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
        "second"
    );
}

#[tokio::test]
async fn a_rejected_token_that_cannot_be_renewed_signs_the_origin_out() {
    let fixture = fixture();
    signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;

    fixture.sign_ins.rejected(ORIGIN, "first").await;

    assert!(fixture.sign_ins.statuses().is_empty());
}

#[tokio::test]
async fn a_rejection_of_another_credential_changes_nothing() {
    let fixture = fixture();
    signed_in(&fixture, "http://127.0.0.1:1/unused", None, None).await;

    fixture.sign_ins.rejected(ORIGIN, "typed-by-hand").await;

    assert_eq!(fixture.sign_ins.statuses().len(), 1);
}

#[tokio::test]
async fn a_sign_in_runs_from_the_browser_redirect_to_the_stored_token() {
    let (token_url, requests) = token_endpoint(vec![(
        200,
        r#"{"access_token":"granted","refresh_token":"r1","expires_in":7200}"#,
    )])
    .await;
    let fixture = fixture();
    let provider = Provider {
        token_url,
        ..provider()
    };
    // The "browser": follows the redirect the authorize URL names.
    let open = |url: &str| {
        let url = reqwest::Url::parse(url).unwrap();
        let param = |name: &str| {
            url.query_pairs()
                .find(|(key, _)| key == name)
                .unwrap()
                .1
                .into_owned()
        };
        let redirect = format!(
            "{}?code=the-code&state={}",
            param("redirect_uri"),
            param("state")
        );
        tokio::spawn(async move { reqwest::get(redirect).await });
        Ok(())
    };

    let status = fixture
        .sign_ins
        .sign_in("https://GitLab.com/", provider, open)
        .await;

    assert_eq!(
        status,
        Ok(SignInStatus {
            origin: ORIGIN.into(),
            persistent: true
        })
    );
    let sent = requests.lock().unwrap()[0].clone();
    assert!(sent.contains("grant_type=authorization_code&code=the-code"));
    assert!(sent.contains("code_verifier="));
    assert_eq!(
        fixture.sign_ins.credential(ORIGIN).await.unwrap().password,
        "granted"
    );
}

#[tokio::test]
async fn a_cancelled_sign_in_ends_its_wait() {
    let fixture = Arc::new(fixture());
    let waiting = fixture.clone();
    let sign_in = tokio::spawn(async move {
        waiting
            .sign_ins
            .sign_in(ORIGIN, provider(), |_| Ok(()))
            .await
    });
    while fixture.sign_ins.waiting.lock().unwrap().is_empty() {
        tokio::task::yield_now().await;
    }

    fixture.sign_ins.cancel(ORIGIN);

    assert_eq!(
        sign_in.await.unwrap(),
        Err("The sign-in was cancelled.".to_string())
    );
}
