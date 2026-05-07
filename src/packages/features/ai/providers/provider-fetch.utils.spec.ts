import { describe, expect, it } from "vitest";
import {
  buildProviderUrl,
  createProviderHeaders,
  headersToRecord,
  parseErrorResponseText,
} from "./provider-fetch.utils";

describe("provider-fetch utils", () => {
  it("normalizes base url and path when building provider urls", () => {
    expect(buildProviderUrl("https://example.test/", "/chat/completions")).toBe(
      "https://example.test/chat/completions",
    );
    expect(buildProviderUrl("https://example.test", "chat/completions")).toBe(
      "https://example.test/chat/completions",
    );
  });

  it("creates headers with authorization and overrides", () => {
    const headers = createProviderHeaders("secret", {
      Accept: "text/event-stream",
      "Content-Type": "application/custom+json",
    });

    expect(headers.get("Authorization")).toBe("Bearer secret");
    expect(headers.get("Accept")).toBe("text/event-stream");
    expect(headers.get("Content-Type")).toBe("application/custom+json");
  });

  it("serializes headers to a plain record", () => {
    const headers = new Headers({
      Authorization: "Bearer token",
      "X-Custom": "value",
    });

    expect(headersToRecord(headers)).toEqual({
      Authorization: "Bearer token",
      "X-Custom": "value",
    });
  });

  it("extracts nested error messages from json responses", () => {
    expect(parseErrorResponseText(JSON.stringify({ message: "plain message" }), 400)).toBe(
      "plain message",
    );
    expect(
      parseErrorResponseText(JSON.stringify({ error: { message: "nested message" } }), 500),
    ).toBe("nested message");
    expect(parseErrorResponseText(JSON.stringify({ error: "top level error" }), 401)).toBe(
      "top level error",
    );
  });

  it("falls back to plain text or generic status messages", () => {
    expect(parseErrorResponseText("upstream unavailable", 503)).toBe("upstream unavailable");
    expect(parseErrorResponseText("", 404)).toBe("Request failed with status 404.");
  });
});
