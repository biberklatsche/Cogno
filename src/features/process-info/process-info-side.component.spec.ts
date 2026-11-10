import { describe, expect, it } from "vitest";
import { noticeableStatus } from "./process-info-side.component";

describe("noticeableStatus", () => {
  it("names a process that has ended or is halted", () => {
    expect(noticeableStatus("Zombie")).toBe("Zombie");
    expect(noticeableStatus("Stop")).toBe("Stop");
  });

  it("stays silent for a process that runs or waits", () => {
    expect(noticeableStatus("Run")).toBeNull();
    expect(noticeableStatus("Sleep")).toBeNull();
    expect(noticeableStatus("UninterruptibleDiskSleep")).toBeNull();
  });
});
