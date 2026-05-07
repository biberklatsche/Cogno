use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

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
