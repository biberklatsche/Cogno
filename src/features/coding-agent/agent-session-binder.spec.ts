import type { TerminalProcess } from "@cogno/core/api/terminal-processes-port";
import { describe, expect, it } from "vitest";
import { bindSession, normalizePath } from "./agent-session-binder";

const NOW = 1_700_000_000_000;
const names = ["codex", "codex.exe"];

function process(overrides: Partial<TerminalProcess>): TerminalProcess {
  return {
    terminalId: "t-1",
    name: "codex.exe",
    cwd: "C:\\work\\app",
    startedAt: NOW / 1000,
    ...overrides,
  };
}

const session = { cwd: "c:/work/app/", firstSeenAt: NOW };

describe("bindSession", () => {
  it("binds the one terminal that runs the agent in the session's folder", () => {
    const processes = [
      process({ terminalId: "t-1" }),
      process({ terminalId: "t-2", cwd: "C:\\work\\other" }),
      process({ terminalId: "t-3", name: "node.exe" }),
    ];
    expect(bindSession(processes, session, names, new Set())).toEqual({
      kind: "bound",
      terminalId: "t-1",
    });
  });

  it("finds no terminal for a session from outside Cogno, or without a folder", () => {
    expect(bindSession([process({ cwd: "/elsewhere" })], session, names, new Set())).toEqual({
      kind: "none",
    });
    expect(bindSession([process({})], { firstSeenAt: NOW }, names, new Set())).toEqual({
      kind: "none",
    });
  });

  it("skips terminals that already hold a session, and stays ambiguous when only those run it", () => {
    expect(
      bindSession([process({}), process({ terminalId: "t-2" })], session, names, new Set(["t-1"])),
    ).toEqual({ kind: "bound", terminalId: "t-2" });
    expect(bindSession([process({})], session, names, new Set(["t-1"]))).toEqual({
      kind: "ambiguous",
    });
  });

  it("tells two terminals in the same folder apart by the start time", () => {
    const processes = [
      process({ terminalId: "t-old", startedAt: (NOW - 600_000) / 1000 }),
      process({ terminalId: "t-new", startedAt: (NOW - 2_000) / 1000 }),
    ];
    expect(bindSession(processes, session, names, new Set())).toEqual({
      kind: "bound",
      terminalId: "t-new",
    });
  });

  it("stays ambiguous when both started long ago or at the same time", () => {
    const old = (NOW - 600_000) / 1000;
    expect(
      bindSession(
        [
          process({ terminalId: "t-1", startedAt: old }),
          process({ terminalId: "t-2", startedAt: old }),
        ],
        session,
        names,
        new Set(),
      ),
    ).toEqual({ kind: "ambiguous" });
    expect(
      bindSession(
        [process({ terminalId: "t-1" }), process({ terminalId: "t-2" })],
        session,
        names,
        new Set(),
      ),
    ).toEqual({ kind: "ambiguous" });
  });

  it("ignores a second candidate process in the same terminal", () => {
    const processes = [
      process({ terminalId: "t-1" }),
      process({ terminalId: "t-1", startedAt: (NOW - 1_000) / 1000 }),
    ];
    expect(bindSession(processes, session, names, new Set())).toEqual({
      kind: "bound",
      terminalId: "t-1",
    });
  });
});

describe("normalizePath", () => {
  it("treats separators, trailing slashes, the long-path prefix and case alike", () => {
    expect(normalizePath("\\\\?\\C:\\Work\\App\\")).toBe("c:/work/app");
    expect(normalizePath("/home/me/app")).toBe("/home/me/app");
  });
});
