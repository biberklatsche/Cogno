import { describe, expect, it } from "vitest";
import { HostError, isHostError, toHostError } from "./host-error";

describe("toHostError", () => {
  it("keeps the code and the message the app sent", () => {
    const error = toHostError({ code: "sessionNotFound", message: "No session runs under t1" });

    expect(error).toBeInstanceOf(HostError);
    expect(error.code).toBe("sessionNotFound");
    expect(error.message).toBe("No session runs under t1");
  });

  it("takes a code of a later app for unknown, not for a failure of its own", () => {
    expect(toHostError({ code: "outOfCoffee", message: "later" }).code).toBe("unknown");
  });

  it("takes a rejection that is no command error for an internal failure", () => {
    expect(toHostError("ipc broke").code).toBe("internal");
    expect(toHostError(new Error("worker died")).message).toBe("worker died");
  });
});

describe("isHostError", () => {
  it("is true only for a HostError with one of the codes", () => {
    const lost = new HostError("connectionLost", "lost");

    expect(isHostError(lost, "sessionNotFound", "connectionLost")).toBe(true);
    expect(isHostError(lost, "sessionNotFound")).toBe(false);
    expect(isHostError(new Error("connectionLost"), "connectionLost")).toBe(false);
  });
});
