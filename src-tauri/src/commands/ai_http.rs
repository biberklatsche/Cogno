use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpRequestPayload {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: String,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpResponsePayload {
    pub status: u16,
    pub body: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase", tag = "type")]
pub enum AiHttpStreamEvent {
    Status { status: u16 },
    Data { text: String },
    Done,
    Error { message: String },
}

#[tauri::command]
pub async fn ai_http_request(
    payload: AiHttpRequestPayload,
) -> Result<AiHttpResponsePayload, String> {
    let method = reqwest::Method::from_bytes(payload.method.as_bytes())
        .map_err(|error| format!("Invalid HTTP method '{}': {}", payload.method, error))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(payload.timeout_ms.unwrap_or(120_000)))
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {}", error))?;

    let mut request_builder = client
        .request(method, &payload.url)
        .body(payload.body);

    for (header_name, header_value) in payload.headers {
        request_builder = request_builder.header(&header_name, &header_value);
    }

    let response = request_builder
        .send()
        .await
        .map_err(|error| format!("Request failed: {}", error))?;

    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Failed to read response body: {}", error))?;

    Ok(AiHttpResponsePayload { status, body })
}

#[tauri::command]
pub async fn ai_http_request_stream(
    app: AppHandle,
    stream_id: String,
    payload: AiHttpRequestPayload,
) -> Result<(), String> {
    let event_name = format!("ai-http-stream-{}", stream_id);

    let method = reqwest::Method::from_bytes(payload.method.as_bytes())
        .map_err(|e| format!("Invalid HTTP method '{}': {}", payload.method, e))?;

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut request_builder = client.request(method, &payload.url).body(payload.body);
    for (k, v) in payload.headers {
        request_builder = request_builder.header(&k, &v);
    }

    let response = match request_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(&event_name, AiHttpStreamEvent::Error { message: e.to_string() });
            return Ok(());
        }
    };

    let status = response.status().as_u16();
    let _ = app.emit(&event_name, AiHttpStreamEvent::Status { status });

    let mut stream = response.bytes_stream();
    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes).into_owned();
                if !text.is_empty() {
                    let _ = app.emit(&event_name, AiHttpStreamEvent::Data { text });
                }
            }
            Err(e) => {
                let _ = app.emit(&event_name, AiHttpStreamEvent::Error { message: e.to_string() });
                return Ok(());
            }
        }
    }

    let _ = app.emit(&event_name, AiHttpStreamEvent::Done);
    Ok(())
}
