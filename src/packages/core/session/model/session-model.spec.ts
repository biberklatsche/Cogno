import { describe, expect, it, vi } from "vitest";
import { CommandRecorder } from "../recorder/command-recorder";
import type { SessionFact } from "../session-facts";
import { TerminalCommandHistoryStore } from "./command-history.store";
import { SessionModel } from "./session-model";

function recorderStub(): CommandRecorder {
  return {
    initialize: vi.fn(),
    onCwdChanged: vi.fn(),
    onCommandExecuted: vi.fn(),
  } as unknown as CommandRecorder;
}

describe("SessionModel", () => {
  it("sets and clears the unread notification", () => {
    const model = new SessionModel("linux", new TerminalCommandHistoryStore(), recorderStub());
    model.initialize("terminal-1", "Bash", undefined, "linux");

    expect(model.hasUnreadNotification).toBe(false);
    model.markUnreadNotification();
    expect(model.hasUnreadNotification).toBe(true);
    model.clearUnreadNotification();
    expect(model.hasUnreadNotification).toBe(false);
  });

  it("does not mark the unread notification while the badge is disabled", () => {
    const model = new SessionModel(
      "linux",
      new TerminalCommandHistoryStore(),
      recorderStub(),
      () => false,
    );
    model.initialize("terminal-1", "Bash", undefined, "linux");

    model.markUnreadNotification();

    expect(model.hasUnreadNotification).toBe(false);
  });

  it("reports the working directory as a backend path and the change to the recorder", () => {
    const recorder = recorderStub();
    const model = new SessionModel("linux", new TerminalCommandHistoryStore(), recorder);
    model.initialize("terminal-1", "Bash", undefined, "linux");
    const reported: SessionFact[] = [];
    model.facts$.subscribe((fact) => reported.push(fact));

    model.updateCwd("/home/me");
    model.updateCwd("/home/me");

    expect(reported).toEqual([
      { type: "cwdReported", cwd: "/home/me" },
      { type: "cwdReported", cwd: "/home/me" },
    ]);
    expect(recorder.onCwdChanged).toHaveBeenCalledTimes(1);
    expect(model.state.cwd).toBe("/home/me");
  });

  it("says when a command starts and ends, and once more on dispose", () => {
    const model = new SessionModel("linux", new TerminalCommandHistoryStore(), recorderStub());
    model.initialize("terminal-1", "Bash", undefined, "linux");
    const busy: boolean[] = [];
    model.facts$.subscribe((fact) => {
      if (fact.type === "busyChanged") busy.push(fact.isBusy);
    });

    model.updateInput({ text: "ls -la", cursorIndex: 6, maxCursorIndex: 6 });
    model.startCommand();
    expect(model.isCommandRunning).toBe(true);
    expect(model.input.text).toBe("");
    model.endCommand();
    model.dispose();

    expect(busy).toEqual([true, false, false]);
  });

  it("hands an executed command to the recorder and states it as a fact", () => {
    const recorder = recorderStub();
    const model = new SessionModel("linux", new TerminalCommandHistoryStore(), recorder);
    model.initialize("terminal-1", "Bash", undefined, "linux");
    const facts: SessionFact[] = [];
    model.facts$.subscribe((fact) => facts.push(fact));

    model.updateCommand({ id: "1", directory: "/tmp", user: "me", machine: "box" });
    model.updateInput({ text: "git status", cursorIndex: 10, maxCursorIndex: 10 });
    model.startCommand();
    const executed = model.updateCommand({
      id: "2",
      directory: "/tmp",
      user: "me",
      machine: "box",
      command: "git status",
      returnCode: "0",
      duration: "12",
    });

    expect(executed?.command).toBe("git status");
    expect(recorder.onCommandExecuted).toHaveBeenLastCalledWith(executed);
    expect(facts).toContainEqual({ type: "commandCompleted", command: executed });
    expect(model.commands).toHaveLength(2);
  });
});
