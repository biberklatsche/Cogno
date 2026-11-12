import { describe, expect, it } from "vitest";
import { createConfigSchema } from "./config-schema";

describe("createConfigSchema", () => {
  it("requires a destination for a host", () => {
    const result = createConfigSchema().safeParse({ remote: { hosts: { mac: {} } } });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["remote", "hosts", "mac", "destination"]);
  });
});
