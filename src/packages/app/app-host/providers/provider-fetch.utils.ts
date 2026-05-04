export function buildProviderUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function createProviderHeaders(
  apiKey: string | undefined,
  headers: Readonly<Record<string, string>> | undefined,
): Headers {
  const providerHeaders = new Headers({
    "Content-Type": "application/json",
  });

  if (apiKey) {
    providerHeaders.set("Authorization", `Bearer ${apiKey}`);
  }

  for (const [headerName, headerValue] of Object.entries(headers ?? {})) {
    providerHeaders.set(headerName, headerValue);
  }

  return providerHeaders;
}

export async function parseErrorResponse(response: Response): Promise<string> {
  const responseText = await response.text();
  if (!responseText) {
    return `Request failed with status ${response.status}.`;
  }

  try {
    const parsedResponse = JSON.parse(responseText) as Record<string, unknown>;
    const parsedMessage = extractNestedMessage(parsedResponse);
    if (parsedMessage) {
      return parsedMessage;
    }
  } catch {
    // Fall back to plain text.
  }

  return responseText;
}

function extractNestedMessage(value: Record<string, unknown>): string | undefined {
  const directMessage = typeof value["message"] === "string" ? value["message"] : undefined;
  if (directMessage) {
    return directMessage;
  }

  const errorValue = value["error"];
  if (typeof errorValue === "string") {
    return errorValue;
  }
  if (isPlainObject(errorValue) && typeof errorValue["message"] === "string") {
    return errorValue["message"];
  }

  return undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
