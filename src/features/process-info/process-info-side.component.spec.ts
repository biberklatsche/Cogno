import { describe, expect, it } from "vitest";
import {
  filterProcessNodes,
  noticeableStatus,
  ProcessTreeNode,
} from "./process-info-side.component";

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

describe("filterProcessNodes", () => {
  const node = (
    processId: number,
    name: string,
    childProcessNodes: ProcessTreeNode[] = [],
  ): ProcessTreeNode => ({
    processDetails: {
      processId,
      parentProcessId: null,
      name,
      currentWorkingDirectory: null,
      status: "Run",
      runTimeSeconds: 0,
      memoryBytes: 0,
    },
    childProcessNodes,
  });
  const names = (nodes: ProcessTreeNode[]): unknown[] =>
    nodes.map((n) => [n.processDetails.name, names(n.childProcessNodes)]);
  const tree = [
    node(10, "pnpm.exe", [node(11, "node.exe", [node(12, "esbuild.exe")]), node(13, "git.exe")]),
    node(20, "ping.exe"),
  ];

  it("returns the tree untouched without a query", () => {
    expect(filterProcessNodes(tree, "  ")).toBe(tree);
  });

  it("keeps a match with what it started and the parents that lead to it", () => {
    expect(names(filterProcessNodes(tree, "NODE"))).toEqual([
      ["pnpm.exe", [["node.exe", [["esbuild.exe", []]]]]],
    ]);
  });

  it("matches a PID", () => {
    expect(names(filterProcessNodes(tree, "20"))).toEqual([["ping.exe", []]]);
  });
});
